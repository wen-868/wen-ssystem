import { get } from '../request'
import type { HotSearch } from '@/types'

export const getHotSearches = (): Promise<HotSearch[]> => {
  return get('/store/search/hot')
}