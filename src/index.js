import React from 'react'
import { Store, Model } from 'tyshemo'
import { each, filter, isInstanceOf, isFunction, parse, map, isString } from 'ts-fns'

export { Model }

const _stores = {}
const _hooks = {}
const _contexts = {}

const _observers = []

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
export function use(define) {
  const def = isFunction(define) ? define() : define
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

  // subscribe
  $store.watch('*', ({ key, value }) => {
    if (_observers.length) {
      _observers.forEach((fn) => {
        fn(name, key, value)
      })
    }
  })

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
  const callHook = (fn) => {
    each(hooks, (hooks) => {
      if (hooks[fn]) {
        hooks[fn]()
      }
    })
  }

  return function(Component) {
    class TyshemoConnectedComponent extends React.Component {
      constructor(props) {
        super(props)
        this.state = {}
        this.update = () => {
          this.setState({})
        }
        this.init()
      }
      init() {
        callHook('onInit')
      }
      componentDidMount() {
        names.forEach((name) => {
          const store = _stores[name]
          store.watch('*', this.update, true)
        })
        callHook('onMount')
      }
      componentDidUpdate() {
        callHook('onUpdate')
      }
      componentWillUnmount() {
        names.forEach((name) => {
          const store = _stores[name]
          store.unwatch('*', this.update)
        })
        callHook('onUnmount')
      }
      render() {
        const { children, ...props } = this.props
        const connectedProps = mergeProps(props)
        return <Component {...connectedProps}>{children}</Component>
      }
    }

    callHook('onConnect')

    return TyshemoConnectedComponent
  }
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
 * @param {function} fn
 */
export function subscribe(fn) {
  _observers.push(fn)

  const unsubscribe = () => {
    const i = _observers.indexOf(fn)
    if (i > -1) {
      _observers.splice(i, 1)
    }
  }

  return unsubscribe
}


/**
 * local hook
 * @param {function} define
 */
export function useLocalStore(define, deps = []) {
  const [, forceUpdate] = React.useState()
  const mounted = React.useRef(false)
  const unmounted = React.useRef(false)

  const callHook = (hook) => {
    if (isFunction(hook)) {
      hook()
    }
  }

  const { context, hooks, store } = React.useMemo(() => {
    const def = define()
    const { context, hooks, store } = create(def)

    callHook(hooks.onUse)
    callHook(hooks.onConnect)
    callHook(hooks.onInit)

    return { context, hooks, store }
  }, deps)

  React.useEffect(() => {
    callHook(hooks.onMount)
    mounted.current = true
    return () => {
      unmounted.current = true
    }
  }, [])

  React.useEffect(() => {
    const update = () => {
      if (!unmounted.current) {
        forceUpdate({})
      }
    }

    store.watch('*', update, true)
    return () => {
      if (unmounted.current) {
        callHook(hooks.onUnmount)
      }

      store.unwatch('*', update, true)
    }
  }, [store, hooks])

  React.useEffect(() => {
    if (mounted.current) {
      callHook(hooks.onUpdate)
    }
  }, [hooks])

  return context
}

/**
 *
 * @param {*} define return a Model
 * @param {*} deps
 */
export function useLocalModel(define, deps = []) {
  const [, forceUpdate] = React.useState()
  const unmounted = React.useRef(false)

  const UseModel = React.useMemo(() => define(), [])
  const model = React.useMemo(() => new UseModel(), deps)

  React.useEffect(() => {
    return () => {
      unmounted.current = true
    }
  }, [])

  React.useEffect(() => {
    const update = () => {
      if (!unmounted.current) {
        forceUpdate({})
      }
    }

    model.watch('*', update, true)
    return () => {
      model.unwatch('*', update, true)
    }
  }, [model])

  return model
}

/**
 * use def, and return a connect function which contains only this namespace
 * @param {function|object} define
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
export function make(define) {
  const def = isFunction(define) ? define() : define
  const { name } = def
  use(def)
  return connect((contexts) => ({
    [name]: contexts[name],
  }))
}

/**
 *
 * @param {function} define
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
  return function(Component) {
    const callHook = (hook) => {
      if (isFunction(hook)) {
        hook()
      }
    }

    class TyshemoConnectedComponent extends React.Component {
      constructor(props) {
        super(props)
        this.state = {}
        this.update = () => {
          this.setState({})
        }
        this.init()
      }
      init() {
        const def = define()
        const { name } = def
        const { store, hooks, context } = create(def)

        this.$$ = {
          name,
          store,
          hooks,
          context,
        }

        callHook(hooks.onUse)
        callHook(hooks.onConnect)
        callHook(hooks.onInit)
      }
      componentDidMount() {
        const { store, hooks } = this.$$
        store.watch('*', this.update, true)
        callHook(hooks.onMount)
      }
      componentDidUpdate() {
        const { hooks } = this.$$
        callHook(hooks.onUpdate)
      }
      componentWillUnmount() {
        const { store, hooks } = this.$$
        store.unwatch('*', this.update)
        callHook(hooks.onUnmount)
        this.$$ = null
      }
      render() {
        const { name, context } = this.$$
        const { children, ...props } = this.props

        const connectedProps = name ? {
          [name]: context,
          ...props,
        } : {
          ...context,
          ...props,
        }

        return <Component {...connectedProps}>{children}</Component>
      }
    }

    return TyshemoConnectedComponent
  }
}

/**
 *
 * @param {function} define
 */
export function makeShared(define) {
  const memo = {
    store: null,
    hooks: null,
    context: null,
  }

  const free = () => {
    Object.assign(memo, {
      store: null,
      hooks: null,
      context: null,
    })
  }

  let count = 0

  return function(Component) {
    const callHook = (hook) => {
      if (isFunction(hook)) {
        hook()
      }
    }

    class TyshemoConnectedComponent extends React.Component {
      constructor(props) {
        super(props)
        this.state = {}
        this.update = () => {
          this.setState({})
        }
        this.init()
      }
      init() {
        // build def when not exist
        if (!memo.store || !memo.hooks || !memo.context) {
          const def = define()
          const { name } = def
          const { store, hooks, context } = create(def)
          Object.assign(memo, {
            store,
            hooks,
            context,
            name,
          })
          callHook(hooks.onUse)
          callHook(hooks.onConnect)
        }

        callHook(memo.hooks.onInit)

        count ++
      }
      componentDidMount() {
        memo.store.watch('*', this.update, true)
        callHook(memo.hooks.onMount)
      }
      componentDidUpdate() {
        callHook(memo.hooks.onUpdate)
      }
      componentWillUnmount() {
        memo.store.unwatch('*', this.update)
        callHook(memo.hooks.onUnmount)

        count --
        // ensure count >= 0
        if (count < 0) {
          count = 0
        }
        // free memory
        // use a timeout to wait for possible route redirect
        setTimeout(() => {
          if (count <= 0) {
            free()
          }
        }, 100)
      }
      render() {
        const { children, ...props } = this.props

        const { name, context } = memo
        const connectedProps = name ? {
          [name]: context,
          ...props,
        } : {
          ...context,
          ...props,
        }

        return <Component {...connectedProps}>{children}</Component>
      }
    }

    return TyshemoConnectedComponent
  }
}
