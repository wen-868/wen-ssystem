import { get, post } from '../request'

export interface StoredCard {
  cardNo: string
  id?: number | string
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
    // R94-03：原 /admin/member/stored-cards 不存在，改为 /admin/store-value-cards（store-value-card.routes.ts）
    const res: any = await get('/admin/store-value-cards', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    const list: StoredCard[] = rows.map((r: any) => ({
      cardNo: r.cardNo ?? r.card_no ?? '',
      id: r.cardNo ?? r.card_no ?? r.id,
      memberName: r.customerName ?? r.customer_name ?? r.memberName ?? '',
      memberMobile: r.memberMobile ?? r.mobile ?? r.phone ?? '',
      balance: Number(r.balance ?? 0),
      status: r.status === 'FROZEN' || r.status === 'LOCKED' ? 'locked' : r.status === 'DISABLED' ? 'disabled' : 'active',
      statusText: r.statusText ?? r.status_text,
      createdAt: r.createdAt ?? r.created_at,
      updatedAt: r.updatedAt ?? r.updated_at,
    }))
    return {
      list,
      total: raw?.total ?? list.length,
      page: raw?.page ?? params?.page ?? 1,
      pageSize: raw?.pageSize ?? params?.pageSize ?? 20,
    }
  },

  async detail(cardNo: string): Promise<StoredCard> {
    // R94-03：真实接口为 GET /admin/store-value-cards/:cardNo（参数为卡号而非 id）
    const res: any = await get(`/admin/store-value-cards/${cardNo}`)
    return (res?.result ?? res) as StoredCard
  },

  async recharge(cardNo: string, amount: number, operator?: string): Promise<void> {
    // R94-03：真实接口为 POST /admin/store-value-cards/:cardNo/recharge
    return post(`/admin/store-value-cards/${cardNo}/recharge`, { amount, operator })
  },

  async lock(cardNo: string): Promise<void> {
    // R94-03：真实接口为 POST /admin/store-value-cards/:cardNo/freeze
    return post(`/admin/store-value-cards/${cardNo}/freeze`)
  },

  async unlock(cardNo: string): Promise<void> {
    // R94-03：真实接口为 POST /admin/store-value-cards/:cardNo/unfreeze
    return post(`/admin/store-value-cards/${cardNo}/unfreeze`)
  },

  async rechargeRecords(params?: { page?: number; pageSize?: number; cardNo?: string }): Promise<{ list: RechargeRecord[]; total: number }> {
    // R94-03：真实接口为 GET /admin/store-value-cards/:cardNo/transactions，按 type=RECHARGE 过滤
    const res: any = await get(`/admin/store-value-cards/${params?.cardNo ?? ''}/transactions`, { page: params?.page, pageSize: params?.pageSize })
    return mapTransactions(res, 'RECHARGE')
  },

  async consumeRecords(params?: { page?: number; pageSize?: number; cardNo?: string }): Promise<{ list: ConsumeRecord[]; total: number }> {
    // R94-03：真实接口为 GET /admin/store-value-cards/:cardNo/transactions，按 type=CONSUME 过滤
    const res: any = await get(`/admin/store-value-cards/${params?.cardNo ?? ''}/transactions`, { page: params?.page, pageSize: params?.pageSize })
    return mapTransactions(res, 'CONSUME')
  }
}

function mapTransactions(res: any, type: string): { list: any[]; total: number } {
  const raw = res?.result ?? res
  const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
  const filtered = rows.filter((r: any) => !type || r.type === type)
  return {
    list: filtered.map((r: any) => ({
      id: r.transNo ?? r.id,
      cardNo: r.cardNo ?? r.card_no ?? '',
      memberName: r.customerName ?? r.memberName ?? '',
      amount: Number(r.amount ?? 0),
      operator: r.operatorName ?? r.operator_name,
      orderNo: r.sourceNo ?? r.source_no,
      createTime: r.createdAt ?? r.created_at ?? '',
    })),
    total: raw?.total ?? filtered.length,
  }
}

export { storedCardApi }
