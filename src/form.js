import React from 'react'
import { useObserver } from './index.js'
import { inArray, isFunction } from 'ts-fns'

export function Field(props) {
  const { model, name, render, component: Component, map, children } = props

  useObserver(
    dispatch => model.watch(name, dispatch, true),
    dispatch => model.unwatch(name, dispatch),
    [model, name],
  )

  const view = model.$views[name]
  const attrs = typeof map === 'function' ? map(view) : view
  const onChange = (v) => view.value = v

  return Component ? <Component {...attrs} onChange={onChange}>{children}</Component>
    : render ? render({ ...attrs, onChange, children }) : null
}


export function Fields(props) {
  const { model, names, render, component: Component, map, children } = props

  useObserver(
    dispatch => names.forEach(key => model.watch(key, dispatch, true)),
    dispatch => names.forEach(key => model.unwatch(key, dispatch)),
    [model, ...names],
  )

  const { $views } = model
  const views = names.map(name => $views[name])

  let attrs = {}
  if (isFunction(map)) {
    attrs = map(views)
  }
  else {
    views.forEach((view, key) => attrs[key] = view)
  }

  const onChange = (key, value) => {
    if (!inArray(key, names)) {
      return
    }
    $views[key] = value
  }

  return Component ? <Component {...attrs} onChange={onChange}>{children}</Component>
    : render ? render({ ...attrs, onChange, children }) : null
}
