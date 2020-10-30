import React, { useState, useEffect, useMemo } from 'react'

export function Field(props) {
  const { model, name, names = [], render, component: Component, map, children } = props
  const nameList = [name, ...names]

  // dont show if no model
  if (!model || !model.$views) {
    return null
  }

  const views = model.$views
  const view = views[name]

  // dont show not existing field
  if (!view) {
    return null
  }

  const [, update] = useState()

  useEffect(() => {
    const forceUpdate = () => update({})
    nameList.forEach((name) => {
      model.watch(name, forceUpdate, true)
    })
    return () => nameList.forEach((name) => {
      model.unwatch(name, forceUpdate)
    })
  }, [model, ...nameList])

  const obj = useMemo(() => {
    const onChange = v => view.value = v
    const obj = {
      model,
      view,
      onChange,
    }
    nameList.forEach((name) => {
      const view = views[name]
      if (view) {
        obj[name] = view
      }
    })
    return obj
  }, [model, views, view, ...nameList])

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
