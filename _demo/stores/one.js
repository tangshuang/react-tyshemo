import { Book } from './book'

// create a store definition function
export function one() {
  return {
    name: 'one',
    state: {
      name: 'Tomy',
      age: 10,
      book: new Book(),
    },
    computed: {
      height() {
        return this.age * 5
      },
    },
    watch: {
      age({ value }) {
        if (value > 22) {
          this.married = true
        }
      },
    },
    methods: {
      changeSex(sex) {
        this.sex = sex
      },
      updateBook(data) {
        Object.assign(this.book, data)
        this.dispatch('book')
      },
    },
    hooks: {
      onUse() {
        fetch('/')
          .then(res => res.text())
          .then(text => { this.html = text })
      }
    }
  }
}
