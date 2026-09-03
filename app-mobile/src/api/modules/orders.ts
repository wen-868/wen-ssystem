import { get, post, put } from '../request'

export interface OrderItem {
  id?: number
  skuId: number
  skuName: string
  productName?: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  quantity?: number
  unitPrice: number
  totalPrice?: number
  subtotalAmount: number
}

export interface OrderInfo {
  orderNo: string
  customerName: string
  customerMobile?: string
  customerAddress?: string
  remark?: string
  status: string
  statusLabel: string
  totalAmount: number
  paidAmount: number
  receivableAmount: number
  items: OrderItem[]
  logs?: OrderLog[]
  createdAt: string
  logisticsInfo?: LogisticsInfo
  // 列表展示用扩展字段
  itemCount?: number
  channel?: string
  createTime?: string
}

export interface OrderLog {
  id?: number
  action: string
  operator: string
  remark?: string
  createdAt: string
}

export interface LogisticsInfo {
  logisticsNo?: string
  logisticsCompany?: string
  logisticsStatus?: string
  logisticsStatusLabel?: string
  trackingSteps?: TrackingStep[]
}

export interface TrackingStep {
  status: string
  description: string
  time: string
}

export interface OrderListParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  customerName?: string
  startDate?: string
  endDate?: string
}

export interface OrderListResult {
  list: OrderInfo[]
  total: number
  page: number
  pageSize: number
}

const ordersApi = {
  async list(params?: OrderListParams): Promise<OrderListResult> {
    // R94-03 结构对齐：后端返回 data.records（订单行），前端统一映射为 list + statusLabel
    const res: any = await get('/admin/orders', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapOrder),
      total: raw?.total ?? rows.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(orderNo: string): Promise<OrderInfo> {
    const res: any = await get(`/admin/orders/${orderNo}`)
    return mapOrder(res?.result ?? res)
  },

  confirm(orderNo: string): Promise<void> {
    // R94-03：后端无 /confirm；订单状态流转真实接口为 PUT /admin/orders/:orderNo/status
    return put(`/admin/orders/${orderNo}/status`, { status: 'ACCEPTED' })
  },

  startDelivery(orderNo: string): Promise<void> {
    // R94-03：后端无 /start-delivery；状态流转为 PUT /admin/orders/:orderNo/status
    return put(`/admin/orders/${orderNo}/status`, { status: 'DELIVERING' })
  },

  completeDelivery(orderNo: string): Promise<void> {
    // R94-03：后端无 /complete-delivery；状态流转为 PUT /admin/orders/:orderNo/status
    return put(`/admin/orders/${orderNo}/status`, { status: 'COMPLETED' })
  },

  reject(orderNo: string, reason?: string): Promise<void> {
    // R94-03：后端无 /reject；拒单使用状态流转 PUT /admin/orders/:orderNo/status（CANCELLED）
    return put(`/admin/orders/${orderNo}/status`, { status: 'CANCELLED', remark: reason })
  },

  cancel(orderNo: string, reason?: string): Promise<void> {
    return post(`/admin/orders/${orderNo}/cancel`, { reason })
  },

  export(params?: OrderListParams): Promise<Blob> {
    // R94-03：后端导出接口为 GET /admin/orders/export-csv
    return get('/admin/orders/export-csv', params, { responseType: 'blob' })
  }
}

/** 订单状态中文映射（后端返回英文 order_status） */
const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: '待付款',
  PENDING: '待处理',
  ACCEPTED: '待配送',
  DELIVERING: '配送中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
  UNPAID: '未支付',
  PAID: '已支付',
}

