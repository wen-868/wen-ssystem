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

// ========== 后端契约映射（R102-02） ==========
// 路由实际挂载 controllers/admin/marketing-new.controller → services/admin/marketing-new-coupon.service，
// 真实列名为 template_name / coupon_type / coupon_value / min_purchase / total_quantity / issued_quantity /
// used_quantity / per_limit / valid_type / valid_start / valid_end / valid_days，状态枚举 DRAFT|ACTIVE|PAUSED。
// 旧 marketing-coupon.service 查询的是不存在的 total_count/claimed_count/used_count 列，为死代码，不可参照。

/** 后端 coupon_type → 前端展示类型（对应样式类 coupon-full / coupon-discount / coupon-shipping） */
const COUPON_TYPE_TO_UI: Record<string, CouponTemplate['type']> = {
  AMOUNT: 'full',
  DISCOUNT: 'discount',
  GIFT: 'shipping',
}
/** 前端展示类型 → 后端 coupon_type */
const COUPON_TYPE_TO_API: Record<string, 'AMOUNT' | 'DISCOUNT' | 'GIFT'> = {
  full: 'AMOUNT',
  discount: 'DISCOUNT',
  shipping: 'GIFT',
}
const COUPON_TYPE_LABEL: Record<string, string> = {
  AMOUNT: '满减券',
  DISCOUNT: '折扣券',
  GIFT: '赠品券',
}
/** 适用范围 scope 映射 */
const SCOPE_TO_UI: Record<string, CouponTemplate['scopeType']> = {
  ALL: 'all',
  STORE: 'all',
  CATEGORY: 'category',
  PRODUCT: 'product',
}
const SCOPE_TO_API: Record<string, 'ALL' | 'CATEGORY' | 'PRODUCT'> = {
  all: 'ALL',
  category: 'CATEGORY',
  product: 'PRODUCT',
}
/** 列表筛选：前端 tab → 后端 status 枚举（ended 后端无对应枚举，由前端按有效期推导） */
const STATUS_TO_API: Record<string, string> = {
  not_started: 'DRAFT',
  ongoing: 'ACTIVE',
  paused: 'PAUSED',
}

