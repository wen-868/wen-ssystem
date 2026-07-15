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
    return get('/miniapp/points')
  },

  getPointsRecords: (params?: PointsRecordParams): Promise<{
    total: number
    page: number
    pageSize: number
    records: PointsRecord[]
  }> => {
    return get('/miniapp/points/records', params as Record<string, unknown>)
  }
}
