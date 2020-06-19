import React from 'react'
import { useObserver } from './index.js'


export function Field(props) {
  const { model, name, render, component: Component, map, children } = props

  useObserver(
    dispatch => model.watch(name, dispatch, true),
    dispatch => model.unwatch(name, dispatch),
    [model, name],
  )

  const view = model.$views[name]
  const attrs = {
    ...view,
    onChange(value) {
      view.value = value
    },
  }

  const final = typeof map === 'function' ? map(attrs) : {}

  return Component ? <Component {...final}>{children}</Component> : render ? render({ ...final, children }) : null
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
  const attrs = views.map(view => ({
    ...view,
    onChange(value) {
      view.value = value
    },
  }))

  const final = typeof map === 'function' ? map(attrs) : {}

  return Component ? <Component {...final}>{children}</Component> : render ? render({ ...final, children }) : null
}
