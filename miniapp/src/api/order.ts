import { get, post, put } from './request'
import type { PageResponse } from '@/types'

// 订单状态枚举
export type OrderStatus =
  | 'PENDING_PAY'     // 待付款
  | 'PENDING_SHIP'    // 待发货
  | 'PENDING_RECEIVE' // 待收货
  | 'COMPLETED'       // 已完成
  | 'CANCELLED'       // 已取消
  | 'AFTERSALE'       // 售后中

// 订单商品项
export interface OrderItem {
  id: number
  productId: number
  productName: string
  productImage: string
  skuId?: number
  skuName?: string
  price: number
  originalPrice?: number
  quantity: number
  subtotal: number
}

// 订单物流信息
export interface OrderLogistics {
  company: string
  trackingNo: string
  status: string
  traces: LogisticsTrace[]
}

// 物流跟踪节点
export interface LogisticsTrace {
  time: string
  description: string
  location?: string
  status: 'pickup' | 'transit' | 'delivery' | 'signed' | 'exception'
}

// 收货地址
export interface OrderAddress {
  id?: number
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
}

// 订单信息
export interface OrderInfo {
  id: number
  orderNo: string
  status: OrderStatus
  statusText: string
  totalAmount: number
  goodsAmount: number
  shippingFee: number
  discountAmount: number
  couponDiscount: number
  payAmount: number
  paymentMethod?: 'WECHAT' | 'ALIPAY' | 'CASH'
  paymentTime?: string
  createTime: string
  updateTime: string
  remark?: string
  items: OrderItem[]
  address?: OrderAddress
  logistics?: OrderLogistics
  countdown?: number // 付款倒计时（秒）
}

// 订单列表请求参数
export interface OrderListParams {
  status?: OrderStatus | 'ALL'
  page?: number
  pageSize?: number
  keyword?: string
}

// 创建订单请求
export interface CreateOrderRequest {
  itemIds: number[]
  addressId?: number
  address?: OrderAddress
  couponId?: number
  remark?: string
  paymentMethod: 'WECHAT' | 'ALIPAY' | 'CASH'
}

// 创建订单响应
export interface CreateOrderResponse {
  orderId: number
  orderNo: string
  totalAmount: number
  payAmount: number
}

// 支付参数
export interface PayOrderParams {
  orderId: number
  payMethod: 'WECHAT' | 'ALIPAY'
}

// 微信支付参数
export interface WechatPayParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

// 订单确认/结算预览
export interface OrderConfirmPreview {
  items: OrderItem[]
  address: OrderAddress | null
  availableCoupons: Array<{
    id: number
    name: string
    type: 'FIXED' | 'PERCENT' | 'SHIPPING'
    value: number
    minAmount: number
  }>
  goodsAmount: number
  shippingFee: number
  discountAmount: number
  couponDiscount: number
  totalAmount: number
}

export const orderApi = {
  // 获取订单列表
  getOrderList: (params: OrderListParams): Promise<PageResponse<OrderInfo>> => {
    return get('/miniapp/orders', params as Record<string, unknown>)
  },

  // 获取订单详情
  getOrderDetail: (orderId: number): Promise<OrderInfo> => {
    return get(`/miniapp/orders/${orderId}`)
  },

  // 获取订单确认预览（结算页）
  getOrderConfirm: (itemIds: number[]): Promise<OrderConfirmPreview> => {
    return get('/miniapp/orders/confirm/preview', { itemIds: itemIds.join(',') })
  },

  // 创建订单
  createOrder: (data: CreateOrderRequest): Promise<CreateOrderResponse> => {
    return post('/miniapp/orders', data as unknown as Record<string, unknown>)
  },

  // 取消订单
  cancelOrder: (orderId: number, reason?: string): Promise<void> => {
    return post(`/miniapp/orders/${orderId}/cancel`, { reason })
  },

  // 确认收货
  confirmReceive: (orderId: number): Promise<void> => {
    return post(`/miniapp/orders/${orderId}/confirm-receive`)
  },

  // 获取支付参数
  getPayParams: (orderId: number, payMethod: string): Promise<WechatPayParams> => {
    return post(`/miniapp/orders/${orderId}/pay`, { payMethod })
  },

  // 查询订单支付结果
  queryPayResult: (orderId: number): Promise<{ paid: boolean }> => {
    return get(`/miniapp/orders/${orderId}/pay-result`)
  },

  // 申请售后
  applyAftersale: (orderId: number, data: {
    type: 'REFUND' | 'RETURN' | 'EXCHANGE'
    reason: string
    description?: string
    images?: string[]
    itemIds?: number[]
  }): Promise<void> => {
    return post(`/miniapp/orders/${orderId}/aftersale`, data as Record<string, unknown>)
  },

  // 获取物流信息
  getLogistics: (orderId: number): Promise<OrderLogistics> => {
    return get(`/miniapp/orders/${orderId}/logistics`)
  },

  // 删除订单
  deleteOrder: (orderId: number): Promise<void> => {
    return put(`/miniapp/orders/${orderId}/delete`)
  }
}

// 订单状态文本映射
export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  PENDING_PAY: '待付款',
  PENDING_SHIP: '待发货',
  PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  AFTERSALE: '售后中'
}

// 订单状态颜色映射
export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING_PAY: '#ff4d4f',
  PENDING_SHIP: '#faad14',
  PENDING_RECEIVE: '#1890ff',
  COMPLETED: '#52c41a',
  CANCELLED: '#999999',
  AFTERSALE: '#722ed1'
}
