import { MyComponent } from '../components/my-component'
import { use, connect } from '../../src/index'
import { one } from '../stores/one'

use(one)

const mapToProps = (stores) => {
  const { one } = stores
  return {
    store: one
  }
}

export const BoxA = connect(mapToProps)(MyComponent)
