import React from 'react'
import { useLocal } from '../src/index';

import { one, some } from "./stores";
import { MyComponent } from "./components";

export default function LocalComponent(props) {
  const store = useLocal(some)
  return <MyComponent one={store}></MyComponent>
}
