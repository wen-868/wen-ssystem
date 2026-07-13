import { get, post } from './request'

export interface ProductSku {
  id: number
  name: string
  skuCode: string
  price: number
  originalPrice: number
  stock: number
  image?: string
  specs: Record<string, string>
}

export interface ProductSpec {
  name: string
  values: string[]
}

export interface ProductParam {
  name: string
  value: string
}

export interface ProductDetail {
  id: number
  name: string
  subtitle?: string
  price: number
  originalPrice: number
  sales: number
  stock: number
  images: string[]
  detailImages: string[]
  specs: ProductSpec[]
  skus: ProductSku[]
  params: ProductParam[]
  description?: string
  categoryId: number
  categoryName: string
  brand?: string
}

export interface AddCartRequest {
  productId: number
  skuId?: number
  quantity: number
}

export interface AddCartResponse {
  cartId: number
  totalCount: number
}

export const getProductDetail = (id: number): Promise<ProductDetail> => {
  return get(`/customer/products/${id}`)
}

export const addToCart = (data: AddCartRequest): Promise<AddCartResponse> => {
  return post('/customer/cart/add', data)
}

export const getProductList = (params?: {
  categoryId?: number
  keyword?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: string
}): Promise<{
  list: ProductDetail[]
  total: number
  page: number
  pageSize: number
}> => {
  return get('/customer/products', params)
}
