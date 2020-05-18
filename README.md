# React-Tyshemo

A react state managemenet which is drived with [tyshemo](https://github.com/tangshuang/tyshemo) Store.
Enjoy global shared mutable state management amoung components, without any complext reducer codes, without

## Install

```
npm i react-tyshemo
```

## API

```js
import { use, connect } from 'react-tyshemo'
```

### use(define: object|Function): boolean

To register a namespace store in global scope.

```js
use({
  // should be unique, same namespace will only be registered at the first time
  name: 'namespace',

  // default state
  state: {
    name: 'xxx',
    age: 10,
  },

  // computed properties, will be cached util dependencies change
  computed: {
    height() {
      return this.age * 5
    },
  },

  // functions to operate state
  methods: {
    growAge() {
      // change state directly
      // works in async function await sentence
      this.age ++
    },
  },

  // watchers to watch properties change, the functions will be executed after the properteis change
  watch: {
    age({ value }) {
      if (value > 22) {
        // notice, change state may cause other watchers, so be careful to do this
        this.married = true
      }
    },
  },

  // hook functions to do in certain moment
  // you can call `this` in hook functions to point to state context
  hooks: {
    // after def be used
    // always, you do need to request some data by ajax to fill state in this hook
    onUse() {},

    // after this state space be used to connect to a React component
    onConnect() {},

    // after TyshemoConnectedComponent initialized
    onInit() {},

    // when TyshemoConnectedComponent componentDidMount
    onMount() {},

    // when TyshemoConnectedComponent componentDidUpdate
    onUpdate() {},

    // when TyshemoConnectedComponent componentWillUnmount
    onUnmount() {},
  },
})
```

If you pass a function, it should return an object whose structure is the same as previous.
It is recommended to pass a function, so that you can share the function any where.

Use `use` in a global file, or in business components when you need.
One namespace can only be `use` once.

`user` returns `true` or `false`, if `false`, it means the same named store has been registed before, dont register again.

### connect(mapToProps: Function, mergeToProps?: Function): Function

Connect a component with registered stores.

```js
function MyComponent(props) {
  const { name, age, growAge } = props

  return (
    <>
      <span>Age: {age}</span>
      <span>Height: {height}</span>
      <span onClick={growAge}>Grow</span>
    </>
  )
}

/**
 * @param {object} stores the whole state, each context owns a state and methods of the namespace
 */
const mapToProps = (stores) => {
  const {
    some, // this store's namespace is `some`
  } = stores
  const { name, age, growAge } = some
  return {
    name,
    age,
    growAge,
  }
}

/**
 * create final props to pass into component
 */
const mergeToProps = (mappedProps, ownProps) => {
  return {
    ...mappedProps,
    ...ownProps,
  }
}

export default connect(mapToProps, mergeToProps)(MyComponent)
```

### getState()

Get whole combined state of all stores.

### subscribe(fn: Function): Function

Subscribe to changes in the state. When any change happens in state, the function `fn` will be invoke.
It returns a `unsubscribe` function.

```js
const unsubscribe = subscribe(fn)
/// ...
unsubscribe()
```

*Notice, subscribe will return all changes which contains local stores' and shared stores' changes, the difference is there is a 'local:' or 'shared:' prefix at the begin of namespace, so that you can replay the 'local' and 'shared' state changes anytime.*

## Make Functions

I provide several make functions to create connect functions.

### make(def)

make = use + connect

```js
const connect = make(def)
export default connect(MyComponent)
```

The store is on a named prop, try it to find out.

### makeLocal(define: Function): Function

Use vue's state management, use react's UI render. If you want to taste replacing vue's template with react, do like this:

```js
import { makeLocal } from 'react-tyshemo'

// vue's template
function MyComponent(props) {
  const { name, age, height, updateAge } = props
  return (
    <span onClick={updateAge}>{name} {age} {height}</span>
  )
}

// vue's script
function define() {
  return {
    state: {
      name: 'tomy',
      age: 10,
    },
    computed: {
      height() {
        return this.age * 5
      },
    },
    methods: {
      updateAge() {
        this.age ++
      },
    },
    hooks: {
      onInit() {
        this.age = 11
      },
    },
  }
}

export default makeLocal(define)(MyComponent)
```

`makeLocal` is used to create a wrapper function (like `connect` does) for local state injection. Some times, you do not need to register state to global, you just want to make it work for local component, then you should use `makeLocal`.

- define: function, It receive a `define` function which return the state `def`.

The `name` of return `def` makes sense. When you give a `name` property, the state will patch to props with namespace, if not, the state will patch to props with properties.

```js
function define() {
  return {
    // there is no name
    state: {
      age: 0,
    }
  }
}

function MyComponent(props) {
  const { age } = props
}
```

```js
function define() {
  return {
    name: 'somebody', // there is name
    state: {
      age: 10,
    },
  }
}

function MyComponent(props) {
  const { somebody } = props
  const { age } = somebody
}
```

`define` support to return a Model like `useLocal` do. However, if you want to name it, you can return an object like this:

```js
import { Model } from 'tyshemo'

function define() {
  class MyModel extends Model {
    static name = {
      default: 'tomy',
    }

    static age = {
      default: 10,
      getter: v => v + '',
      setter: v => +v,
    }

    updateAge() {
      this.age ++
    }
  }
  return {
    name: 'some', // use a `name` property to make name works
    model: MyModel,
  }
}
```

### makeShared(define: Function): Function

`makeLocal` only works for the wrapped component, the store will be destory when the component unmounts. `makeShared` works for multiple wrapped *live* components.

```js
const wrap = makeShared(define)

const ComponentA = wrap(A)
const ComponentB = wrap(B)
```

Now `ComponentA` and `ComponentB` will share the same store during the components are living. When all components unmount (die), the store will be destoried. If some of them mount again, a new store will be created.

## Hooks

I know you are more interested in using react hooks in Functional Components. `react-tyshemo` provides several hooks.

### useObserver(subscribe, unsubscribe?)

This is a helper hook function which help you observe some reactive object to rerender.

```js
function MyComponent(props) {
  const { reactiveObject } = props

  useObserver(
    dispatch => reactiveObject.on('change', dispatch), // when reactiveObject changes inside, the component will rerender
    dispatch => reactiveObject.off('change', dispatch), // when the component will unmount, this function will run to free memory reference
  )

  /// ....
}
```

If subscribe function return a function, we will run this function before `unsubscribe`. And `unsubscribe` is optional, so in some system, you can use the return function as unsubscribe function.

```js
useObserver(dispatch => some.watch('a', dispatch)) // watch will return unwatch function
```

If you get a store or a model instance, you do not need to pass subscribe/unsubscribe function, just pass the store or the model.

```js
function MyComponent(props) {
  const { model } = props

  useObserver(model)

  /// ....
}
```

It will subscribe and unsubscribe automaticly.

This hook function can not only be used with store and model, but also with any reactive system.

### useLocal(define: Function, deps = [])

In sometimes, you may want to create a local state only for current component.
To use hook function, we provide `useLocal`.

```js
import { useLocal } from 'react-tyshemo'

export default function MyComponent() {
  const store = useLocal(() => {
    return {
      // name is not needed
      state: {
        name: 'tomy',
        age: 10,
      },
      methods: {
        updateAge() {
          this.age ++
        },
      },
    }
  })

  return (
    <span onClick={store.updateAge}>{some.name}: {some.age}</span>
  )
}
```

- define: function, which is to return a store def. `name` property will have no effect.
- deps: array, when any one value of `deps` changes, the store will be rebuilt, `deps` is passed into `useMemo`

In sometimes, you do need a Model, not a store, you should do like this:

```js
import { useLocal } from 'react-tyshemo'
import { Model } from 'tyshemo'

export default function MyComponent() {
  const model = useLocal(() => {
    class MyModel extends Model {
      static name = {
        default: 'tomy',
      }

      static age = {
        default: 10,
        getter: v => v + '',
        setter: v => +v,
      }

      updateAge() {
        this.age ++
      }
    }
    // return Model directly, don't initialize it
    return MyModel
  })

  // however, now you receive a instance of MyModel
  return (
    <span onClick={model.updateAge}>{model.name}: {model.age}</span>
  )
}
```

### useGlobal(define|def|name)

React hook function to use a store which is registered globally.

- define: a function return def object, the same behaviour with `def`
- def: a def object, if namespace exist, return the store directly, or it registers the store and return it
- name: when you pass a name, it means you have registered the namespace store globally

```js
function define() {
  return {
    name: 'my-store',
    // if 'my-store' has been registered, you will get the registered store, this state will have no effects
    // if not registered, this will be used as default state
    state: {
      a: 1,
      b: 2,
    },
  }
}

function MyComponent(props) {
  const store = useGlobal(define)
}
```

```js
const def = {
  name: 'my-store',
  // if 'my-store' has been registered, you will get the registered store, this state will have no effects
  // if not registered, this will be used as default state
  state: {
    a: 1,
    b: 2,
  },
}

function MyComponent(props) {
  const store = useGlobal(def)
}
```

```js
use({
  name: 'my-store',
  state: {},
})

function MyComponent(props) {
  const store = useGlobal('my-store') // if 'my-store' is not registed by `use`, you will get `undefined`
}
```

It is NOT recommended to use `name`, this make code dispersed, you may not know where was a store registered. It is best to use `connect`.

## Mutable State

Tyshemo state in store is mutable, does not like Redux, you should always change the state to trigger UI rerender.

*The best practice is to create methods in store def, and invoke methods in components.*

```js
const mapToProps = (stores) => {
  const { some } = stores
  return {
    some,
  }
}
```

```js
function MyComponent(props) {
  const { some } = props
  const { name, age, growAge } = some
  // invoke `growAge()` to change state
  // ...
  return <span onClick={() => growAge()}>{some.age}</span>
}
```

Here you use state properties values, you do not have the ability to change state value, you should must invoke a method to trigger change.

However, namespace state is a reactive object, so that you can change the object's properties directly:

```js
function MyComponent(props) {
  const { some } = props
  // invoke `some.age ++` to change state
  // ...

  return <span onClick={() => some.age ++}>{some.age}</span>
}
```

Now, you do not need to write a `growAge` method.
However, the best practice is to create methods, to change state in methods and to invoke methods in components, so that you know where the state changes.

**If not reactive data**

Sometimes, you change a normal instance of some Class, it is not able to dispatch changes. For example:

```js
class Some {}
const some = new Some()

somestate.some = some

some.a = 1 // this will not dispatch changes, because some is not reactive
```

How to resolve it? We provide a specail method `dispatch`:

```js
use({
  name: 'namespace',
  state: {
    some: null,
  },
  method: {
    updateSome(data) {
      if (data instanceof Some) {
        this.some = data
      }
      else if (this.some) {
        Object.assign(this.some, data)
      }
      else {
        this.some = data
      }

      // here, you should use `dispatch`
      // it receive the keyPath to notify store to trigger changes,
      // or you can pass empty to dispatch like: this.dispatch() to notify the whole state change
      // the change will cause rerender
      this.dispatch('some')
    },
  },
})
```

Then in component:

```js
function MyComponent(props) {
  const { some } = props
  const a = new Some()
  some.updateSome(a)
}
```

*It is NOT recommanded to invoke `dispatch` in components directly.*

## Scoped Dependencies

When you use `connect` to wrap a component, it is dependent on the namespaces which you called in `mapToProps` to rerender. For example:

```js
const mapToProps = (stores) => {
  const { store1, store2, store3 } = stores
  return {
    store1,
    store1,
    store3,
  }
}
```

In the previous code, we only used `store1` `store1` `store3`, so only these stores' states change, the component will rerender, other stores' changes will have no affect on this component.

## Replay

```js
// record
import Recorder from 'xxx-your-recorder-lib-xxx'
import { subscribe } from 'react-tyshemo'

// use subscribe to record each change in store
// -name: store's namespace
// -key: array, the keyPath of changed node
// -value: the next value of this key
subscribe((name, key, value) => {
  Recorder.record({ name, key, value })
})
```

```js
// replay
import Recorder from 'xxx-your-recorder-lib-xxx'
import { getState } from 'react-tyshemo'
import { assign } from 'ts-fns'

const state = getState()
Recorder.replay((item) => {
  const { name, key, value } = item
  const space = state[name]
  // assign recorded value back into state
  assign(space, key, value)
})
```

However, you should notice that, if you want to send your recorded data to server side, instance of Class will bring up trouble. We do not resolve this, you should do it by your self.

## TySheMo

> Tyshemo is a javascript runtime data type checking system and morden reactive state management model.

If you want to use Model, you have to import tyshemo package, [read documents about tyshemo](https://tyshemo.js.org/).
