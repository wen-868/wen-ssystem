import { get } from '../request'
import type { Category } from '@/types'

export const getCategoryList = (): Promise<Category[]> => {
  return get('/store/categories')
}

export const getCategoryDetail = (id: number): Promise<Category> => {
  return get(`/store/categories/${id}`)
}