function mapOrder(r: any): OrderInfo {
  const status = r.orderStatus ?? r.status ?? ''
  const fulfillmentType = r.fulfillmentType ?? r.fulfillment_type ?? ''
  const customerType = r.customerType ?? r.customer_type ?? ''
  const channel = r.channel
    ?? (fulfillmentType.includes('MINIAPP') ? '小程序'
      : fulfillmentType.includes('INSTANT') ? '即时零售'
      : fulfillmentType.includes('PICKUP') || fulfillmentType.includes('STORE') ? '门店'
      : customerType.includes('WHOLESALE') ? '批发'
      : customerType.includes('RETAIL') ? '零售'
      : (fulfillmentType || '门店'))
  return {
    orderNo: r.orderNo ?? r.order_no ?? '',
    customerName: r.customerName ?? r.customer_name ?? r.receiverName ?? r.receiver_name ?? r.memberName ?? '',
    customerMobile: r.customerMobile ?? r.customer_mobile ?? r.receiverMobile ?? r.receiver_mobile ?? r.mobile,
    customerAddress: r.customerAddress ?? r.address,
    remark: r.remark,
    status,
    statusLabel: r.statusLabel ?? r.status_label ?? ORDER_STATUS_LABEL[status] ?? status,
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? r.payableAmount ?? r.payable_amount ?? 0),
    paidAmount: Number(r.paidAmount ?? r.paid_amount ?? r.receivedAmount ?? 0),
    receivableAmount: Number(r.receivableAmount ?? r.receivable_amount ?? r.totalAmount ?? r.payableAmount ?? 0),
    items: Array.isArray(r.items) ? r.items : [],
    logs: Array.isArray(r.logs) ? r.logs : undefined,
    createdAt: r.createdAt ?? r.created_at ?? r.createTime ?? '',
    logisticsInfo: r.logisticsInfo ?? r.logistics,
    itemCount: r.itemCount,
    channel,
    createTime: r.createTime,
  }
}

export { ordersApi }

// ========== 历史单据统一查询（后端 admin-bill-history.routes：/api/admin/bills/history） ==========

/** 历史单据记录（聚合：销售单/销售订单/采购订单/采购入库） */
export interface BillHistoryItem {
  /** sale_bill | sale_order | purchase_order | purchase_in_stock */
  billType: string
  billNo: string
  /** 客户/供应商名称 */
  partyName: string
  amount: number
  /** 各单据状态原文（collection_status / order_status / stock_status） */
  status: string
  createdAt: string
  /** 客户类型 RETAIL/WHOLESALE（仅销售单有值，渠道来源区分 门店零售/门店批发） */
  customerType?: string | null
}

export interface BillHistoryParams {
  billType?: string
  startDate?: string
  endDate?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export const billHistoryApi = {
  async list(params?: BillHistoryParams): Promise<{ list: BillHistoryItem[]; total: number }> {
    const res: any = await get('/admin/bills/history', params)
    const raw: any = res?.result ?? res
    const records: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: records.map((r) => ({
        billType: r.billType ?? '',
        billNo: r.billNo ?? '',
        partyName: r.partyName ?? '',
        amount: Number(r.amount ?? 0),
        status: r.status ?? '',
        createdAt: r.createdAt ?? '',
        customerType: r.customerType ?? null,
      })),
      total: Number(raw?.total ?? records.length),
    }
  },
}

export const storeSaleBillsApi = {
  /**
   * 门店销售单列表（GET /store/sale-bills，store-sale-bill.routes.ts）。
   * 比 bills/history 多返回 customerType，供渠道来源区分 门店零售/门店批发。
   */
  async list(params?: { page?: number; pageSize?: number; keyword?: string }): Promise<{
    list: BillHistoryItem[]
    total: number
  }> {
    const res: any = await get('/store/sale-bills', params)
    const raw: any = res?.result ?? res
    const records: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: records.map((r) => ({
        billType: 'sale_bill',
        billNo: r.billNo ?? '',
        partyName: r.customerName ?? '',
        amount: Number(r.receivableAmount ?? 0),
        status: r.collectionStatus ?? '',
        createdAt: r.createdAt ?? '',
        customerType: r.customerType ?? null,
      })),
      total: Number(raw?.total ?? records.length),
    }
  },
}
