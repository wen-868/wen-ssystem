import { get, post } from './request'
import type { PageResponse } from '@/types'
import type { OrderItem } from './order'

export type AftersaleType = 'REFUND' | 'RETURN' | 'EXCHANGE'

export type AftersaleStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

export interface AftersaleApplyRequest {
  orderId: number
  type: AftersaleType
  reason: string
  description?: string
  images?: string[]
  itemIds?: number[]
}

export interface AftersaleInfo {
  id: number
  aftersaleNo: string
  orderId: number
  orderNo: string
  type: AftersaleType
  status: AftersaleStatus
  reason: string
  description?: string
  images: string[]
  refundAmount?: number
  items: OrderItem[]
  applyTime: string
  processTime?: string
  completeTime?: string
  rejectReason?: string
  progress: AftersaleProgressItem[]
}

export interface AftersaleProgressItem {
  id: number
  status: string
  description: string
  time: string
  operator?: string
}

export interface AftersaleListParams {
  status?: AftersaleStatus | 'ALL'
  page?: number
  pageSize?: number
}

export const AFTERSALE_TYPE_TEXT: Record<AftersaleType, string> = {
  REFUND: '退款',
  RETURN: '退货退款',
  EXCHANGE: '换货'
}

export const AFTERSALE_STATUS_TEXT: Record<AftersaleStatus, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
  REJECTED: '已拒绝',
  CANCELLED: '已取消'
}

export const AFTERSALE_STATUS_COLOR: Record<AftersaleStatus, string> = {
  PENDING: '#faad14',
  PROCESSING: '#1890ff',
  COMPLETED: '#52c41a',
  REJECTED: '#ff4d4f',
  CANCELLED: '#999999'
}

export const aftersaleApi = {
  applyAftersale: (data: AftersaleApplyRequest): Promise<{ id: number }> => {
    return post('/miniapp/aftersale/apply', data as unknown as Record<string, unknown>)
  },

  getAftersaleList: (params: AftersaleListParams): Promise<PageResponse<AftersaleInfo>> => {
    return get('/miniapp/aftersale', params as unknown as Record<string, unknown>)
  },

  getAftersaleDetail: (id: number): Promise<AftersaleInfo> => {
    return get(`/miniapp/aftersale/${id}`)
  },

  cancelAftersale: (id: number): Promise<void> => {
    return post(`/miniapp/aftersale/${id}/cancel`)
  }
}
