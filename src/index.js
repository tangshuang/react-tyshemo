import React from 'react'
import { Store, Model } from 'tyshemo'
import { each, filter, isInstanceOf, isFunction, parse, map, isString, throttle } from 'ts-fns'

const _stores = {}
const _hooks = {}
const _contexts = {}
const _shared = []

function create(def) {
  const { state, computed = {}, methods = {}, hooks = {}, watch = {} } = def

  const $store = new Store(state)
  const $state = $store.state
  const $data = $store.data

  // computed
  each(computed, (compute, key) => {
    $store.define(key, compute)
  })

  // methods
  const $methods = {}
  const $context = new Proxy({}, {
    get(_, key) {
      if ($methods[key]) {
        return $methods[key]
      }
      else {
        return $state[key]
      }
    },
    set(_, key, value) {
      if ($methods[key]) {
        return false
      }
      else {
        $state[key] = value
        return true
      }
    },
    deleteProperty(_, key) {
      if (key in $state) {
        delete $state[key]
        return true
      }
      else {
        return false
      }
    },
    ownKeys() {
      const stateKeys = Object.keys($state)
      const methodKeys = Object.keys($methods)
      return [...stateKeys, ...methodKeys]
    },
    getOwnPropertyDescriptor(_, key) {
      const methodKeys = Object.keys($methods)
      const isMethod = methodKeys.includes(key)
      return {
        enumerable: !isMethod,
        configurable: true,
      }
    },
  })

  $methods.dispatch = (key, fn) => {
    fn = isFunction(key) ? key : fn
    key = isString(key) ? key : ''

    if (fn) {
      fn()
    }

    const value = parse($data, key)
    const state = parse($state, key)
    $store.dispatch(key, {
      value,
      next: state,
      prev: state,
    }, true)
  }

  each(methods, (fn, key) => {
    $methods[key] = fn.bind($context)
  })

  // hooks
  const $hooks = {}
  each(hooks, (fn, key) => {
    $hooks[key] = fn.bind($context)
  })

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

  return {
    store: $store,
    hooks: $hooks,
    context: $context,
  }
}

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
  const { name } = def

  // has been registered
  if (_stores[name]) {
    return false
  }

  const {
    store: $store,
    hooks: $hooks,
    context: $context,
  } = create(def)

  // register
  _stores[name] = $store
  _hooks[name] = $hooks
  _contexts[name] = $context

  // onUse
  if ($hooks.onUse) {
    $hooks.onUse()
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
  const names = []
  const contexts = new Proxy(_contexts, {
    get(_, name) {
      names.push(name)
      return _contexts[name]
    },
    set: () => false,
    deleteProperty: () => false,
  })

  const mappedProps = mapToProps(contexts)
  const mergeProps = (ownProps) => {
    const mergedProps = isFunction(mergeToProps) ? mergeToProps(mappedProps, ownProps) : { ...mappedProps, ...ownProps }
    return mergedProps
  }

  const hooks = filter(_hooks, (_, name) => names.includes(name))
  const callHook = (fn, ...args) => {
    each(hooks, (hooks) => {
      if (hooks[fn]) {
        hooks[fn](...args)
      }
    })
  }

  callHook('onConnect')

  return function(Component) {
    class TyshemoConnectedComponent extends React.Component {
      constructor(props) {
        super(props)
        this.state = {}
        this.init()
      }
      init() {
        callHook('onInit', TyshemoConnectedComponent)
      }

      update = throttle(() => {
        this.setState({})
      }, 16)

      componentDidMount() {
        names.forEach((name) => {
          const store = _stores[name]
          store.watch('*', this.update, true)
        })
        callHook('onMount', TyshemoConnectedComponent)
      }
      componentDidUpdate() {
        callHook('onUpdate', TyshemoConnectedComponent)
      }
      componentWillUnmount() {
        names.forEach((name) => {
          const store = _stores[name]
          store.unwatch('*', this.update)
        })
        callHook('onUnmount', TyshemoConnectedComponent)
      }
      render() {
        const { children, ...props } = this.props
        const connectedProps = mergeProps(props)

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
  return connect((contexts) => ({
    [name]: contexts[name],
  }))
}

/**
 *
 * @param {*} define
 * @example
 * function MyComponent(props) {
 *   const { age, updateAge } = props
 *   // ...
 * }
 *
 * const connect = makeLocal(() => {
 *   return {
 *     state: {
 *       age: 10,
 *     },
 *     methods: {
 *       updateAge() {
 *         this.age ++
 *       },
 *     },
 *   }
 * })
 *
 * export default connect(MyComponent)
 */
export function makeLocal(define) {
  const callHook = (hook, ...args) => {
    if (isFunction(hook)) {
      hook(args)
    }
  }
  return function(Component) {
    class TyshemoConnectedComponent extends React.Component {
      constructor(props) {
        super(props)
        this.state = {}
        this.init()
      }
      init() {
        const def = define()
        const { name, store, hooks, context } = create(def)

        this.$$ = {
          name,
          store,
          hooks,
          context,
        }

        callHook(hooks.onUse)
        callHook(hooks.onConnect)

        callHook(hooks.onCreate, TyshemoConnectedComponent)
        callHook(hooks.onInit, TyshemoConnectedComponent)
      }

      update = throttle(() => {
        this.setState({})
      }, 16)

      componentDidMount() {
        const { store, hooks } = this.$$
        store.watch('*', this.update, true)
        callHook(hooks.onMount, TyshemoConnectedComponent)
      }
      componentDidUpdate() {
        const { hooks } = this.$$
        callHook(hooks.onUpdate, TyshemoConnectedComponent)
      }
      componentWillUnmount() {
        const { store, hooks } = this.$$
        store.unwatch('*', this.update)
        callHook(hooks.onUnmount, TyshemoConnectedComponent)
        this.$$ = null
      }
      render() {
        const { name, context, hooks } = this.$$
        const { children, ...props } = this.props

        const connectedProps = name ? {
          [name]: context,
          ...props,
        } : {
          ...context,
          ...props,
        }

        callHook(hooks.onRender, Component, connectedProps)

        return <Component {...connectedProps}>{children}</Component>
      }
    }

    return TyshemoConnectedComponent
  }
}

/**
 * hook function
 * @param {*} define
 */
export function useLocal(define) {
  const [, update] = React.useState()
  const mounted = React.useRef(false)
  const { context, hooks, store } = React.useMemo(() => {
    const def = isFunction(define) ? define() : define
    const { context, hooks, store } = create(def)

    if (hooks.onUse) {
      hooks.onUse()
    }

    if (hooks.onInit) {
      hooks.onInit()
    }

    return { context, hooks, store }
  }, [])

  React.useEffect(() => {
    if (hooks.onMount) {
      hooks.onMount()
    }

    store.watch('*', update, true)

    mounted.current = true

    return () => {
      if (hooks.onUnmount) {
        hooks.onUnmount()
      }

      store.unwatch('*', update, true)
    }
  }, [])

  React.useEffect(() => {
    if (hooks.onUpdate && mounted.current) {
      hooks.onUpdate()
    }
  })

  return context
}

/**
 * create a shared scope state
 * @param {function} define define function which return state def
 * @return {array} [context, subscribe, unlink]
 *   - context
 *   - subscribe(fn: key, value => void): unsubscribe()
 *   - unlink() remove reference from memory, should must be invoked when you will not use the context any more
 * @example
 * // with hooks
 * function MyComponent() {
 *   const [, update] = useState()
 *   const [context, subscribe, unlink] = useShared(define)
 *
 *   useEffect(() => {
 *     const unsubscribe = subscribe(update)
 *     return () => {
 *       unlink() // if needed
 *       unsubscribe()
 *     }
 *   }, [])
 * }
 *
 * // class component
 * class MyComponent extends React.Component {
 *   constructor(props) {
 *     super(props)
 *     this.state = {}
 *
 *     const update = () => this.setState({})
 *     const [context, subscribe, unlink] = useShared(define)
 *
 *     this.context = context
 *     this.unsubscribe = subscribe(update)
 *     this.unlink = unlink
 *   }
 *
 *   componentWillUnmount() {
 *     this.unlink() // if needed
 *     this.unsubscribe()
 *   }
 * }
 */
export function useShared(define) {
  const item = _shared.find(item => item.define === define)

  if (item) {
    return [item.context, item.subscribe, item.unlink]
  }

  const def = define()
  const { context, hooks, store } = create(def)
  const subscribe = (fn) => {
    const callback = ({ key, value }) => {
      fn(key, value)
    }
    store.watch('*', callback, true)
    return () => {
      store.unwatch('*', callback)
    }
  }
  const unlink = () => _shared.forEach((item, i) => item.define === define && _shared.splice(i, 1))

  const local = {
    context,
    define,
    subscribe,
    unlink,
  }

  _shared.push(local)

  if (hooks.onUse) {
    hooks.onUse()
  }

  return [context, subscribe, unlink]
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
