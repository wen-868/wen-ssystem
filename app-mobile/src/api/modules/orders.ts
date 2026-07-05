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
}

export interface OrderLog {
  id?: number
  action: string
  operator: string
  remark?: string
  createdAt: string
}

export interface OrderListParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
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
  }
}

export { ordersApi }