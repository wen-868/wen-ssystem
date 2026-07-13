import { get, post, put } from './request'
import type { PageResponse } from '@/types'

// ==================== 类型定义 ====================

// 批发商品分类
export interface WholesaleCategory {
  id: number
  name: string
  icon?: string
  image?: string
  sortOrder: number
}

// 批发阶梯价格
export interface WholesaleTierPrice {
  minQty: number      // 起订数量
  maxQty?: number     // 上限数量（null表示不设上限）
  price: number       // 对应单价
}

// 批发商品Sku
export interface WholesaleSku {
  id: number
  skuName: string
  skuCode: string
  wholesalePrice: number    // 批发价（基础）
  minOrderQty: number       // 起订量
  stock: number             // 库存
  image?: string
  tierPrices: WholesaleTierPrice[]  // 阶梯价格
  specs: Record<string, string>
}

// 批发商品规格
export interface WholesaleSpec {
  name: string
  values: string[]
}

// 批发商品列表项
export interface WholesaleProductItem {
  id: number
  name: string
  image: string
  wholesalePrice: number    // 最低批发价
  minOrderQty: number       // 最低起订量
  sales: number             // 销量
  categoryId: number
  categoryName: string
  unit: string              // 单位（箱/瓶/件）
}

// 批发商品详情
export interface WholesaleProductDetail {
  id: number
  name: string
  subtitle?: string
  images: string[]
  detailImages: string[]
  wholesalePrice: number    // 最低批发价
  retailPrice?: number      // 建议零售价
  minOrderQty: number       // 最低起订量
  sales: number
  stock: number
  unit: string
  categoryId: number
  categoryName: string
  brand?: string
  specs: WholesaleSpec[]
  skus: WholesaleSku[]
  tierPrices: WholesaleTierPrice[]  // 默认阶梯价（按SPU）
  description?: string
  params: Array<{ name: string; value: string }>
}

// 批发购物车项
export interface WholesaleCartItem {
  id: number
  productId: number
  productName: string
  productImage: string
  skuId: number
  skuName: string
  unitPrice: number         // 单价（根据数量计算后的阶梯价）
  quantity: number
  minOrderQty: number       // 起订量
  subtotal: number          // 小计
  unit: string
  selected: boolean
  tierPrices: WholesaleTierPrice[]
}

// 批发购物车
export interface WholesaleCart {
  items: WholesaleCartItem[]
  totalCount: number
  totalAmount: number
  discountAmount: number
  payAmount: number
}

// 批发订单状态
export type WholesaleOrderStatus =
  | 'PENDING_PAY'     // 待付款
  | 'PENDING_SHIP'    // 待发货
  | 'PENDING_RECEIVE' // 待收货
  | 'COMPLETED'       // 已完成
  | 'CANCELLED'       // 已取消

// 批发订单商品项
export interface WholesaleOrderItem {
  id: number
  productId: number
  productName: string
  productImage: string
  skuId: number
  skuName: string
  unitPrice: number
  quantity: number
  subtotal: number
  unit: string
}

// 批发订单收货地址
export interface WholesaleOrderAddress {
  id?: number
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
}

// 批发订单信息
export interface WholesaleOrderInfo {
  id: number
  orderNo: string
  status: WholesaleOrderStatus
  statusText: string
  totalAmount: number
  goodsAmount: number
  shippingFee: number
  discountAmount: number
  payAmount: number
  paymentMethod?: 'WECHAT' | 'ALIPAY' | 'BANK_TRANSFER' | 'CREDIT'
  paymentTime?: string
  createTime: string
  updateTime: string
  remark?: string
  items: WholesaleOrderItem[]
  address?: WholesaleOrderAddress
  trackingNo?: string
  logisticsCompany?: string
}

// 批发订单列表参数
export interface WholesaleOrderListParams {
  status?: WholesaleOrderStatus | 'ALL'
  page?: number
  pageSize?: number
  keyword?: string
}

// 创建批发订单请求
export interface CreateWholesaleOrderRequest {
  cartItemIds: number[]
  addressId?: number
  address?: WholesaleOrderAddress
  remark?: string
  paymentMethod: 'WECHAT' | 'ALIPAY' | 'BANK_TRANSFER' | 'CREDIT'
}

// 创建批发订单响应
export interface CreateWholesaleOrderResponse {
  orderId: number
  orderNo: string
  totalAmount: number
  payAmount: number
}

// 加入批发购物车请求
export interface AddWholesaleCartRequest {
  productId: number
  skuId: number
  quantity: number
}

// 批发商品列表参数
export interface WholesaleProductListParams {
  categoryId?: number
  keyword?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: string
}

// ==================== API 导出 ====================

