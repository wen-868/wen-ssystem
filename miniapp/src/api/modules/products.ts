import { get } from '../request'
import type { Product, PageResponse } from '@/types'

export const getHotProducts = (params?: { limit?: number }): Promise<Product[]> => {
  return get('/store/products/hot', params)
}

export const getNewProducts = (params?: { limit?: number }): Promise<Product[]> => {
  return get('/store/products/new', params)
}

export const getProductList = (params?: {
  categoryId?: number
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<PageResponse<Product>> => {
  return get('/store/products', params)
}

export const getProductDetail = (id: number): Promise<Product> => {
  return get(`/store/products/${id}`)
}