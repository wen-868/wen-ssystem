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

export const getProductDetail = async (id: number): Promise<ProductDetail> => {
  // 后端 miniapp 路由：GET /api/miniapp/products/:id（返回 spuId/mainImage/imageUrls/skus[skuId/skuName/price/availableQty]）
  const res: any = await get(`/miniapp/products/${id}`)
  const raw = res?.result ?? res ?? {}
  const skus: ProductSku[] = (raw.skus || []).map((s: any) => ({
    id: s.skuId,
    name: s.skuName || s.skuCode || '',
    skuCode: s.skuCode || '',
    price: Number(s.price ?? s.miniappPrice ?? s.retailPrice ?? 0),
    originalPrice: Number(s.retailPrice ?? s.price ?? 0),
    stock: Number(s.availableQty ?? 0),
    image: s.image,
    specs: s.specs || {},
  }))
  const images = Array.isArray(raw.imageUrls) ? raw.imageUrls : raw.mainImage ? [raw.mainImage] : []
  return {
    id: raw.spuId ?? id,
    name: raw.name ?? '',
    subtitle: raw.description,
    price: skus[0]?.price ?? 0,
    originalPrice: skus[0]?.originalPrice ?? skus[0]?.price ?? 0,
    sales: 0,
    stock: skus.reduce((sum, s) => sum + s.stock, 0),
    images,
    detailImages: images,
    specs: raw.specs || [],
    skus,
    params: [],
    description: raw.description,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    brand: raw.brandName,
  }
}

export const addToCart = (data: AddCartRequest): Promise<AddCartResponse> => {
  // 后端 miniapp 路由：POST /api/miniapp/cart/add
  return post('/miniapp/cart/add', data as unknown as Record<string, unknown>)
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
  // 后端 miniapp 路由：GET /api/miniapp/products
  return get('/miniapp/products', params)
}
