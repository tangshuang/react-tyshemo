import { createShared } from '../../src/index'
import { some } from './some'

export const useShared = createShared(some)
