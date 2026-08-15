import { get, post, put, del } from './request'

export interface CartItem {
  id: number
  productId: number
  productName: string
  productImage: string
  skuId?: number
  skuName?: string
  price: number
  originalPrice?: number
  quantity: number
  selected: boolean
}

export interface CheckoutPreview {
  items: CartItem[]
  subtotal: number
  shippingFee: number
  discountAmount: number
  couponDiscount: number
  totalAmount: number
  availableCoupons: CouponInfo[]
}

export interface CouponInfo {
  id: number
  templateId: number
  name: string
  type: 'FIXED' | 'PERCENT' | 'SHIPPING' | 'FREE_GIFT'
  value: number
  minAmount: number
  status: 'UNUSED' | 'USED' | 'EXPIRED'
  endTime: string
}

export interface CreateOrderRequest {
  itemIds: number[]
  address: AddressInfo
  couponId?: number
  remark?: string
  paymentMethod: 'WECHAT' | 'ALIPAY' | 'CASH'
}

export interface AddressInfo {
  id?: number
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
}

export interface CreateOrderResponse {
  orderNo: string
  orderId: number
  totalAmount: number
}

export const cartApi = {
  getCart: (): Promise<CartItem[]> => {
    return get('/miniapp/cart')
  },

  addToCart: (skuId: number, quantity: number): Promise<void> => {
    return post('/miniapp/cart/add', { skuId, quantity })
  },

  updateCartItem: (id: number, quantity: number): Promise<void> => {
    return put(`/miniapp/cart/items/${id}`, { quantity })
  },

  removeCartItem: (id: number): Promise<void> => {
    return del(`/miniapp/cart/items/${id}`)
  },

  clearCart: (): Promise<void> => {
    return del('/miniapp/cart/clear')
  },

  getCartCount: (): Promise<{ count: number }> => {
    return get('/miniapp/cart/count')
  },

  checkoutPreview: (itemIds: number[]): Promise<CheckoutPreview> => {
    return get('/miniapp/cart/checkout/preview', { itemIds: itemIds.join(',') })
  },

  createOrder: (data: CreateOrderRequest): Promise<CreateOrderResponse> => {
    return post('/miniapp/cart/checkout/create', data as unknown as Record<string, unknown>)
  }
}
