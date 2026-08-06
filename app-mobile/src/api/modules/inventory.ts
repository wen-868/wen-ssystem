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
    // R94-03：原 /admin/inventory 不存在，改为 /admin/inventory-balance（admin-inventory.routes.ts）
    const res: any = await get('/admin/inventory-balance', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    const list: InventoryItem[] = rows.map((r: any) => {
      const stock = Number(r.availableQty ?? r.physicalQty ?? r.stock ?? 0)
      const safetyStock = Number(r.warningThreshold ?? r.safetyStock ?? 0)
      return {
        id: r.skuId ?? r.id,
        productId: r.skuId ?? r.productId ?? r.id,
        productName: r.skuName ?? r.productName ?? r.name ?? '',
        productImage: r.productImage ?? r.image,
        skuId: String(r.skuId ?? r.sku_id ?? ''),
        categoryName: r.categoryName ?? r.category,
        stock,
        safetyStock,
        unit: r.unit ?? '',
        status: safetyStock > 0 && stock < safetyStock ? 'warning' : 'normal',
      }
    })
    return {
      list,
      total: raw?.total ?? list.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async adjust(productId: number, quantity: number, reason: string, type: string): Promise<void> {
    // R94-03：后端无 /admin/inventory/adjust，改为 /store/inventory/adjust（store-inventory.routes.ts），字段对齐 skuId/change/stockType
    return post('/store/inventory/adjust', { skuId: productId, change: quantity, remark: reason, stockType: type })
  },

  async logs(params?: { page?: number; pageSize?: number }): Promise<any> {
    // R94-03：原 /admin/inventory/logs 不存在，改为 /admin/inventory-logs
    return get('/admin/inventory-logs', params)
  },

  async alerts(): Promise<InventoryAlert[]> {
    // R94-03：原 /admin/inventory/alerts 不存在，改为 /admin/inventory-alerts
    const res: any = await get('/admin/inventory-alerts')
    const rows: any[] = res?.list ?? res?.records ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any) => ({
      productName: r.skuName ?? r.productName ?? '',
      stock: Number(r.availableQty ?? r.stock ?? 0),
      safetyStock: Number(r.warningThreshold ?? r.safetyStock ?? 0),
      shortage: Math.max(Number(r.warningThreshold ?? r.safetyStock ?? 0) - Number(r.availableQty ?? r.stock ?? 0), 0),
    }))
  },

  async createCheck(data: any): Promise<any> {
    // R94-03：原 /admin/inventory/checks 不存在，改为 /admin/stock-checks（stock-check.routes.ts）
    return post('/admin/stock-checks', data)
  },

  async checks(params?: any): Promise<any> {
    // R94-03：原 /admin/inventory/checks 不存在，改为 /admin/stock-checks
    return get('/admin/stock-checks', params)
  },

  async checkDetail(id: number): Promise<any> {
    // R94-03：原 /admin/inventory/checks/:id 不存在，改为 /admin/stock-checks/:id
    return get(`/admin/stock-checks/${id}`)
  }
}

export { inventoryApi }
