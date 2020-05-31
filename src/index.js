import React from 'react'
import { Store, Model } from 'tyshemo'
import {
  each,
  filter,
  isInstanceOf,
  isFunction,
  parse,
  map,
  isString,
  isInheritedOf,
  isObject,
  createRandomString,
  define,
} from 'ts-fns'

const _stores = {}
const _hooks = {}
const _contexts = {}

const _observers = []

function create(def) {
  const {
    name,
    model,
    state,
    computed = {},
    methods = {},
    hooks = {},
    watch = {},
  } = def

  let $store, $model, $context

  const createDispatch = (store) => (key, fn) => {
    fn = isFunction(key) ? key : fn
    key = isString(key) ? key : ''

    const { data, state } = store

    const prev = parse(data, key)
    const invalid = parse(state, key)

    if (fn) {
      fn()
    }

    const value = parse(data, key)
    const next = value
    const active = parse(state, key)
    store.dispatch(key, {
      value,
      next,
      prev,
      active,
      invalid,
    }, true)
  }

  /**
   * if model is return, state, computed, methods will not work
   * model should be a class extended from Model
   *
   */
  if (model && isInheritedOf(model, Model)) {
    $model = new model()
    $store = $model.$store
    $context = $model

    define($model, 'dispatch', {
      value: createDispatch($store),
    })

    // bind methods with model
    // make it enumerable on instance so that we can use descontruction
    const protos = model.prototype
    const keys = Object.getOwnPropertyNames(protos)
    keys.forEach((key) => {
      const proto = protos[key]
      if (!isFunction(proto)) {
        return
      }
      if (key === 'constructor' || key === 'init') {
        return
      }
      if (key.indexOf('on') === 0) {
        return
      }
      define($model, key, {
        value: proto.bind($model),
        enumerable: true,
      })
    })
  }
  else if (state) {
    $store = new Store(state)

    const $state = $store.state

    // computed
    each(computed, (compute, key) => {
      $store.define(key, compute)
    })

    // context
    const $methods = {}
    $context = new Proxy({}, {
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
    // patch $methods
    define($methods, 'dispatch', {
      value: createDispatch($store),
    })
    each(methods, (fn, key) => {
      $methods[key] = fn.bind($context)
    })

    /**
     * propagation of models
     */
    $store.observe(
      // the submodel of a parent model will propagate to the parent model, so we do not need to observe them
      v => isInstanceOf(v, Model) && !v.$parent,
      v => dispatch => v.watch('*', dispatch, true),
      v => dispatch => v.unwatch('*', dispatch),
    )
  }

  // hooks
  const $hooks = map(hooks, fn => fn.bind($context))

  // watch
  each(watch, (fn, key) => {
    $store.watch(key, fn.bind($context), true)
  })

  return {
    name,
    model: $model,
    store: $store,
    hooks: $hooks,
    context: $context,
  }
}

function createDispatch(name) {
  const dispatch = ({ key, value }) => {
    if (_observers.length) {
      _observers.forEach((fn) => {
        fn(name, key, value)
      })
    }
  }
  return dispatch
}

/**
 *
 * @param {object|function} define
 * @param {string} def.name the key of namespace in the whole state, for example, when name is 'some', you can get this local store by state.some or store.get('some')
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
 * export default connect((stores) => {
 *   const { myState } = stores
 *   const { some, updateSome } = myState
 *   return {
 *     some,
 *     myState,
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

  const { store, hooks, context } = create(def)

  // register
  _stores[name] = store
  _hooks[name] = hooks
  _contexts[name] = context

  // subscribe
  store.watch('*', createDispatch(name), true)

  // onUse
  if (hooks.onUse) {
    hooks.onUse()
  }

  return true
}

/**
 *
 * @param {function} mapToProps
 *  - state the whole state of tyshemo-react
 *  - props the original props received by component
 *  - return: props to pass to component
 * @param {function} mergeToProps
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
 * local store, create when component create, destory when component unmount
 * @param {function} define store changes when deps changes
 */
export function useLocal(define, deps = []) {
  const [, update] = React.useState()
  const mounted = React.useRef(false)
  const unmounted = React.useRef(false)
  const namespace = React.useRef('local:' + createRandomString(8))

  const callHook = React.useCallback((hooks, fn) => {
    if (!hooks) {
      return
    }

    const hook = hooks[fn]
    if (isFunction(hook)) {
      hook()
    }
  }, [])

  const forceUpdate = React.useCallback(() => {
    if (!unmounted.current) {
      update({})
    }
  }, [])

  const { context, hooks, store } = React.useMemo(() => {
    let def = define()

    if (isInheritedOf(def, Model)) {
      def = { model: def }
    }

    const { context, hooks, store } = create(def)

    callHook(hooks, 'onUse')
    callHook(hooks, 'onConnect')
    callHook(hooks, 'onInit')

    /**
     * patch current store to global _stores, so that we can use `subscribe` to record the changes of this store
     */

    const space = namespace.current
    _stores[space] = store
    store.watch('*', createDispatch(space), true)

    return { context, hooks, store }
  }, deps)

  // mount
  // unmount
  React.useEffect(() => {
    mounted.current = true
    callHook(hooks, 'onMount')

    return () => {
      const space = namespace.current
      delete _stores[space]
      unmounted.current = true
      callHook(hooks, 'onUnmount')
    }
  }, [])

  // watch
  React.useEffect(() => {
    store.watch('*', forceUpdate, true)

    return () => {
      store.unwatch('*', forceUpdate, true)
    }
  }, [store])

  // update
  React.useEffect(() => {
    if (mounted.current) {
      callHook(hooks, 'onUpdate')
    }
  })

  return context
}

/**
 * use hook
 * @param {*} name
 */
export function useGlobal(name) {
  const [, update] = React.useState()
  const mounted = React.useRef(false)
  const unmounted = React.useRef(false)

  const callHook = React.useCallback((hooks, fn) => {
    if (!hooks) {
      return
    }

    const hook = hooks[fn]
    if (isFunction(hook)) {
      hook()
    }
  }, [])

  const forceUpdate = React.useCallback(() => {
    if (!unmounted.current) {
      update({})
    }
  }, [])

  const { context, hooks, store } = React.useMemo(() => {
    if (isFunction(name)) {
      const def = name()
      use(def)
      name = def.name
    }
    else if (isObject(name)) {
      use(name)
      name = name.name
    }

    const store = _stores[name]

    if (!store) {
      return {} // make descontruct work, don't throw error
    }

    const context = _contexts[name]
    const hooks = _hooks[name]

    callHook(hooks, 'onConnect')
    callHook(hooks, 'onInit')

    return { context, hooks, store }
  }, [])

  // mount
  // unmount
  React.useEffect(() => {
    mounted.current = true
    callHook(hooks, 'onMount')

    return () => {
      unmounted.current = true
      callHook(hooks, 'onUnmount')
    }
  }, [])

  // watch
  React.useEffect(() => {
    // the passed name store may not exist
    if (!store) {
      return
    }

    store.watch('*', forceUpdate, true)

    return () => {
      store.unwatch('*', update, true)
    }
  }, [store])

  // update
  React.useEffect(() => {
    if (mounted.current) {
      callHook(hooks, 'onUpdate')
    }
  })

  return context
}

/**
 *
 * @param {*} subscribe
 * @param {*} unsubscribe
 */
export function useObserver(subscribe, unsubscribe, deps = []) {
  // subscribe store or model directly
  if (isInstanceOf(subscribe, Store) || isInstanceOf(subscribe, Model)) {
    const reactive = subscribe
    useObserver(
      dispatch => reactive.watch('*', dispatch, true),
      dispatch => reactive.unwatch('*', dispatch),
      [reactive],
    )
    return
  }

  const [, update] = React.useState()
  React.useEffect(() => {
    const forceUpdate = () => update({})
    const _unsubscribe = subscribe(forceUpdate)
    return () => {
      if (isFunction(_unsubscribe)) {
        _unsubscribe()
      }
      if (unsubscribe) {
        unsubscribe(forceUpdate)
      }
    }
  }, deps)
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
export function make(define, merge) {
  const def = isFunction(define) ? define() : define
  const { name } = def

  if (!name) {
    def.name = createRandomString(8)
  }
  use(def)

  return connect(
    // dep collect, map
    (stores) => ({
      store: stores[def.name],
    }),
    // merge props
    (mappedProps, ownProps) => {
      const { store } = mappedProps
      if (isFunction(merge)) {
        return merge(store, ownProps)
      }
      else if (name) {
        return { [name]: store, ...ownProps }
      }
      else {
        return { ...store, ...ownProps }
      }
    },
  )
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
export function makeLocal(define, merge) {
  return function(Component) {
    const callHook = (hooks, fn) => {
      if (!hooks) {
        return
      }

      const hook = hooks[fn]
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
        const { store, hooks, context, name } = create(def)

        callHook(hooks, 'onUse')
        callHook(hooks, 'onConnect')
        callHook(hooks, 'onInit')

        // patch to global stores
        const space = 'local:' + createRandomString(8)
        _stores[space] = store
        store.watch('*', createDispatch(space), true)

        this.$$ = { name, store, hooks, context, space }
      }
      componentDidMount() {
        const { store, hooks } = this.$$
        store.watch('*', this.update, true)
        callHook(hooks, 'onMount')
      }
      componentDidUpdate() {
        const { hooks } = this.$$
        callHook(hooks, 'onUpdate')
      }
      componentWillUnmount() {
        const { store, hooks, space } = this.$$
        store.unwatch('*', this.update)
        callHook(hooks, 'onUnmount')
        delete _stores[space]
        this.$$ = null
      }
      render() {
        const { name, context } = this.$$
        const { children, ...props } = this.props

        let mergedProps = null
        if (isFunction(merge)) {
          mergedProps = merge(context, props)
        }
        else if (name) {
          mergedProps = { [name]: context, ...props }
        }
        else {
          mergedProps = { ...context, ...props }
        }

        return <Component {...mergedProps}>{children}</Component>
      }
    }

    return TyshemoConnectedComponent
  }
}

/**
 *
 * @param {function} define
 */
export function makeShared(define, merge) {
  const memo = {}
  const space = 'shared:' + createRandomString(8)

  const free = () => {
    Object.assign(memo, {
      store: null,
      hooks: null,
      context: null,
      name: '',
    })
    delete _stores[space]
  }

  // init
  free()

  let count = 0

  return function(Component) {
    const callHook = (hooks, fn) => {
      if (!hooks) {
        return
      }

      const hook = hooks[fn]
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
        if (!memo.store && !memo.hooks && !memo.context) {
          const def = define()
          const { store, hooks, context, name } = create(def)
          Object.assign(memo, {
            store,
            hooks,
            context,
            name,
          })
          callHook(hooks, 'onUse')
          callHook(hooks, 'onConnect')

          /**
           * patch current store to global _stores, so that we can use `subscribe` to record the changes of this store
           */

          _stores[space] = store
          store.watch('*', createDispatch(space), true)
        }

        callHook(memo.hooks, 'onInit')

        count ++
      }
      componentDidMount() {
        const { store, hooks } = memo
        store.watch('*', this.update, true)
        callHook(hooks, 'onMount')
      }
      componentDidUpdate() {
        callHook(memo.hooks, 'onUpdate')
      }
      componentWillUnmount() {
        const { store, hooks } = memo
        store.unwatch('*', this.update)
        callHook(hooks, 'onUnmount')

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
        const { name, context } = memo
        const { children, ...props } = this.props

        let mergedProps = null
        if (isFunction(merge)) {
          mergedProps = merge(context, props)
        }
        else if (name) {
          mergedProps = { [name]: context, ...props }
        }
        else {
          mergedProps = { ...context, ...props }
        }

        return <Component {...mergedProps}>{children}</Component>
      }
    }

    return TyshemoConnectedComponent
  }
}
