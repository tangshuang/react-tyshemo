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

To create a namespace state.

```js
use({
  // should be unique, will be used only the first time
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
    onConnect(names) {},

    // after connected Component created
    onCreate(TyshemoConnectedComponent)

    // after TyshemoConnectedComponent initialized
    onInit(TyshemoConnectedComponent) {},

    // when TyshemoConnectedComponent componentDidMount
    onMount(TyshemoConnectedComponent) {},

    // when TyshemoConnectedComponent componentDidUpdate
    onUpdate(TyshemoConnectedComponent) {},

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
One `def` (same namespace) can be `use` only once.

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
 * @param {object} contexts the whole state, each context owns a state and methods of the namespace
 */
const mapToProps = (contexts) => {
  const { namespace } = contexts
  const { name, age, growAge } = namespace
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

Tyshemo Store state in store is mutable, does not like Redux, you should always change the state to trigger UI rerender.

*The best practice is create methods in state def, and invoke methods in components.*

```js
const mapToProps = (contexts) => {
  const { namespace } = contexts
  return {
    namespace,
  }
}
```

```js
function MyComponent(props) {
  const { namespace } = props
  const { name, age, growAge } = namespace
  // invoke `growAge()` to change state
  // ...
  return <span onClick={() => growAge()}>{namespace.age}</span>
}
```

Here you use state properties values, you do not have the ability to change state value, you should must invoke a method to trigger change.

However, namespace state is a reactive object, so that you can change the object's properties directly:

```js
function MyComponent(props) {
  const { namespace } = props
  // invoke `namespace.age ++` to change state
  // ...

  return <span onClick={() => namespace.age ++}>{namespace.age}</span>
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

*It is not recommanded to invoke `dispatch` in components directly.*

## Scoped Dependencies

When you use `connect` to wrap a component, it is dependent on the state namespaces which you called in `mapToProps` to rerender. For example:

```js
const mapToProps = (contexts) => {
  const { state1, state2, state3 } = contexts
  const { methods3 } = state3
  return {
    state1,
    state2,
    methods3,
  }
}
```

In the previous code, we only used `state1` `state2` `state3`, so only these state namespaces changes, the component will rerender, other state spaces changes in other components will have no affects on this component.

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

## Local state

Use vue's state management, use react's UI render. If you want to taste replacing vue's template with react, do like this:

```js
import { makeLocal } from 'react-tyshemo'

// vue's template
class MyComponent extends React.Component {
  render() {
    const { name, age, height, updateAge } = this.props
    return (
      <span onClick={updateAge}>{name} {age} {height}</span>
    )
  }
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

**makeLocal(define: Function): Function**

`makeLocal` is used to create a wrapper for local state injection. Some times, you do not need to register state to global, you just want to make it work for local component, then you should use `makeLocal`.

It receive a `define` function which return the state `def`.

Notice that, hooks are run not like `make`, because all things come after component initialized. So, the best practice is only use hooks from `onInit` to `onUmount`.

The `name` of return `def` makes sense. When you give a `name` property, the state will patch to props with namespace, if not, the state will patch to props with properties.

```js
function define() {
  return {
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
    name: 'somebody',
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

And `define` function receive `props` of the component, so that you can use the `props` to generate state.