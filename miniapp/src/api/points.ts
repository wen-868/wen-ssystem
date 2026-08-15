import { get } from './request'

export interface PointsInfo {
  totalPoints: number
  availablePoints: number
  frozenPoints: number
  expiringPoints: number
  expiringDate?: string
  levelName?: string
  levelIcon?: string
}

export interface PointsRecord {
  id: number
  type: 'EARN' | 'CONSUME' | 'EXPIRE'
  amount: number
  reason: string
  orderNo?: string
  createdAt: string
  expireAt?: string
}

export interface PointsRecordParams {
  type?: string
  page?: number
  pageSize?: number
}

export const POINTS_TYPE_TEXT: Record<string, string> = {
  EARN: '获得',
  CONSUME: '消耗',
  EXPIRE: '过期'
}

export const pointsApi = {
  getPointsInfo: (): Promise<PointsInfo> => {
    // 后端 miniapp 路由：GET /api/miniapp/member/points
    return get('/miniapp/member/points')
  },

  getPointsRecords: (params?: PointsRecordParams): Promise<{
    total: number
    page: number
    pageSize: number
    records: PointsRecord[]
  }> => {
    // 后端 marketing-miniapp 路由：GET /api/miniapp/marketing/points/my-records
    return get('/miniapp/marketing/points/my-records', params as Record<string, unknown>)
  }
}
