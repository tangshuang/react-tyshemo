# React-Tyshemo

A react state manager drived by tyshemo.

## Install

```
npm i react-tyshemo
```

## API

```js
import { use, connect } from 'react-tyshemo'
```

### use(def)

To create a state space.

```js
use({
  // should be unique, will be used only the first time
  name: 'statename',

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
    // after def be registered
    // always, you do need to request some data by ajax to fill state in this hook
    onUse() {},

    // after this state space be used to connect to a React component
    onConnect(names) {},

    // after connected Component created
    onCreate(TyshemoConnectedComponent)

    // after TyshemoConnectedComponent initialized
    onInit(TyshemoConnectedComponent) {},

    // when TyshemoConnectedComponent componentDidMount
    onMount(TyshemoConnectedComponent) {},

    // when TyshemoConnectedComponent componentWillUnmount
    onUnmount(TyshemoConnectedComponent) {},

    // when TyshemoConnectedComponent render
    // @param Component is the real component to render which is wrapped in TyshemoConnectedComponent
    // @param connectedProps is the merged props which pass into wrapped component
    onRender(Component, connectedProps) {},
  },
})
```

Use `use` in a global file, or in business components when you need.
One `def` (same space name) can be only `use` once.

### connect(mapToProps: Function, mergeToProps?: Function): Function

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
 * @param {object} contexts the whole state spaces, each context owns a space state and methods
 */
const mapToProps = (contexts) => {
  const { statename } = contexts
  const { name, age, growAge } = statename
  return {
    name,
    age,
    growAge,
  }
}

const mergeToProps = (mappedProps, ownProps) => {
  return {
    ...mappedProps,
    ...ownProps,
  }
}

export default connect(mapToProps, mergeToProps)(MyComponent)
```

### make(def)

make = use + connect

```js
const connect = make(def)
export default connect(MyComponent)
```

### getState()

Get whole state.

### subscribe(fn: Function): Function

Subscribe to changes in the state. When any change happens in state, the function `fn` will be invoke.
The return value is a unsubscribe function.

```js
const unsubscribe = subscribe(fn)
/// ...
unsubscribe()
```

## Mutable

ReactTyshemo does not like redux, state in store is mutable, you should always change the state to trigger UI rerender.

```js
const mapToProps = (contexts) => {
  const { statename } = contexts
  return {
    statename,
  }
}
```

```js
function MyComponent(props) {
  const { statename } = props
  const { name, age, growAge } = statename
  // invoke `growAge()` to change state
  // ...
  return <span onClick={() => growAge()}>{statename.age}</span>
}
```

Here you use state properties values, you do not have the ability to change state value, you should must invoke a method to trigger change.
However, tyshemo store state is a reactive object, so that you can change the object's properties directly:

```js
function MyComponent(props) {
  const { statename } = props
  // invoke `statename.age ++` to change state
  // ...

  return <span onClick={() => statename.age ++}>{statename.age}</span>
}
```

Now, you do not need to write a `growAge` method.
However, the best practice is create methods and change state in methods and invoke methods in components, so that you know where the state change.

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
  const { namespace } = props
  const some = new Some()
  namespace.updateSome(some)
}
```

## Scoped Dependencies

When you use `connect` to wrap a component, it is dependent on the state spaces which you called in `mapToProps` to rerender. For example:

```js
const mapToProps = (state, methods) => {
  const { state1, state2 } = state
  const methods3 = state.state3
  return {
    state1,
    state2,
    ...methods3,
  }
}
```

In the previous code, we only used `state1` `state2` `state3`, so only these state spaces changes, the component will rerender, other state spaces changes in other components will have no affects for this component.

## Replay

```js
// record
import Recorder from 'xxx-your-recorder-lib-xxx'
import { subscribe } from 'react-tyshemo'

// use subscribe to record each change in store
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
