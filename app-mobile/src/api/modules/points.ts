import { get, post } from '../request'

export interface PointsRecord {
  id: number
  memberId: number
  memberName: string
  memberMobile: string
  points: number
  type: 'earn' | 'spend' | 'expire'
  typeText: string
  reason: string
  createTime: string
}

export interface PointsListParams {
  page?: number
  pageSize?: number
  memberId?: number
  type?: string
}

export interface ExchangeItem {
  id: number
  name: string
  image?: string
  points: number
  stock: number
  category: string
}

export interface ExchangeListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface ExchangeResult {
  list: ExchangeItem[]
  total: number
  page: number
  pageSize: number
}

const pointsApi = {
  async records(params?: PointsListParams): Promise<{ list: PointsRecord[]; total: number }> {
    const res: any = await get('/admin/member/points/records', params)
    return (res?.result ?? res) as { list: PointsRecord[]; total: number }
  },

  async exchange(productId: number, memberId?: number): Promise<void> {
    return post('/admin/member/points/exchange', { productId, memberId })
  },

  async exchangeList(params?: ExchangeListParams): Promise<ExchangeResult> {
    const res: any = await get('/admin/member/points/exchange-list', params)
    return (res?.result ?? res) as ExchangeResult
  },

  async memberPoints(memberId: number): Promise<{ totalPoints: number; availablePoints: number }> {
    const res: any = await get(`/admin/member/points/${memberId}`)
    return (res?.result ?? res) as { totalPoints: number; availablePoints: number }
  }
}

export { pointsApi }