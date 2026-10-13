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
    // 后端 marketing-miniapp 路由：POST /api/miniapp/marketing/coupons/:templateId/claim
    // S3-187 A：契约（docs/API接口文档.md:2839）为带参路径，模板 id 走路径参数——
    // 旧写法把 templateId 放 body、而路由无该参数，controller 读到 NaN ⇒ 恒 404。
    return post(`/miniapp/marketing/coupons/${templateId}/claim`)
  },

  getMyCoupons: (params?: { page?: number; pageSize?: number; status?: string }): Promise<{
    total: number
    page: number
    pageSize: number
    records: UserCoupon[]
  }> => {
    // 后端 marketing-miniapp 路由：GET /api/miniapp/marketing/coupons/my
    return get('/miniapp/marketing/coupons/my', params)
  }
}
