import { get, post } from '../request'

export interface InventoryItem {
  id: number
  productId: number
  productName: string
  productImage?: string
  skuId: string
  categoryName?: string
  stock: number
  safetyStock: number
  unit: string
  status: 'normal' | 'warning' | 'shortage' | 'danger'
  statusText?: string
}

export interface InventoryListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}

export interface InventoryListResult {
  list: InventoryItem[]
  total: number
  page: number
  pageSize: number
}

export interface InventoryAlert {
  productName: string
  stock: number
  safetyStock: number
  shortage: number
}

const inventoryApi = {
  async list(params?: InventoryListParams): Promise<InventoryListResult> {
    const res: any = await get('/admin/inventory', params)
    return (res?.result ?? res) as InventoryListResult
  },

  async adjust(productId: number, quantity: number, reason: string, type: string): Promise<void> {
    return post('/admin/inventory/adjust', { productId, quantity, reason, type })
  },

  async logs(params?: { page?: number; pageSize?: number }): Promise<any> {
    return get('/admin/inventory/logs', params)
  },

  async alerts(): Promise<InventoryAlert[]> {
    const res: any = await get('/admin/inventory/alerts')
    return (res?.list ?? res ?? []) as InventoryAlert[]
  },

  async createCheck(data: any): Promise<any> {
    return post('/admin/inventory/checks', data)
  },

  async checks(params?: any): Promise<any> {
    return get('/admin/inventory/checks', params)
  },

  async checkDetail(id: number): Promise<any> {
    return get(`/admin/inventory/checks/${id}`)
  }
}

export { inventoryApi }