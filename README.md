# React-Tyshemo

A react state managemenet which is drived with [tyshemo](https://github.com/tangshuang/tyshemo) Store.

Enjoy global shared mutable state management amoung components, without any complex reducer codes, without a force Provider component, without messy store files management, just code as want your think directly.

## Install

```
npm i react-tyshemo tyshemo
```

Notice, `tyshemo` is a peerDependence, you should must install it at the same time.

## API

```js
import { use, connect } from 'react-tyshemo'
```

### use(define: object|Function): boolean

To register a namespace store in global scope.

```js
use(define)
```

If `define` is an object, it should be like:

```js
const define = {
  // should be unique, same namespace will only be registered at the first time
  name: 'namespace',

  // default state
  state: {
    name: 'xxx',
    age: 10,
  },

  // computed properties, will be cached until dependencies change
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
}
```

If you pass a function, it should return an object whose structure is the same as previous.

```js
function define() {
  return {
    // ... some structure
  }
}
```

It is recommended to pass a function, so that you can share the function any where.

One namespace can only be `use` once. So, it doesn't matter whether use `use` in a global file or in business components when you need, the same namespace will be used only once.

`use` returns `true` or `false`, if `false`, it means the same name store has been registed before, it will not be registered again.

```js
if (use(define)) {
  console.log('registed, onUse hook has been run')
}
else {
  console.log('not work')
}
```

And you can return a Model in define function:

```js
import { Model } from 'tyshemo'
import { use } from 'react-tyshemo'

function define() {
  class SomeModel extends Model {
    static name = {
      default: 'luni',
    }
    static age = {
      default: 10,
    }
  }

  return {
    name: 'some',
    model: SomeModel, // notice `model` property
  }
}

use(define)
```

This `Model` is the same as [`Model` in tyshemo](https://tyshemo.js.org/#/model).
If a `model` property exists on return def object, `state` `computed` and `methods` of def object will not work.
However, model mode is different from store mode, especially when invoke `connect`, you should read the following parts and explore by yourself.

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

Methods of stores are auto bound, however, methods of models are not. Even, methods of models can not be descontructed, you should must bind them manually.

```js
const mapToProps = (stores) => {
  const {
    somemodel,
  } = stores

  // here, you can not use ...somemodel to get growAge, because growAge is on model's prototype
  const { name, age, growAge: _growAge } = somemodel
  // you should must bind methods of model by manually
  const growAge = _growAge.bind(somemodel)

  return {
    name,
    age,
    growAge,
  }
}
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

The given function receive three parameters:

```js
subscribe(function(name, key, value) {
  // name: string, the name property's value of a store
  // key: array|string, the keyPath of the changed property
  // value: any, the changed value
})
```

You can use subscribe to record changes of your application.

## Make Functions

I provide several make functions to create connect functions more quickly.

### make(define: object|Function, merge?: Function): Function

make = use + connect

- define: def object or a function return def object
- merge: function to the registered  merge store with component's own props

Unlike `mergeToProps` of `connect`, here `merge` receive the registered store, not the mappedProps.

```js
function MyComponent(props) {
  const { name, age, updateAge } = props
  // ...
}

export default make({
  state: {
    name: 'tomy',
    age: 10,
  },
  methods: {
    updateAge() {
      this.age ++
    }
  },
})(MyComponent)
```

This make it more quick to wrap a component.

Notice, here we did not given a name, this store is an anonymous global store, it can be used again only with this `wrap` function. Because there is no `name` property, the store will be desconstructed to props for the component. This rule works on all make functions (`makeLocal`, `makeShared`).

To registered a namespace store, pass `name` property.

```js
function MyComponent(props) {
  const { some } = props // store passed on `some` prop
  const { name, age } = some
  // ...
}

export default make({
  // this name will be registered in global space, which can be reused
  name: 'some',
  state: {
    name: 'luni',
    age: 10,
  }
})(MyComponent)
```

As you seen, the component will receive a prop with the name `some`. A named store will be patch to component on the named property.

However, in some case, you want to descontruct properties all by yourself. The second parameter `merge` works now.

```js
const wrap = make(
  {
    name: 'some',
    state: {
      name: 'luni',
      age: 10,
    }
  },
  // merge function:
  // - store: the registered store
  // - props: the received props of component
  (store, props) => {
    // no matter the store is an anonymous store or not, this store referer to the store instance
    return {
      ...store,
      ...props,
    }
  },
)

function MyComponent(props) {
  const { name, age } = props
  // ...
}

export default wrap(MyComponents)
```

If defined a model, the first parameter of `merge` will be the model. So you can do desconstructing in `merge` function like what you do in `connect`.

To make it more quick to define a Model, you can return the Model directly:

```js
function define() {
  class SomeModel extends Model {}
  return SomeModel // => { model: SomeModel } which is anonymous
}
const wrap = make(define, (model, props) => {
  // ...
})
```

This make it more quick to use a Model.

### makeLocal(define: Function, merge?: Function): Function

Use vue's state management, use react's UI render. If you want to taste replacing vue's template with react, do like this:

```js
import { makeLocal } from 'react-tyshemo'

// replace vue's template
function MyComponent(props) {
  const { name, age, height, updateAge } = props
  return (
    <span onClick={updateAge}>{name} {age} {height}</span>
  )
}

// like vue's script
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

The usage is almost same with `make`, only differences:

- only receive function as `define`
- the store/model will be destory when the component unmount, `onUse` hook will be invoked each time a component initialize

### makeShared(define: Function): Function

`makeLocal` only works for the wrapped component, the store will be destory when the component unmounts. `makeShared` works for multiple wrapped *live* components.

```js
const wrap = makeShared(define)

const ComponentA = wrap(A)
const ComponentB = wrap(B)
```

Now `ComponentA` and `ComponentB` will share the same store during the components are living. When all components unmount (die), the store will be destoried. If some of them mount again, a new store will be created.

The usage is almost same with `makeLocal`, only differences:

- the store/model will be initialized at the first time a component initialize, `onUse` hook will be invoked, other components which use this shared store/model will not trigger `onUse`
- the store/model will be destory when the last *live* component unmount in 100ms, if a component relive in this 100ms, the store/model will keep alive.

## React Hooks

I know you are more interested in using react hooks in Functional Components. `react-tyshemo` provides several hook functions.

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

In sometimes, you may want to create a local store only for current component.
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

1. define: function, which is to return a store def. `name` property will have no effect.
2. deps: array, when any one value of `deps` changes, the store will be rebuilt, `deps` is passed into `useMemo`

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

`define` function is the same usage with `makeLocal`.

### useGlobal(define|def|name)

React hook function to use a store which is registered globally.

- define: a function return def object, the same behaviour with `def`
- def: a def object, if namespace exist, return the store directly, or it registers the store and return it
- name: when you pass a name, it means you have registered the namespace store globally

```js
function MyComponent(props) {
  const store = useGlobal(function define() {
    return {
      name: 'my-store',
      // if 'my-store' has been registered, you will get the registered store, this state will have no effects
      // if not registered, this will be used as default state
      state: {
        a: 1,
        b: 2,
      },
    }
  })
}
```

```js
function MyComponent(props) {
  const store = useGlobal({
    name: 'my-store',
    // if 'my-store' has been registered, you will get the registered store, this state will have no effects
    // if not registered, this will be used as default state
    state: {
      a: 1,
      b: 2,
    },
  })
}
```

```js
use({
  name: 'my-store', // if the store has been registered, this will have no effects
  state: {},
})

function MyComponent(props) {
  const store = useGlobal('my-store') // if 'my-store' is not registed by `use`, you will get `undefined`
}
```

It is NOT recommended to use `useGlobal` directly, this make code dispersed, you may not know where was a store registered. It is best to use `connect`.

## Mutable State

Tyshemo state in store is mutable, does not like Redux, you do not need to create a cloned object.

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

Here you use state's properties, you do not have the ability to change state value, you should must invoke a method to trigger change.

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

*However, The best practice is to create methods in store def to change state in methods, and invoke methods in components, so that you know where you change the state.*

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

In the previous code, we only used `store1` `store1` `store3`, so only these stores' states change, the component will rerender, other stores' changes will have no affects on this component.

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

*Notice, subscribe will return all changes which contains local stores' and shared stores' changes, the difference is there is a 'local:' or 'shared:' prefix at the begin of namespace, so that you can replay the 'local' and 'shared' state changes anytime.*

## react-tyshemo-form

React-tyshemo-form is a form library for react, it is very easy to manage form status by using tyshemo Model.
You can use it easy with react-tyshemo:

```js
import { Field } from 'react-tyshemo/form'
```

Or use seperate library.

```
npm i react-tyshemo-form
```

Read more from [here](https://github.com/tangshuang/react-tyshemo-form).

## TySheMo

> Tyshemo is a javascript runtime data type checking system and morden reactive state management model.

If you want to use Model, you have to import tyshemo package, [read documents about tyshemo](https://tyshemo.js.org/).
