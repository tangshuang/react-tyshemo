import React from 'react'
import { useShared } from '../stores/shared'

export function BoxE() {
  const some = useShared()

  return (
    <div>
      BoxE: {some.name}, {some.age}
      <button onClick={() => some.age ++}>grow</button>
    </div>
  )
}
