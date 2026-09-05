import { get, post } from '../request'

/** 后端状态枚举（t_transfer_order.status） */
export type TransferStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'TRANSIT' | 'RECEIVED' | 'CANCELLED'

/** 状态中文标签（后端真实状态，不造假） */
export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待审核',
  APPROVED: '待发货',
  TRANSIT: '调拨中',
  RECEIVED: '已完成',
  CANCELLED: '已取消',
}

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

/** 列表行（后端 listTransferOrders 返回 snake_case 字段） */
export interface TransferOrderRow {
  id: number
  transfer_no: string
  from_store_id: number
  from_store_name: string | null
  to_store_id: number
  to_store_name: string | null
  status: TransferStatus
  expected_date: string | null
  total_amount: number | string
  total_items: number | string
  remark: string | null
  created_at: string
  created_by_name?: string | null
}

/** 明细行（t_transfer_order_item，SELECT * 原样返回） */
export interface TransferItemRow {
  id: number
  transfer_order_id: number
  sku_id: number
  sku_name: string
  quantity: number | string
  unit_price: number | string
  subtotal: number | string
}

/** 详情（单头 snake_case 字段 + items 明细） */
export interface TransferOrderDetail extends TransferOrderRow {
  cancel_reason?: string | null
  approved_at?: string | null
  shipped_at?: string | null
  received_at?: string | null
  items: TransferItemRow[]
}

export interface TransferListResult {
  total: number
  page: number
  pageSize: number
  records: TransferOrderRow[]
}

const transferApi = {
  /** 调拨单列表（GET /admin/transfers，status 不传为全部） */
  async list(params?: {
    page?: number
    pageSize?: number
    status?: TransferStatus | ''
    storeId?: number
    dateStart?: string
    dateEnd?: string
  }): Promise<TransferListResult> {
    // uni.request 会把 undefined 序列化成 "undefined"，必须先剔除空值
    const clean: Record<string, any> = {}
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') clean[k] = v
      }
    }
    return get('/admin/transfers', clean)
  },

  /** 调拨单详情（GET /admin/transfers/:id） */
  async detail(id: number | string): Promise<TransferOrderDetail> {
    return get(`/admin/transfers/${id}`)
  },

  /** 创建调拨单（初始 DRAFT）→ {transferOrderId, transferNo} */
  async create(params: CreateTransferOrderParams): Promise<{ transferOrderId: number; transferNo: string }> {
    return post('/admin/transfers', params)
  },

  /** 提交审核 DRAFT → PENDING */
  async submit(id: number | string): Promise<void> {
    return post(`/admin/transfers/${id}/submit`)
  },

  /** 审批通过 PENDING → APPROVED */
  async approve(id: number | string): Promise<void> {
    return post(`/admin/transfers/${id}/approve`)
  },

  /** 驳回（打回草稿）PENDING → DRAFT */
  async reject(id: number | string): Promise<void> {
    return post(`/admin/transfers/${id}/reject`)
  },

  /** 取消 DRAFT/PENDING → CANCELLED */
  async cancel(id: number | string): Promise<void> {
    return post(`/admin/transfers/${id}/cancel`)
  },

  /** 发货 APPROVED → TRANSIT */
  async ship(id: number | string): Promise<void> {
    return post(`/admin/transfers/${id}/ship`)
  },

  /** 确认收货 TRANSIT → RECEIVED（itemId 为明细行 id，receivedQty 实收数） */
  async receive(id: number | string, items: { itemId: number; receivedQty: number }[]): Promise<void> {
    return post(`/store/transfers/${id}/receive`, { items })
  },
}

export { transferApi }
