import React from 'react'
import { Store, Model } from 'tyshemo'
import { each, filter, isInstanceOf, isFunction, clone, map } from 'ts-fns'

const _stores = {}
const _methods = {}
const _hooks = {}
const _contexts = {}

/**
 *
 * @param {object} def
 * @param {string} def.name the key of namespace in the whole state, for example, when name is 'some', you can get this local state by state.some or store.get('some')
 * @param {object} def.state the init state of this namespace
 * @param {object} def.computed computed properties
 * @param {object} def.methods the methods to call with context this
 * @param {object} def.hooks the functions to do when on certain moment
 * @param {object} def.watch the functions to react when state change
 * @example
 * import { use, connect } from 'tyshemo-react'
 *
 * use({
 *   name: 'myState',
 *   state: {
 *     some: 'xxx',
 *   },
 *   methods: {
 *     updateSome(v) {
 *       this.some = v
 *     },
 *   },
 * })
 *
 * function MyComponent(props) {
 *   const { myState, updateSome } = props
 *   return <span onClick={() => updateSome('aaa')}>{myState.some}</span>
 * }
 *
 * export default connect((state, methods) => {
 *   const { myState } = state
 *   const { updateSome } = methods.myState
 *   return {
 *     myState,
 *     updateSome,
 *   }
 * })(MyComponent)
 */
export function use(def) {
  const { name, state, computed = {}, methods = {}, hooks = {}, watch = {} } = def

  // has been registered
  if (_stores[name]) {
    return false
  }

  const $store = new Store(state)
  const $state = $store.state

  // computed
  each(computed, (compute, key) => {
    $store.define(key, compute)
  })

  // methods
  const $methods = {}
  const $context = new Proxy({}, {
    get: (target, key) => {
      if ($state[key]) {
        return $state[key]
      }
      else if ($methods[key]) {
        return $methods[key]
      }
    },
    set: (target, key, value) => {
      if ($methods[key]) {
        return false
      }
      else {
        $state[key] = value
        return true
      }
    },
    deleteProperty(target, key) {
      if (key in $state) {
        delete $state[key]
        return true
      }
      else {
        return false
      }
    },
  })
  each(methods, (fn, key) => {
    $methods[key] = fn.bind($context)
  })

  // hooks
  const $hooks = {}
  each(hooks, (fn, key) => {
    $hooks[key] = fn.bind($context)
  })

  // register
  _stores[name] = $store
  _methods[name] = $methods
  _hooks[name] = $hooks
  _contexts[name] = $context

  /**
   * propagation of models
   */
  $store.observe(
    v => isInstanceOf(v, Model),
    (dispatch, model) => model.watch('*', dispatch, true),
    (dispatch, model) => model.unwatch('*', dispatch, true),
  )

  // watch
  each(watch, (fn, key) => {
    $store.watch(key, fn.bind($context), true)
  })

  // onUse
  if ($hooks.onUse) {
    $hooks.onUse.call($context)
  }

  return true
}

/**
 *
 * @param {function} map
 *  - state the whole state of tyshemo-react
 *  - props the original props received by component
 *  - return: props to pass to component
 * @example
 * export default connect(function map(state, methods, props) {
 *   const { some, project } = state
 *   const updateData = methods.some.updateData
 *   return {
 *     some,
 *     project,
 *     updateData,
 *     ...props,
 *   }
 * })(MyComponent)
 */
export function connect(mapToProps, mergeToProps) {
  const keys = []
  const states = new Proxy(_stores, {
    get(t, key) {
      keys.push(key)
      return _stores[key].state
    },
    set: () => false,
    deleteProperty: () => false,
  })
  const methods = new Proxy(_methods, {
    get(t, key) {
      keys.push(key)
      return _methods[key]
    },
    set: () => false,
    deleteProperty: () => false,
  })

  const mappedProps = mapToProps(states, methods)
  const mergeProps = (ownProps) => {
    const mergedProps = isFunction(mergeToProps) ? mergeToProps(mappedProps, ownProps) : { ...mappedProps, ...ownProps }
    return mergedProps
  }

  const hooks = filter(_hooks, (_, key) => keys.includes(key))
  const callHook = (fn, ...args) => {
    each(hooks, (hook, name) => {
      if (hook[fn]) {
        const context = _contexts[name]
        hook[fn].apply(context, args)
      }
    })
  }

  callHook('onConnect', keys)

  return function(Component) {
    class TyshemoConnectedComponent extends React.Component {
      constructor(props) {
        super(props)
        this.state = {}
        this.init()
      }
      init() {
        callHook('onInit', this)
      }
      update = () => {
        this.setState({})
      }
      componentDidMount() {
        keys.forEach((key) => {
          const store = _stores[key]
          store.watch('*', this.update, true)
        })
        callHook('onMount', this)
      }
      componentWillUnmount() {
        keys.forEach((key) => {
          const store = _stores[key]
          store.unwatch('*', this.update)
        })
        callHook('onUnmount', this)
      }
      render() {
        const { children, ...props } = this.props
        const connectedProps = mergeProps(props)

        // user can force update rendering
        connectedProps.updateRender = (fn, force) => {
          if (isFunction(fn)) {
            fn()
          }
          if (force) {
            this.forceUpdate()
          }
          else {
            this.update()
          }
        }

        callHook('onRender', Component, connectedProps)

        return <Component {...connectedProps}>{children}</Component>
      }
    }

    callHook('onCreate', TyshemoConnectedComponent)

    return TyshemoConnectedComponent
  }
}

/**
 * use def, and return a connect function which contains only this namespace
 * @param {*} def
 * @example
 * const connect = make({
 *   name: 'myState',
 *   state: {
 *     some: 'xxx',
 *   },
 * })
 *
 * function MyComponent(props) {
 *   const { myState } = props
 *   return <span>{myState.some}</span>
 * }
 *
 * export default connect(MyComponent)
 */
export function make(def) {
  const { name } = def
  use(def)
  return connect((state, methods) => ({
    [name]: state[name],
    ...methods[name],
  }))
}

/**
 * get whole state
 */
export function getState() {
  const state = map(_stores, store => store.state)
  return state
}

/**
 * subscribe to change
 * @param {*} fn
 */
export function subscribe(fn) {
  const callbacks = []

  each(_stores, (store, name) => {
    const callback = ({ key, value }) => {
      fn(name, key, value)
    }
    store.watch('*', callback, true)
    callbacks.push({ name, callback })
  })

  const unsubscribe = () => {
    callbacks.forEach(({ name, callback }) => {
      const store = _stores[name]
      store.unwatch('*', callback)
    })
  }

  return unsubscribe
}
