import { get, post } from '../request'

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
  list(params?: OrderListParams): Promise<OrderListResult> {
    return get('/admin/orders', params)
  },

  detail(orderNo: string): Promise<OrderInfo> {
    return get(`/admin/orders/${orderNo}`)
  },

  confirm(orderNo: string): Promise<void> {
    return post(`/admin/orders/${orderNo}/confirm`)
  },

  startDelivery(orderNo: string): Promise<void> {
    return post(`/admin/orders/${orderNo}/start-delivery`)
  },

  completeDelivery(orderNo: string): Promise<void> {
    return post(`/admin/orders/${orderNo}/complete-delivery`)
  },

  reject(orderNo: string, reason?: string): Promise<void> {
    return post(`/admin/orders/${orderNo}/reject`, { reason })
  },

  cancel(orderNo: string, reason?: string): Promise<void> {
    return post(`/admin/orders/${orderNo}/cancel`, { reason })
  },

  export(params?: OrderListParams): Promise<Blob> {
    return get('/admin/orders/export', params, { responseType: 'blob' })
  }
}

export { ordersApi }