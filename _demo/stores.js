import { Model } from "../src/index.js";

// create a class which is not reactive when properties change
class Book {
  price = 12;
}

// create a store definition function
export function one() {
  return {
    name: "one",
    state: {
      name: "Tomy",
      age: 10,
      book: new Book()
    },
    computed: {
      height() {
        return this.age * 5;
      }
    },
    watch: {
      age({ value }) {
        if (value > 22) {
          this.married = true;
        }
      }
    },
    methods: {
      changeSex(sex) {
        this.sex = sex;
      },
      updateBook(data) {
        Object.assign(this.book, data);
        this.dispatch("book");
      }
    },
    hooks: {
      onUse() {
        fetch("/")
          .then(res => res.text())
          .then(text => {
            this.html = text;
          });
      }
    }
  };
}

export function some() {
  class SomeModel extends Model {
    static name = {
      default: 'tomy',
    }
    static age = {
      default: 10,
    }
    static sex = {
      default: 'M',
    }
    static height = {
      default: 0,
      compute() {
        return this.age * 5
      },
    }
    static book = {
      default: () => new Book(),
    }

    // make sure
    static html = {
      default: ''
    }

    changeSex(sex) {
      this.sex = sex;
    }
    updateBook(data) {
      Object.assign(this.book, data);
      this.dispatch("book");
    }

    onInit() {
      fetch("/")
        .then(res => res.text())
        .then(text => {
          this.html = text;
        });
    }
  }
  return SomeModel
}
