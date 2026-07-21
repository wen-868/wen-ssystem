import { get, post, put, del } from '../request'

// 优惠券模板类型
export interface CouponTemplate {
  id: number
  name: string
  type: 'full' | 'discount' | 'shipping'
  typeLabel: string
  amount: number
  discount?: number
  minAmount: number
  totalCount: number
  receivedCount: number
  usedCount: number
  perPersonLimit: number
  startTime: string
  endTime: string
  validityPeriod?: string
  status: 'not_started' | 'ongoing' | 'ended' | 'paused'
  statusLabel?: string
  scopeType: 'all' | 'category' | 'product'
  useCondition?: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface CouponListParams {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  keyword?: string
}

export interface CouponListResult {
  list: CouponTemplate[]
  total: number
  page: number
  pageSize: number
}

export interface CreateCouponParams {
  name: string
  type: 'full' | 'discount' | 'shipping'
  amount?: number
  discount?: number
  minAmount: number
  totalCount?: number
  perPersonLimit?: number
  startTime: string
  endTime: string
  scopeType: 'all' | 'category' | 'product'
  scopeIds?: number[]
  useCondition?: string
  description?: string
}

// 用户优惠券类型
export interface UserCoupon {
  id: number
  templateId: number
  templateName: string
  type: string
  typeLabel: string
  amount: number
  minAmount: number
  status: 'unused' | 'used' | 'expired'
  receivedAt: string
  usedAt?: string
  expireAt: string
}

const couponsApi = {
  // 优惠券模板列表
  async list(params?: CouponListParams): Promise<CouponListResult> {
    const res: any = await get('/admin/marketing/coupons/templates', params)
    return {
      list: res?.list ?? res?.result?.list ?? [],
      total: res?.total ?? res?.result?.total ?? 0,
      page: res?.page ?? params?.page ?? 1,
      pageSize: res?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  // 优惠券模板详情
  async detail(id: number): Promise<CouponTemplate> {
    const res: any = await get(`/admin/marketing/coupons/templates/${id}`)
    return (res?.result ?? res) as CouponTemplate
  },

  // 创建优惠券模板
  async create(data: CreateCouponParams): Promise<CouponTemplate> {
    const res: any = await post('/admin/marketing/coupons/templates', data)
    return (res?.result ?? res) as CouponTemplate
  },

  // 更新优惠券模板
  async update(id: number, data: Partial<CreateCouponParams>): Promise<CouponTemplate> {
    const res: any = await put(`/admin/marketing/coupons/templates/${id}`, data)
    return (res?.result ?? res) as CouponTemplate
  },

  // 删除优惠券模板
  async delete(id: number): Promise<void> {
    return del(`/admin/marketing/coupons/templates/${id}`)
  },

  // 启用优惠券
  async activate(id: number): Promise<void> {
    return post(`/admin/marketing/coupons/templates/${id}/activate`)
  },

  // 停用优惠券
  async pause(id: number): Promise<void> {
    return post(`/admin/marketing/coupons/templates/${id}/pause`)
  },

  // 用户优惠券列表
  async userCoupons(params?: {
    page?: number
    pageSize?: number
    status?: string
    userId?: number
    templateId?: number
  }): Promise<{ list: UserCoupon[]; total: number }> {
    const res: any = await get('/admin/marketing/coupons/user-coupons', params)
    return {
      list: res?.list ?? res?.result?.list ?? [],
      total: res?.total ?? res?.result?.total ?? 0,
    }
  },

  // 优惠券统计
  async statistics(): Promise<{
    totalCount: number
    receivedCount: number
    usedCount: number
    totalAmount: number
    usedAmount: number
  }> {
    const res: any = await get('/admin/marketing/coupons/statistics')
    return (res?.result ?? res) as any
  },
}

export { couponsApi }
