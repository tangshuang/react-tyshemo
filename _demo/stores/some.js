import { Model, Meta } from 'tyshemo'
import { Book } from './book'

export function some() {
  class SomeModel extends Model {
    static name = new Meta({
      default: 'tomy',
    })
    static age = new Meta({
      default: 10,
    })
    static sex = new Meta({
      default: 'M',
    })
    static height = new Meta({
      default: 0,
      compute() {
        return this.age * 5
      },
    })
    static book = new Meta({
      default: () => new Book(),
    })

    // make sure
    static html = new Meta({
      default: '',
    })

    changeSex(sex) {
      this.sex = sex
    }

    updateBook(data) {
      Object.assign(this.book, data)
      this.dispatch('book')
    }

    [Symbol('dict')]() {
      return 'dict'
    }

    onInit() {
      fetch('/')
        .then(res => res.text())
        .then(text => {
          this.html = text
        })
    }
  }
  return SomeModel
}
