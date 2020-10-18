import React from 'react'
import { BoxA } from './views/box-a'
import { BoxB } from './views/box-b'
import { BoxC } from './views/box-c'
import { BoxD } from './views/box-d'
import { BoxE } from './views/box-e'

export function App() {
  return (
    <div>
      <h4>BoxA: Use use+connect</h4>
      <BoxA />
      <h4>BoxC: Use use+useStore (use same define function with BoxA)</h4>
      <BoxC />
      <hr />
      <h4>BoxB: Use useLocal</h4>
      <BoxB />
      <hr />
      <BoxD />
      <BoxE />
    </div>
  )
}
