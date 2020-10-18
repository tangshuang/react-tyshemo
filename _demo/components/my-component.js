import React from 'react'

// create a functional component
export function MyComponent(props) {
  const { store } = props
  const {
    name,
    age,
    height,
    married,
    sex,
    html,
    book,
  } = store

  // notice, we should invoke methods of store by use store.change, or the `this` in methods may not point to `store`

  return (
    <>
      <div>
        {name}: {age}, {height}, {married ? 'married,' : ''} {sex ? 'F' : 'M'}
      </div>
      <div>book: {book.price}</div>
      <div>
        <button type='button' onClick={() => store.age++}>
          grow age
        </button>
        <button type='button' onClick={() => store.changeSex(!sex)}>
          change sex
        </button>
        <button
          type='button'
          onClick={() =>
            store.updateBook({ price: (Math.random() * 100).toFixed(2) })
          }
        >
          update book price
        </button>
      </div>
      <pre style={{ marginTop: 40 }}>{html}</pre>
    </>
  )
}
