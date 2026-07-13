import { get, post } from '../request'

export interface StoredCard {
  id: number
  cardNo: string
  memberName: string
  memberMobile: string
  balance: number
  status: 'active' | 'locked' | 'disabled'
  statusText?: string
  createdAt?: string
  updatedAt?: string
}

export interface StoredCardListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}

export interface StoredCardListResult {
  list: StoredCard[]
  total: number
  page: number
  pageSize: number
}

export interface RechargeRecord {
  id: number
  cardNo: string
  memberName: string
  amount: number
  operator?: string
  createTime: string
}

export interface ConsumeRecord {
  id: number
  cardNo: string
  memberName: string
  amount: number
  orderNo?: string
  createTime: string
}

const storedCardApi = {
  async list(params?: StoredCardListParams): Promise<StoredCardListResult> {
    const res: any = await get('/admin/member/stored-cards', params)
    return (res?.result ?? res) as StoredCardListResult
  },

  async detail(id: number): Promise<StoredCard> {
    const res: any = await get(`/admin/member/stored-cards/${id}`)
    return (res?.result ?? res) as StoredCard
  },

  async recharge(id: number, amount: number, operator?: string): Promise<void> {
    return post('/admin/member/stored-cards/recharge', { cardId: id, amount, operator })
  },

  async lock(id: number): Promise<void> {
    return post(`/admin/member/stored-cards/${id}/lock`)
  },

  async unlock(id: number): Promise<void> {
    return post(`/admin/member/stored-cards/${id}/unlock`)
  },

  async rechargeRecords(params?: { page?: number; pageSize?: number; cardId?: number }): Promise<{ list: RechargeRecord[]; total: number }> {
    const res: any = await get('/admin/member/stored-cards/recharge-records', params)
    return (res?.result ?? res) as { list: RechargeRecord[]; total: number }
  },

  async consumeRecords(params?: { page?: number; pageSize?: number; cardId?: number }): Promise<{ list: ConsumeRecord[]; total: number }> {
    const res: any = await get('/admin/member/stored-cards/consume-records', params)
    return (res?.result ?? res) as { list: ConsumeRecord[]; total: number }
  }
}

export { storedCardApi }