import { get, post } from './request'

export interface CouponTemplate {
  id: number
  name: string
  type: 'FIXED' | 'PERCENT' | 'SHIPPING' | 'FREE_GIFT'
  value: number
  minAmount: number
  totalCount: number
  usedCount: number
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED'
  startTime: string
  endTime: string
  description: string
}

export interface UserCoupon {
  id: number
  templateId: number
  name: string
  type: 'FIXED' | 'PERCENT' | 'SHIPPING' | 'FREE_GIFT'
  value: number
  minAmount: number
  status: 'UNUSED' | 'USED' | 'EXPIRED'
  claimedAt: string
  endTime: string
  orderId?: number
}

export interface ClaimResponse {
  coupon: UserCoupon
  success: boolean
}

export const couponApi = {
  getAvailableCoupons: (): Promise<CouponTemplate[]> => {
    return get('/miniapp/marketing/coupons/available')
  },

  claimCoupon: (templateId: number): Promise<ClaimResponse> => {
    return post(`/miniapp/marketing/coupons/${templateId}/claim`)
  },

  getMyCoupons: (params?: { page?: number; pageSize?: number; status?: string }): Promise<{
    total: number
    page: number
    pageSize: number
    records: UserCoupon[]
  }> => {
    return get('/miniapp/marketing/coupons/mine', params)
  }
}