/** 统一把 'YYYY-MM-DD HH:mm:ss' / Date 转成可读日期（yyyy-MM-dd），无法解析时原样返回 */
function fmtDate(v: unknown): string {
  if (v == null || v === '') return ''
  const s = String(v)
  const d = new Date(s.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return s.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 后端 status（DRAFT/ACTIVE/PAUSED）→ 前端展示状态；ACTIVE 且已过有效期 → ended */
function mapCouponStatus(raw: unknown, validEnd?: unknown): CouponTemplate['status'] {
  const s = String(raw ?? '').toUpperCase()
  if (s === 'PAUSED') return 'paused'
  if (s === 'DRAFT') return 'not_started'
  if (s === 'ACTIVE') {
    const end = validEnd ? new Date(String(validEnd).replace(' ', 'T')).getTime() : NaN
    if (!Number.isNaN(end) && end > 0 && end < Date.now()) return 'ended'
    return 'ongoing'
  }
  return 'not_started'
}

/** 券模板行 → 前端 CouponTemplate（金额字段统一 Number，避免 DECIMAL 字符串进入视图层） */
function mapTemplate(r: any): CouponTemplate {
  const couponType = String(r.couponType ?? r.coupon_type ?? '')
  const validType = String(r.validType ?? r.valid_type ?? '')
  const validStart = r.validStart ?? r.valid_start
  const validEnd = r.validEnd ?? r.valid_end
  const validDays = r.validDays ?? r.valid_days
  const status = mapCouponStatus(r.status, validEnd)
  return {
    id: Number(r.id ?? 0),
    name: r.templateName ?? r.template_name ?? '',
    type: COUPON_TYPE_TO_UI[couponType] ?? 'full',
    typeLabel: COUPON_TYPE_LABEL[couponType] ?? couponType,
    amount: Number(r.couponValue ?? r.coupon_value ?? 0),
    discount: r.maxDiscount != null || r.max_discount != null
      ? Number(r.maxDiscount ?? r.max_discount)
      : undefined,
    minAmount: Number(r.minPurchase ?? r.min_purchase ?? 0),
    totalCount: Number(r.totalQuantity ?? r.total_quantity ?? 0),
    receivedCount: Number(r.issuedQuantity ?? r.issued_quantity ?? 0),
    usedCount: Number(r.usedQuantity ?? r.used_quantity ?? 0),
    perPersonLimit: Number(r.perLimit ?? r.per_limit ?? 1),
    startTime: validStart ? String(validStart) : '',
    endTime: validEnd ? String(validEnd) : '',
    validityPeriod: validType === 'DAYS'
      ? `领取后 ${Number(validDays ?? 0)} 天有效`
      : (validStart || validEnd ? `${fmtDate(validStart)} ~ ${fmtDate(validEnd)}` : '长期有效'),
    status,
    scopeType: SCOPE_TO_UI[String(r.applicableScope ?? r.applicable_scope ?? '')] ?? 'all',
    useCondition: r.description ?? undefined,
    description: r.description ?? undefined,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  }
}

/** 用户券行 → 前端 UserCoupon */
function mapUserCoupon(r: any): UserCoupon {
  const couponType = String(r.couponType ?? r.coupon_type ?? '')
  const rawStatus = String(r.status ?? '').toUpperCase()
  const status: UserCoupon['status'] = rawStatus === 'USED'
    ? 'used'
    : (rawStatus === 'EXPIRED' ? 'expired' : 'unused')
  return {
    id: Number(r.id ?? 0),
    templateId: Number(r.templateId ?? r.template_id ?? 0),
    templateName: r.couponName ?? r.coupon_name ?? r.templateName ?? '',
    type: COUPON_TYPE_TO_UI[couponType] ?? 'full',
    typeLabel: COUPON_TYPE_LABEL[couponType] ?? couponType,
    amount: Number(r.couponValue ?? r.coupon_value ?? 0),
    minAmount: Number(r.minPurchase ?? r.min_purchase ?? 0),
    status,
    receivedAt: String(r.createdAt ?? r.created_at ?? ''),
    usedAt: r.usedAt ?? r.used_at ?? undefined,
    expireAt: String(r.validEnd ?? r.valid_end ?? ''),
  }
}

const couponsApi = {
  // 优惠券模板列表
  async list(params?: CouponListParams): Promise<CouponListResult> {
    // 后端返回 { total, page, pageSize, records }；status 为后端枚举，需翻译（ended 无对应枚举，传空由页面本地过滤）
    const apiStatus = params?.status ? STATUS_TO_API[params.status] : undefined
    const res: any = await get('/admin/marketing/coupons/templates', {
      ...params,
      status: apiStatus,
    })
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapTemplate),
      total: Number(raw?.total ?? rows.length),
      page: Number(raw?.page ?? params?.page ?? 1),
      pageSize: Number(raw?.pageSize ?? params?.pageSize ?? 20),
    }
  },

  // 优惠券模板详情
  async detail(id: number): Promise<CouponTemplate> {
    const res: any = await get(`/admin/marketing/coupons/templates/${id}`)
    return mapTemplate(res?.result ?? res ?? {})
  },

  // 创建优惠券模板：前端字段 → 后端 Zod（templateName/couponType/couponValue/minPurchase/
  // applicableScope/validType 为必填，字段名错配会 400 且旧实现 catch 静默）
  async create(data: CreateCouponParams): Promise<CouponTemplate> {
    const validStart = data.startTime
    const validEnd = data.endTime
    const res: any = await post('/admin/marketing/coupons/templates', {
      templateName: data.name,
      couponType: COUPON_TYPE_TO_API[data.type] ?? 'AMOUNT',
      couponValue: Number(data.discount ?? data.amount ?? 0),
      minPurchase: Number(data.minAmount ?? 0),
      totalQuantity: Number(data.totalCount ?? 0),
      perLimit: Number(data.perPersonLimit ?? 1),
      applicableScope: SCOPE_TO_API[data.scopeType] ?? 'ALL',
      applicableIds: data.scopeIds,
      validType: validStart || validEnd ? 'FIXED' : 'DAYS',
      validStart: validStart || undefined,
      validEnd: validEnd || undefined,
      description: data.useCondition || data.description || undefined,
    })
    return mapTemplate(res?.result ?? res ?? {})
  },

  // 更新优惠券模板（同样做字段与枚举翻译，仅提交显式传入的键）
  async update(id: number, data: Partial<CreateCouponParams>): Promise<CouponTemplate> {
    const body: Record<string, unknown> = {}
    if (data.name !== undefined) body.templateName = data.name
    if (data.type !== undefined) body.couponType = COUPON_TYPE_TO_API[data.type] ?? 'AMOUNT'
    if (data.discount !== undefined || data.amount !== undefined) {
      body.couponValue = Number(data.discount ?? data.amount ?? 0)
    }
    if (data.minAmount !== undefined) body.minPurchase = Number(data.minAmount)
    if (data.totalCount !== undefined) body.totalQuantity = Number(data.totalCount)
    if (data.perPersonLimit !== undefined) body.perLimit = Number(data.perPersonLimit)
    if (data.scopeType !== undefined) body.applicableScope = SCOPE_TO_API[data.scopeType] ?? 'ALL'
    if (data.scopeIds !== undefined) body.applicableIds = data.scopeIds
    if (data.startTime !== undefined || data.endTime !== undefined) body.validType = 'FIXED'
    if (data.startTime !== undefined) body.validStart = data.startTime
    if (data.endTime !== undefined) body.validEnd = data.endTime
    if (data.useCondition !== undefined || data.description !== undefined) {
      body.description = data.useCondition || data.description
    }
    const res: any = await put(`/admin/marketing/coupons/templates/${id}`, body)
    return mapTemplate(res?.result ?? res ?? {})
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
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map(mapUserCoupon),
      total: Number(raw?.total ?? rows.length),
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
