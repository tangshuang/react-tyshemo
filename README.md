# React-Tyshemo

A react state managemenet which is drived with [tyshemo](https://github.com/tangshuang/tyshemo).

Enjoy global shared mutable state management amoung components, without any complex reducer codes, without a force Provider component, without messy store files management, just code as want your think directly.

## Install

```
npm i react-tyshemo
```

## API

```js
import { use, useStore } from 'react-tyshemo'

const name = use(some)

function MyComponent(props) {
  const context = useStore(name)
  // ...
}
```

### use(define:object|function, fallback?:function):string|symbol

To register a namespace store in global scope.

```js
const name = use(define)
```

If `define` is an object, it should be like:

```js
const define = {
  // optional, if exist, should be unique, same namespace will only be registered at the first time
  name: 'namespace',

  // required, default state
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
    // if name is not returned, the function's name will be used as namespace
  }
}
```

One namespace can only be `use` once. So, it doesn't matter whether use `use` in a global file or in business components when you need, the same namespace will be used only once.

It is recommended to pass a function, so that you can share the function any where. ReactTyshemo will treat same function as a same global shared store/model index, so if you `use` one function twice, you will get the previous registered global store.

`use` returns registered name, so that you can use the name for next steps.

```js
const name = use(define)

function MyComponent() {
  const context = useStore(name)
  // ... use `context` to render
}
```

And you can return a Model in define function:

```js
import { Model } from 'tyshemo'
import { use } from 'react-tyshemo'

function some() {
  class SomeModel extends Model {
    static name = {
      default: 'luni',
    }
    static age = {
      default: 10,
    }
  }
  return SomeModel
}

const name = use(some) // name is a symbol
```

This `Model` is the same as [`Model` in tyshemo](https://tyshemo.js.org/#/model).

**fallback**

When you use a existing store/model, fallback will be invoked, you passed define will not be executed and the old one will be return (without override).

### useStore(name:string|symbol)

React hook function to use a store which is registered globally.

- name: global store name

```js
use({
  name: 'my-store',
  state: {},
})

function MyComponent(props) {
  const store = useStore('my-store') // if 'my-store' is not registed by `use`, you will get `undefined`
}
```

It is NOT recommended to use `useStore` directly, this make code dispersed, you may not know where was a store registered. To prevent this, you should always use the `name` which is returned by `use`.

```js
const name = use(define)

function MyComponent() {
  const some = useStore(name)
  // ...
}
```

Because a repeating using will point to the same store, so with this structure, you can know where the stores come from without worrying about registering overriding.

### useLocal(define:function, deps?=[])

In sometimes, you may want to create a local store only for current component.
To use hook function, we provide `useLocal`.

```js
import { useLocal } from 'react-tyshemo'

const define = () => {
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
}

export default function MyComponent() {
  const context = useLocal(define)
  return (
    <span onClick={context.updateAge}>{some.name}: {some.age}</span>
  )
}
```

1. define: function, which is to return a store def. `name` property will have no effect.
2. deps: array, when any one value of `deps` changes, the store will be rebuilt, `deps` is passed into `useMemo`

In sometimes, you do need a Model, not a store, you should do like this:

```js
import { useLocal } from 'react-tyshemo'
import { Model } from 'tyshemo'

const define = () => {
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
}

export default function MyComponent() {
  const model = useLocal(define)
  // however, now you receive a instance of MyModel
  return (
    <span onClick={model.updateAge}>{model.name}: {model.age}</span>
  )
}
```

Now, `model` is only works in this component, even though another component use `define` to build a model, it will never share with this component.

### connect(mapToProps:function, mergeToProps?:function):function

Connect a component with global registered stores.

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
 * @param {object} contexts all contexts (stores and models) which are registered in global,
 * if a context is from a store, it will combine state and methods together.
 */
const mapToProps = (contexts) => {
  const {
    some, // this store's namespace is `some`
  } = contexts
  const {
    name,
    age, // this may be a computed property
    growAge, // this may be a method
  } = some
  // return what you want to patch to component's props
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
  // return what you want to patch to component's props
  return {
    ...mappedProps,
    ...ownProps,
  }
}

export default connect(mapToProps, mergeToProps)(MyComponent) // MyContent instances will receive props which is from mergeToProps
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

Get whole combined state of all stores in global.

```js
const states = getState()
const state = states.some // get state of some namespace
```

### subscribe(fn:function): function

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
  // name: string, namespace
  // key: array|string, the keyPath of the changed property
  // value: any, the changed value
})
```

You can use subscribe to record changes of your application.

### createShared(define:function):function<useShared():context>

`useLocal` only works for only one component, the store will be destory when the component unmounts. `createShared` works for multiple related *live* components.

```js
const useShared = createShared(define)

function ComponentA(props) {
  const context1 = useShared()
  // ...
}

function ComponentB(props) {
  const context2 = useShared() // context1 === context2
  // ...
}
```

Now `ComponentA` and `ComponentB` will share the same context during the components are living. When all components unmount (die), the context will be destoried. Then, if some of them mount again, a pure new store will be created.

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
import { Model, Meta } from 'tyshemo'
import { Field } from 'react-tyshemo/form'
import { useLocal } from 'react-tyshemo'

class SomeModel extends Model {
  static name = new Meta({
    default: '',
    type: String,
  })
  static age = new Meta({
    default: 0,
    type: Number,
    setter: v => +v,
  })
}

function MyComponent() {
  const model = useLocal(function() {
    return SomeModel
  })

  return (
    <form>
      <Field model={model} name="age" render={({ value, onChange }) => {
        return <input type="number" value={value} onChange={e => onChange(e.target.value)} />
      }} />
    </form>
  )
}
```

Props:

- model: a tyshemo model instance
- name: field name of the model
- names: fields names which append to the scope
- component: which component to be used to render
- render: function to render
- map?: function, append more props to render or component

You will receive views as named prop in the scope:

```js
<Field model={model} name="age" names={['name']} render={({ age, name }) => {
  // `age`, `name` are views of model
}} />
```

## TySheMo

> Tyshemo is a javascript runtime data type checking system and morden reactive state management model.

If you want to use Model, you have to import tyshemo package, [read documents about tyshemo](https://tyshemo.js.org/).
