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
    // R94-03：原 /admin/member/points/records 不存在，改为 /admin/marketing/points/records（admin-marketing-points.routes.ts）
    const res: any = await get('/admin/marketing/points/records', params)
    const raw = res?.result ?? res
    const rows: any[] = raw?.records ?? raw?.list ?? (Array.isArray(raw) ? raw : [])
    return {
      list: rows.map((r: any) => ({
        id: r.id,
        memberId: r.memberId ?? r.userId ?? r.member_id,
        memberName: r.memberName ?? r.member_name ?? r.userName ?? '',
        memberMobile: r.memberMobile ?? r.member_mobile ?? r.mobile ?? '',
        points: Number(r.points ?? r.change ?? 0),
        type: r.type ?? 'earn',
        typeText: r.typeText ?? r.type_text ?? '',
        reason: r.reason ?? r.remark ?? '',
        createTime: r.createTime ?? r.createdAt ?? r.created_at ?? '',
      })),
      total: raw?.total ?? rows.length,
    }
  },

  async exchange(productId: number, memberId?: number): Promise<void> {
    // R94-03：原 /admin/member/points/exchange 不存在，改为 /admin/marketing/points/redeem
    return post('/admin/marketing/points/redeem', { productId, memberId })
  },

  async exchangeList(params?: ExchangeListParams): Promise<ExchangeResult> {
    // R94-03：原 /admin/member/points/exchange-list 不存在，改为 /admin/marketing/points-mall/products（积分商城商品）
    const res: any = await get('/admin/marketing/points-mall/products', params)
    return (res?.result ?? res) as ExchangeResult
  },

  async memberPoints(memberId: number): Promise<{ totalPoints: number; availablePoints: number }> {
    // R94-03：原 /admin/member/points/:memberId 不存在，改为 /admin/marketing/points/user/:userId
    const res: any = await get(`/admin/marketing/points/user/${memberId}`)
    const raw = res?.result ?? res
    return {
      totalPoints: Number(raw?.points ?? raw?.totalPoints ?? raw?.totalEarned ?? 0),
      availablePoints: Number(raw?.points ?? raw?.availablePoints ?? 0),
    }
  }
}

export { pointsApi }
