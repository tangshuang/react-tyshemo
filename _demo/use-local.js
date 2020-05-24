import React from 'react'
import { useLocal } from '../src/index';

import { one } from "./stores";
import { MyComponent } from "./components";

export default function LocalComponent(props) {
  const store = useLocal(one)
  return <MyComponent one={store}></MyComponent>
}
