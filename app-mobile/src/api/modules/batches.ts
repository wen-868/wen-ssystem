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
    const res: any = await get('/admin/inventory/batches', params)
    return (res?.result ?? res) as BatchListResult
  },

  async detail(id: number): Promise<BatchDetail> {
    const res: any = await get(`/admin/inventory/batches/${id}`)
    return (res?.result ?? res) as BatchDetail
  },

  async trace(batchNo: string): Promise<BatchDetail> {
    const res: any = await get(`/admin/inventory/batches/trace/${batchNo}`)
    return (res?.result ?? res) as BatchDetail
  }
}

export { batchApi }