import { get, post } from '../request'

/** 调拨单明细行 */
export interface TransferOrderItem {
  skuId: number
  skuName?: string
  quantity: number
  unitPrice: number
}

/** 创建调拨单参数（对齐后端 POST /api/admin/transfers） */
export interface CreateTransferOrderParams {
  fromStoreId: number
  toStoreId: number
  items: TransferOrderItem[]
  expectedDate?: string
  remark?: string
}

const transferApi = {
  /** 创建调拨单 */
  async create(params: CreateTransferOrderParams): Promise<any> {
    return post('/admin/transfers', params)
  },

  /** 调拨单详情（对齐后端 GET /api/admin/transfers/:id） */
  async detail(id: number | string): Promise<any> {
    const res: any = await get(`/admin/transfers/${id}`)
    return res?.result ?? res
  },
}

export { transferApi }
