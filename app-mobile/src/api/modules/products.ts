import { get } from '../request'

export interface ProductInfo {
  id: number
  skuId: string
  name: string
  categoryId?: number
  categoryName?: string
  price: number
  stock: number
  unit: string
  image?: string
  specs?: string
  safetyStock?: number
  status: 'ON' | 'OFF'
  allowOnlineSale?: number
}

export interface ProductListParams {
  page?: number
  pageSize?: number
  keyword?: string
  categoryId?: number
}

export interface ProductListResult {
  list: ProductInfo[]
  total: number
  page: number
  pageSize: number
}

export interface CategoryInfo {
  id: number
  name: string
  parentId?: number
  children?: CategoryInfo[]
  allowOnlineSale?: number
}

const productsApi = {
  async list(params?: ProductListParams): Promise<ProductListResult> {
    const res = await get('/admin/products', params)
    return (res as any)?.result ?? res
  },

  async detail(id: number): Promise<ProductInfo> {
    const res = await get(`/admin/products/${id}`)
    return (res as any)?.result ?? res
  },

  async categories(): Promise<CategoryInfo[]> {
    const res = await get('/admin/product-categories')
    return (res as any)?.list ?? res ?? []
  },

  async batchTrace(batchNo: string): Promise<any> {
    return get(`/admin/products/batch/${batchNo}`)
  }
}

export { productsApi }
