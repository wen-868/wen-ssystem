import { get } from '../request'

export interface BatchItem {
  id: number
  batchNo: string
  productId: number
  productName: string
  productImage?: string
  skuId: string
  quantity: number
  unit: string
  productionDate: string
  expiryDate: string
  status: 'valid' | 'expiring' | 'expired'
  statusText?: string
  createdAt?: string
}

export interface BatchListParams {
  page?: number
  pageSize?: number
  keyword?: string
  productName?: string
}

export interface BatchListResult {
  list: BatchItem[]
  total: number
  page: number
  pageSize: number
}

export interface BatchDetail {
  id: number
  batchNo: string
  productId: number
  productName: string
  productImage?: string
  skuId: string
  quantity: number
  unit: string
  productionDate: string
  expiryDate: string
  status: string
  statusText?: string
  createdAt?: string
  updatedAt?: string
  stockRecords?: {
    type: string
    typeText: string
    quantity: number
    remaining: number
    time: string
  }[]
}

const batchApi = {
  async list(params?: BatchListParams): Promise<BatchListResult> {
    // R94-03：原 /admin/inventory/batches 不存在，改为 /admin/inventory-batch/batches（inventory-batch.routes.ts）
    const res: any = await get('/admin/inventory-batch/batches', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        batchNo: r.batchNo ?? r.batch_no ?? '',
        productId: r.productId ?? r.product_id ?? r.spuId,
        productName: r.productName ?? r.product_name ?? r.skuName ?? '',
        productImage: r.productImage ?? r.product_image,
        skuId: r.skuId ?? r.sku_id ?? '',
        quantity: Number(r.quantity ?? r.qty ?? r.availableQty ?? 0),
        unit: r.unit ?? '',
        productionDate: r.productionDate ?? r.production_date ?? '',
        expiryDate: r.expiryDate ?? r.expiry_date ?? '',
        status: r.status ?? 'valid',
        statusText: r.statusText ?? r.status_text,
        createdAt: r.createdAt ?? r.created_at,
      })),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(id: number): Promise<BatchDetail> {
    // R94-03：原 /admin/inventory/batches/:id 不存在，改为 /admin/inventory-batch/batches/:id
    const res: any = await get(`/admin/inventory-batch/batches/${id}`)
    const r: any = res?.result ?? res ?? {}
    return {
      id: r.id,
      batchNo: r.batchNo ?? r.batch_no ?? '',
      productId: r.productId ?? r.product_id ?? r.spuId,
      productName: r.productName ?? r.product_name ?? r.skuName ?? '',
      productImage: r.productImage ?? r.product_image,
      skuId: r.skuId ?? r.sku_id ?? '',
      quantity: Number(r.quantity ?? r.qty ?? r.availableQty ?? 0),
      unit: r.unit ?? '',
      productionDate: r.productionDate ?? r.production_date ?? '',
      expiryDate: r.expiryDate ?? r.expiry_date ?? '',
      status: r.status ?? 'valid',
      statusText: r.statusText ?? r.status_text,
      createdAt: r.createdAt ?? r.created_at,
      updatedAt: r.updatedAt ?? r.updated_at,
      stockRecords: Array.isArray(r.stockRecords) ? r.stockRecords : Array.isArray(r.stock_records) ? r.stock_records : undefined,
    }
  },

  async trace(id: number): Promise<BatchDetail> {
    // R94-03：原 /admin/inventory/batches/trace/:batchNo 不存在；后端真实接口为 /admin/inventory-batch/batches/:id/trace（按批次 id 追踪）
    const res: any = await get(`/admin/inventory-batch/batches/${id}/trace`)
    return (res?.result ?? res) as BatchDetail
  }
}

export { batchApi }
