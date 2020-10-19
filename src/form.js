import React, { useState, useEffect, useMemo } from 'react'

export function Field(props) {
  const { model, name, names, render, component: Component, map, children } = props

  const [, update] = useState()
  const nameList = useMemo(() => [name, ...names], [name, names])

  useEffect(() => {
    const forceUpdate = () => update({})
    nameList.forEach((name) => {
      model.watch(name, forceUpdate, true)
    })
    return () => nameList.forEach((name) => {
      model.unwatch(name, forceUpdate)
    })
  }, [model, nameList])

  const obj = useMemo(() => {
    const views = model.$views
    const view = views[name]
    const onChange = (v) => view.value = v
    const obj = {
      view,
      onChange,
      model,
    }
    nameList.forEach((name) => {
      obj[name] = views[name]
    })
    return obj
  }, [model, nameList])

  const views = model.$views
  const view = views[name]
  const { value, readonly, disabled, hidden, required, errors } = view
  const info = {
    ...obj,
    value,
    readOnly: readonly,
    disabled,
    hidden,
    required,
    errors,
  }
  const attrs = typeof map === 'function' ? map(info) : info

  return Component ? <Component {...attrs}>{children}</Component>
    : render ? render({ ...attrs, children })
    : null
}
