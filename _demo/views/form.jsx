import React, { useCallback } from 'react'
import { Field } from '../src/from.js'
import { Model } from 'tyshemo'
import { useLocal } from '../src/index.js'

export default function App() {
  const model = useLocal(function() {
    class SomeModel extends Model {
      static name = {
        default: '',
        type: String,
        required: true,
        validators: [
          {
            validate: v => v.length < 10,
            message: 'name length should must be less then 10.',
          },
        ],
        extra: {
          label: 'Name',
          type: 'text',
        },
      }
      static age = {
        default: 0,
        type: Number,
        validators: [
          {
            validate: v => v < 100,
            message: 'age should must be less then 100.',
          },
        ],
        setter: v => +v,
        extra: {
          label: 'Age',
          type: 'number',
        },
      }
    }
    return SomeModel
  })

  const onSubmit = useCallback((e) => {
    e.preventDefault()

    const errors = model.validate()
    if (errors.length) {
      console.error(errors)
      return
    }

    const data = model.toJSON()
    console.log(data)
  }, [model])

  return (
    <form onSubmit={onSubmit}>
      {['name', 'age'].map((key) => {
        const { label, type } = model.$views[key]
        return (
          <div key={key}>
            <label>{label}:</label>
            <Field model={model} name={key} map={view => ({ ...view, type })} render={({ value, onChange, type }) => {
              return <input type={type} value={value} onChange={e => onChange(e.target.value)} />
            }} />
          </div>
        )
      })}
      <div>
        <button type="submit">Submit</button>
      </div>
    </form>
  )
}
