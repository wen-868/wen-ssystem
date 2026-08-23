import { get, post } from '../request'

// ---------------- 销售退货（sale-return.controller.ts:createSaleReturn 契约，camelCase） ----------------
export interface SaleReturnItem {
  skuId: number
  skuName: string
  boxQty?: number
  bottleQty?: number
  unitPrice: number
  reason?: string
}

export interface CreateSaleReturnPayload {
  sourceBillNo?: string
  storeId: number
  customerId?: number
  customerName?: string
  customerMobile?: string
  discountAmount?: number
  remark?: string
  items: SaleReturnItem[]
}

// ---------------- 采购退货（purchase-return.service.ts:create 契约，snake_case） ----------------
export interface PurchaseReturnItem {
  sku_id: number
  sku_name: string
  box_qty?: number
  bottle_qty?: number
  unit_price: number
}

export interface CreatePurchaseReturnPayload {
  order_no?: string
  stock_no?: string
  supplier_id: number
  supplier_name: string
  store_id: number
  remark?: string
  items: PurchaseReturnItem[]
}

export interface ReturnListResult {
  total: number
  records: any[]
}

export const saleReturnApi = {
  /** 创建销售退货单（store 端） */
  async create(data: CreateSaleReturnPayload): Promise<any> {
    return post('/store/sale-returns', data)
  },
  /** 销售退货单列表 */
  async list(params?: { page?: number; pageSize?: number; status?: string }): Promise<ReturnListResult> {
    const res: any = await get('/store/sale-returns', params)
    const raw = res?.result ?? res
    const rows = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return { total: raw?.total ?? rows.length, records: rows }
  },
}

export const purchaseReturnApi = {
  /** 创建采购退货单 */
  async create(data: CreatePurchaseReturnPayload): Promise<any> {
    return post('/admin/purchase-returns', data)
  },
  /** 采购退货单列表 */
  async list(params?: { page?: number; pageSize?: number }): Promise<ReturnListResult> {
    const res: any = await get('/admin/purchase-returns', params)
    const raw = res?.result ?? res
    const rows = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return { total: raw?.total ?? rows.length, records: rows }
  },
}
