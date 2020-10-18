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
    const value = view.value
    const obj = {
      view,
      onChange,
      model,
      value,
    }
    nameList.forEach((name) => {
      obj[name] = views[name]
    })
    return obj
  }, [model, nameList])

  const attrs = useMemo(() => typeof map === 'function' ? map(obj) : obj, [obj, map])

  return Component ? <Component {...attrs}>{children}</Component>
    : render ? render({ ...attrs, children })
    : null
}
