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
  define,
} from 'ts-fns'

const _stores = {}
const _hooks = {}
const _contexts = {}

const _observers = []

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

const createOfModel = (GivenModel) => {
  class Model extends GivenModel {
    dispatch(key, fn) {
      return createDispatch(this.$store)(key, fn)
    }
  }

  const model = new Model()
  const store = model.$store
  const context = model

  return { model, store, context }
}

const createOfDef = (def) => {
  const {
    state: givenState = {},
    computed = {},
    methods: givenMothods = {},
    hooks: givenHooks = {},
    watch = {},
  } = def

  const store = new Store(givenState)
  const { state } = store

  // computed
  each(computed, (compute, key) => {
    store.define(key, compute)
  })

  // context
  const methods = {}
  const context = new Proxy(state, {
    get(_, key) {
      if (methods[key]) {
        return methods[key]
      }
      else {
        return state[key]
      }
    },
    set(_, key, value) {
      if (methods[key]) {
        return false
      }
      else {
        state[key] = value
        return true
      }
    },
    deleteProperty(_, key) {
      if (key in state) {
        delete state[key]
        return true
      }
      else {
        return false
      }
    },
  })
  // patch $methods
  define(methods, 'dispatch', {
    value: createDispatch(store),
  })
  each(givenMothods, (fn, key) => {
    methods[key] = fn.bind(context)
  })

  /**
   * propagation of models
   */
  store.observe(
    // the submodel of a parent model will propagate to the parent model, so we do not need to observe them
    v => isInstanceOf(v, Model) && !v.$parent,
    v => dispatch => v.watch('*', dispatch, true),
    v => dispatch => v.unwatch('*', dispatch),
  )

  // hooks
  const hooks = map(givenHooks, fn => fn.bind(context))

  // watch
  each(watch, (fn, key) => {
    store.watch(key, fn.bind(context), true)
  })

  return { store, methods, hooks, context }
}

const create = (define) => {
  let { name } = define
  name = name || Symbol()

  if (isFunction(define)) {
    const res = define()
    if (isInheritedOf(res, Model)) {
      const { model, store, context } = createOfModel(res)
      return { name, model, store, context }
    }
    else {
      const def = createOfDef(res)
      const { store, context, methods, hooks } = def

      if (def.name) {
        name = def.name
      }

      return { name, store, context, methods, hooks }
    }
  }
  else {
    const { store, context, methods, hooks } = createOfDef(define)
    return { name, store, context, methods, hooks }
  }
}

const createWatcher = (name) => {
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
export function use(define, fallback) {
  const { name, store, hooks, context } = create(define)

  // has been registered
  if (_stores[name]) {
    if (isFunction(fallback)) {
      fallback(name)
    }
    return name
  }

  // register
  _stores[name] = store
  _hooks[name] = hooks
  _contexts[name] = context

  // subscribe
  store.watch('*', createWatcher(name), true)

  // onUse
  if (hooks.onUse) {
    hooks.onUse()
  }

  return name
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
  const namespace = React.useRef('')

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
    const { name, context, hooks, store } = create(define)

    callHook(hooks, 'onUse')
    callHook(hooks, 'onConnect')
    callHook(hooks, 'onInit')

    /**
     * patch current store to global _stores, so that we can use `subscribe` to record the changes of this store
     * there is no need to patch to contexts and hooks
     */

    namespace.current = name
    _stores[name] = store
    store.watch('*', createWatcher(name), true)

    return { context, hooks, store }
  }, deps)

  // mount
  // unmount
  React.useEffect(() => {
    mounted.current = true
    callHook(hooks, 'onMount')

    return () => {
      const name = namespace.current
      delete _stores[name]
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
    const store = _stores[name]
    if (!store) {
      throw new Error(`ReactTyshemo: global ${name} has not been registered when useGlobal(${name}).`)
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
 * const connect = makeGlobal({
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
export function makeGlobal(define, merge) {
  const name = use(define)
  return connect(
    // dep collect, map
    (contexts) => ({
      context: contexts[name],
    }),
    // merge props
    (mappedProps, ownProps) => {
      const { context } = mappedProps
      if (isFunction(merge)) {
        return merge(context, ownProps)
      }
      else {
        return { [name]: context, ...ownProps }
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
        const { store, hooks, context, name: prop } = create(define)
        const name = Symbol('local:' + prop)

        callHook(hooks, 'onUse')
        callHook(hooks, 'onConnect')
        callHook(hooks, 'onInit')

        // patch to global stores
        // there is no need to patch contexts and hooks
        _stores[name] = store
        store.watch('*', createWatcher(name), true)

        this.$$ = { name, store, hooks, context, prop }
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
        const { store, hooks, name } = this.$$
        store.unwatch('*', this.update)
        callHook(hooks, 'onUnmount')
        delete _stores[name]
        this.$$ = null
      }
      render() {
        const { prop, context } = this.$$
        const { children, ...props } = this.props

        let mergedProps = null
        if (isFunction(merge)) {
          mergedProps = merge(context, props)
        }
        else {
          mergedProps = { [prop]: context, ...props }
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
  const name = Symbol('shared:' + define.name)

  const free = () => {
    Object.assign(memo, {
      store: null,
      hooks: null,
      context: null,
      prop: '',
    })
    delete _stores[name]
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
          const { store, hooks, context, name: prop } = create(define)
          Object.assign(memo, {
            store,
            hooks,
            context,
            prop,
          })
          callHook(hooks, 'onUse')
          callHook(hooks, 'onConnect')

          /**
           * patch current store to global _stores, so that we can use `subscribe` to record the changes of this store
           */

          _stores[name] = store
          store.watch('*', createWatcher(name), true)
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
        const { prop, context } = memo
        const { children, ...props } = this.props

        let mergedProps = null
        if (isFunction(merge)) {
          mergedProps = merge(context, props)
        }
        else {
          mergedProps = { [prop]: context, ...props }
        }

        return <Component {...mergedProps}>{children}</Component>
      }
    }

    return TyshemoConnectedComponent
  }
}
