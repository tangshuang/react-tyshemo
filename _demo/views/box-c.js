import React from 'react'
import { MyComponent } from '../components/my-component'
import { use, useStore } from '../../src/index'
import { one } from '../stores/one'

const name = use(one)

export function BoxC() {
  const store = useStore(name)
  return <MyComponent store={store}></MyComponent>
}
