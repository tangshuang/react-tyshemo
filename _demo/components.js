import React from "react";

// create a functional component
export function MyComponent(props) {
  const { one } = props;
  const {
    name,
    age,
    height,
    married,
    sex,
    html,
    book,

    changeSex,
    updateBook,
  } = one;

  // notice, we should invoke methods of one by use one.change, or the `this` in methods may not point to `one`

  return (
    <>
      <div>
        {name}: {age}, {height}, {married ? "married," : ""} {sex ? "F" : "M"}
      </div>
      <div>book: {book.price}</div>
      <div>
        <button type="button" onClick={() => one.age++}>
          grow age
        </button>
        <button type="button" onClick={() => changeSex(!sex)}>
          change sex
        </button>
        <button
          type="button"
          onClick={() =>
            updateBook({ price: (Math.random() * 100).toFixed(2) })
          }
        >
          update book price
        </button>
      </div>
      <pre style={{ marginTop: 40 }}>{html}</pre>
    </>
  );
}
