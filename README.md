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
    onCreate(ConnectedComponent)

    // after ConnectedComponent initialized
    onInit(componentInstance) {},

    // when ConnectedComponent componentDidMount
    onMount(componentInstance) {},

    // when ConnectedComponent componentWillUnmount
    onUnmount(componentInstance) {},

    // when ConnectedComponent render
    // @param Component is the real component to render which is wrapped in ConnectedComponent
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
  const { statename, growAge } = props

  return (
    <>
      <span>Age: {statename.age}</span>
      <span>Height: {statename.height}</span>
      <span onClick={growAge}>Grow</span>
      <span onClick={() => statename.age ++}>Grow</span>
    </>
  )
}

/**
 * @param {object} state the whole state in react-tyshemo, one application will own only one state, all data are here
 * @param {object} methods the set of methods for all state space
 */
const mapToProps = (state, methods) => {
  const { statename } = state
  const { growAge } = methods.statename
  return {
    statename,
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
const mapToProps = (state, methods) => {
  const { statename } = state
  const { growAge } = methods.statename
  return {
    ...statename,
    growAge,
  }
}

function MyComponent(props) {
  const { name, age } = props
  // here you use state properties values, you do not have the ability to change state value,
  // > const { growAge } = props
  // > growAge()
  // the only way is to invoke methods functions
  // the best way is pass an object part of state, so that you can change the object's properties
  // > const { somestate } = props
  // > somestate.age ++
  // ...
}
```

Sometimes, you change a normal instance of some Class, it is not able to dispatch changes.
How to resolve it? We provide a method to rerender your UI:

```js
function MyComponent(props) {
  const { updateRender } = props

  class Some {}
  const some = new Some()

  const { somestate } = props
  somestate.some = some

  some.a = 1 // this will not dispatch changes into store

  updateRender() // update
  // updateRender(true) // force update
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
