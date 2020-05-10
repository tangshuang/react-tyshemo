# React-Tyshemo

A react state managemenet controller drived by tyshemo.

## Install

```
npm i react-tyshemo
```

## API

```js
import { use, connect } from 'react-tyshemo'
```

### use(def)

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

Use `use` in a global file, or in business components when you need.
One namespace can only be `use` once.

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

### make(def)

make = use + connect

```js
const connect = make(def)
export default connect(MyComponent)
```

The store is on a named prop, try it to find out.

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

## Local/Shared State/Model

In sometimes, you may want to create a local state only for current component.

### useLocal(define: Function, deps = [])

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

export default function MyComponent() {
  const model = useLocal((Model) => {
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
function define(Model) {
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
