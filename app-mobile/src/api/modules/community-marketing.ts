import { get, post } from '../request'

// ==================== 拼团活动 ====================

export interface GroupBuyActivity {
  id: number
  name: string
  productId: number
  skuId: number
  groupPrice: number
  originalPrice: number
  minGroupSize: number
  maxGroupSize: number
  timeLimitHours: number
  totalStock: number
  soldCount: number
  status: 'DRAFT' | 'ACTIVE' | 'ENDED'
  startTime: string
  endTime: string
  createdAt: string
  updatedAt?: string
}

export interface GroupBuyTeam {
  id: number
  activityId: number
  leaderId: number
  currentSize: number
  targetSize: number
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  expiresAt: string
  createdAt: string
  activityName?: string
  groupPrice?: number
  message?: string
}

export interface GroupBuyListParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}

export interface GroupBuyListResult {
  total: number
  page: number
  pageSize: number
  records: GroupBuyActivity[]
}

// ==================== 砍价活动 ====================

export interface BargainActivity {
  id: number
  activityName: string
  activityDesc?: string
  productId: number
  skuId: number
  originalPrice: number
  minPrice: number
  totalStock: number
  soldCount: number
  bargainTimes: number
  timeLimitHours: number
  helpMinAmount: number
  helpMaxAmount: number
  startTime: string
  endTime: string
  status: 'DRAFT' | 'ACTIVE' | 'ENDED'
  createdAt: string
  updatedAt?: string
}

export interface BargainRecord {
  id: number
  activityId: number
  initiatorId: number
  currentPrice: number
  bargainCount: number
  status: 'ONGOING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
}

export interface BargainHelpResult {
  recordId: number
  bargainAmount: number
  currentPrice: number
  bargainCount: number
  status: string
  isSuccess: boolean
}

export interface BargainListParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}

export interface BargainListResult {
  total: number
  page: number
  pageSize: number
  records: BargainActivity[]
}

// ==================== 秒杀活动 ====================

export interface SeckillActivity {
  id: number
  productId: number
  productName: string
  seckillPrice: number
  originalPrice: number
  seckillStock: number
  availableStock: number
  limitPerUser: number
  startTime: string
  endTime: string
  status: 'DRAFT' | 'ACTIVE' | 'ENDED'
}

export interface SeckillOrderResult {
  orderNo: string
  activityId: number
  productId: number
  productName?: string
  seckillPrice: number
  quantity: number
  totalAmount: number
}

export interface SeckillListParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}

export interface SeckillListResult {
  total: number
  page: number
  pageSize: number
  records: SeckillActivity[]
}

// ==================== API ====================

const communityMarketingApi = {
  // ---- 拼团 ----
  async listGroupBuys(params?: GroupBuyListParams): Promise<GroupBuyListResult> {
    const res: any = await get('/marketing/group-buy', params)
    return (res?.result ?? res) as GroupBuyListResult
  },

  async getGroupBuy(id: number): Promise<GroupBuyActivity> {
    const res: any = await get(`/marketing/group-buy/${id}`)
    return (res?.result ?? res) as GroupBuyActivity
  },

  async startGroupBuy(activityId: number, quantity = 1): Promise<GroupBuyTeam> {
    const res: any = await post(`/marketing/group-buy/${activityId}/start`, { quantity })
    return (res?.result ?? res) as GroupBuyTeam
  },

  async joinGroupBuy(teamId: number, quantity = 1): Promise<any> {
    const res: any = await post(`/marketing/group-buy/${teamId}/join`, { quantity })
    return res?.result ?? res
  },

  // ---- 砍价 ----
  async listBargains(params?: BargainListParams): Promise<BargainListResult> {
    const res: any = await get('/marketing/bargain', params)
    return (res?.result ?? res) as BargainListResult
  },

  async getBargain(id: number): Promise<BargainActivity> {
    const res: any = await get(`/marketing/bargain/${id}`)
    return (res?.result ?? res) as BargainActivity
  },

  async startBargain(activityId: number): Promise<BargainRecord> {
    const res: any = await post(`/marketing/bargain/${activityId}/start`, {})
    return (res?.result ?? res) as BargainRecord
  },

  async helpBargain(recordId: number, helperName?: string): Promise<BargainHelpResult> {
    const res: any = await post(`/marketing/bargain/${recordId}/help`, { helperName })
    return (res?.result ?? res) as BargainHelpResult
  },

  // ---- 秒杀 ----
  async listSeckills(params?: SeckillListParams): Promise<SeckillListResult> {
    const res: any = await get('/marketing/seckill', params)
    return (res?.result ?? res) as SeckillListResult
  },

  async getSeckill(id: number): Promise<SeckillActivity> {
    const res: any = await get(`/marketing/seckill/${id}`)
    return (res?.result ?? res) as SeckillActivity
  },

  async buySeckill(activityId: number, quantity = 1): Promise<SeckillOrderResult> {
    const res: any = await post(`/marketing/seckill/${activityId}/buy`, { quantity })
    return (res?.result ?? res) as SeckillOrderResult
  },
}

export { communityMarketingApi }
