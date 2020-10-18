import React from 'react'
import { useShared } from '../stores/shared'

export function BoxD() {
  const some = useShared()

  return (
    <div>
      BoxD: {some.name}, {some.age}
    </div>
  )
}
