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

function mapOrder(r: any): OrderInfo {
  return {
    orderNo: r.orderNo ?? r.order_no ?? '',
    customerName: r.customerName ?? r.customer_name ?? r.memberName ?? '',
    customerMobile: r.customerMobile ?? r.customer_mobile ?? r.mobile,
    customerAddress: r.customerAddress ?? r.address,
    remark: r.remark,
    status: r.orderStatus ?? r.status ?? '',
    statusLabel: r.statusLabel ?? r.status_label ?? (r.orderStatus ?? r.status ?? ''),
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
    paidAmount: Number(r.paidAmount ?? r.paid_amount ?? r.receivedAmount ?? 0),
    receivableAmount: Number(r.receivableAmount ?? r.receivable_amount ?? r.totalAmount ?? 0),
    items: Array.isArray(r.items) ? r.items : [],
    logs: Array.isArray(r.logs) ? r.logs : undefined,
    createdAt: r.createdAt ?? r.created_at ?? r.createTime ?? '',
    logisticsInfo: r.logisticsInfo ?? r.logistics,
    itemCount: r.itemCount,
    channel: r.channel,
    createTime: r.createTime,
  }
}

export { ordersApi }
