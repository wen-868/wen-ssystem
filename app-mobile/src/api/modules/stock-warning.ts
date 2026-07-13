import { get, post } from '../request'

/** 库存预警项 */
export interface StockWarningItem {
  id?: number
  productId: number
  productName: string
  skuId?: string
  categoryName?: string
  stock: number
  safetyStock: number
  shortage: number
  unit?: string
  suggestQty?: number
}

/** 预警阈值配置 */
export interface WarningConfig {
  id?: number
  productId: number
  productName?: string
  safetyStock: number
  enabled?: number
}

function mapWarning(r: any): StockWarningItem {
  return {
    id: r.id,
    productId: r.productId ?? r.product_id,
    productName: r.productName ?? r.product_name ?? '',
    skuId: r.skuId ?? r.sku_id,
    categoryName: r.categoryName ?? r.category_name,
    stock: Number(r.stock ?? r.availableQty ?? r.available_qty ?? 0),
    safetyStock: Number(r.safetyStock ?? r.safety_stock ?? r.warningThreshold ?? r.warning_threshold ?? 0),
    shortage: Number(r.shortage ?? 0),
    unit: r.unit,
    suggestQty: r.suggestQty != null ? Number(r.suggestQty) : undefined,
  }
}

const stockWarningApi = {
  /** 低库存预警列表 */
  async list(params?: { page?: number; pageSize?: number; keyword?: string }): Promise<{ list: StockWarningItem[]; total: number }> {
    const res: any = await get('/admin/stock-warnings', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapWarning),
      total: raw?.total ?? rows.length,
    }
  },

  /** 预警阈值配置列表 */
  async configs(params?: { page?: number; pageSize?: number }): Promise<{ list: WarningConfig[]; total: number }> {
    const res: any = await get('/admin/stock-warnings/configs', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.list ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        productId: r.productId ?? r.product_id,
        productName: r.productName ?? r.product_name,
        safetyStock: Number(r.safetyStock ?? r.safety_stock ?? 0),
        enabled: r.enabled != null ? Number(r.enabled) : 1,
      })),
      total: raw?.total ?? rows.length,
    }
  },

  /** 批量设置预警阈值 */
  async batchConfig(data: { items: Array<{ productId: number; safetyStock: number }> }): Promise<any> {
    return post('/admin/stock-warnings/config', data)
  },
}

export { stockWarningApi }
