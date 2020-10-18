import React from 'react'
import { MyComponent } from '../components/my-component'
import { useLocal } from '../../src/index'
import { some } from '../stores/some'

export function BoxB() {
  const store = useLocal(some, [])
  return <MyComponent store={store}></MyComponent>
}