export const wholesaleApi = {
  // ---------- 批发分类 ----------
  // 获取批发分类列表
  getCategories: (): Promise<WholesaleCategory[]> => {
    return get('/miniapp/wholesale/categories')
  },

  // ---------- 批发商品 ----------
  // 获取批发商品列表
  getProductList: (params: WholesaleProductListParams): Promise<PageResponse<WholesaleProductItem>> => {
    return get('/miniapp/wholesale/products', params as Record<string, unknown>)
  },

  // 获取批发商品详情
  getProductDetail: (id: number): Promise<WholesaleProductDetail> => {
    return get(`/miniapp/wholesale/products/${id}`)
  },

  // 计算阶梯价格
  calculateTierPrice: (skuId: number, quantity: number): Promise<{ unitPrice: number; subtotal: number }> => {
    return get('/miniapp/wholesale/calculate-price', { skuId, quantity })
  },

  // ---------- 批发购物车 ----------
  // 获取批发购物车
  getCart: (): Promise<WholesaleCart> => {
    return get('/miniapp/wholesale/cart')
  },

  // 加入批发购物车
  addToCart: (data: AddWholesaleCartRequest): Promise<{ cartItemId: number; totalCount: number }> => {
    return post('/miniapp/wholesale/cart', data as Record<string, unknown>)
  },

  // 更新购物车商品数量
  updateCartItem: (itemId: number, quantity: number): Promise<WholesaleCartItem> => {
    return put(`/miniapp/wholesale/cart/${itemId}`, { quantity })
  },

  // 删除购物车商品
  deleteCartItem: (itemIds: number[]): Promise<void> => {
    return post('/miniapp/wholesale/cart/delete', { itemIds })
  },

  // 切换购物车选中状态
  toggleCartSelect: (itemId: number, selected: boolean): Promise<void> => {
    return put(`/miniapp/wholesale/cart/${itemId}/select`, { selected })
  },

  // 全选/取消全选
  toggleCartSelectAll: (selected: boolean): Promise<void> => {
    return put('/miniapp/wholesale/cart/select-all', { selected })
  },

  // ---------- 批发订单 ----------
  // 获取批发订单列表
  getOrderList: (params: WholesaleOrderListParams): Promise<PageResponse<WholesaleOrderInfo>> => {
    return get('/miniapp/wholesale/orders', params as Record<string, unknown>)
  },

  // 获取批发订单详情
  getOrderDetail: (orderId: number): Promise<WholesaleOrderInfo> => {
    return get(`/miniapp/wholesale/orders/${orderId}`)
  },

  // 创建批发订单（批量下单）
  createOrder: (data: CreateWholesaleOrderRequest): Promise<CreateWholesaleOrderResponse> => {
    return post('/miniapp/wholesale/orders', data as Record<string, unknown>)
  },

  // 取消批发订单
  cancelOrder: (orderId: number, reason?: string): Promise<void> => {
    return post(`/miniapp/wholesale/orders/${orderId}/cancel`, { reason })
  },

  // 确认收货
  confirmReceive: (orderId: number): Promise<void> => {
    return post(`/miniapp/wholesale/orders/${orderId}/confirm-receive`)
  },

  // 获取订单确认预览
  getOrderConfirm: (cartItemIds: number[]): Promise<{
    items: WholesaleOrderItem[]
    address: WholesaleOrderAddress | null
    goodsAmount: number
    shippingFee: number
    discountAmount: number
    totalAmount: number
  }> => {
    return get('/miniapp/wholesale/orders/confirm/preview', { cartItemIds: cartItemIds.join(',') })
  },

  // 立即下单（从商品详情直接下单）
  buyNow: (data: {
    productId: number
    skuId: number
    quantity: number
    addressId?: number
    remark?: string
    paymentMethod: string
  }): Promise<CreateWholesaleOrderResponse> => {
    return post('/miniapp/wholesale/orders/buy-now', data as Record<string, unknown>)
  }
}

// ==================== 常量映射 ====================

// 订单状态文本
export const WHOLESALE_ORDER_STATUS_TEXT: Record<WholesaleOrderStatus, string> = {
  PENDING_PAY: '待付款',
  PENDING_SHIP: '待发货',
  PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

// 订单状态颜色
export const WHOLESALE_ORDER_STATUS_COLOR: Record<WholesaleOrderStatus, string> = {
  PENDING_PAY: '#ff4d4f',
  PENDING_SHIP: '#faad14',
  PENDING_RECEIVE: '#1890ff',
  COMPLETED: '#52c41a',
  CANCELLED: '#999999'
}

// 计算阶梯价格（本地计算，用于前端展示）
export function calculateTierPriceLocal(
  quantity: number,
  tierPrices: WholesaleTierPrice[]
): number {
  if (!tierPrices || tierPrices.length === 0) return 0

  // 按起订量从低到高排序
  const sorted = [...tierPrices].sort((a, b) => a.minQty - b.minQty)

  // 找到适用的最高档位
  let applicablePrice = sorted[0].price
  for (const tier of sorted) {
    if (quantity >= tier.minQty) {
      if (tier.maxQty === undefined || quantity <= tier.maxQty) {
        applicablePrice = tier.price
      }
    }
  }

  return applicablePrice
}
