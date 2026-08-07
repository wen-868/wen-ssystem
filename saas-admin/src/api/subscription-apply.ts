import request from '../utils/request'

export interface SubscriptionApply {
  id: number
  planId: number
  planName: string
  company: string
  contact: string
  mobile: string
  remark: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  auditRemark: string
  auditedAt: string | null
  createdAt: string
}

export interface ListSubscriptionAppliesParams {
  page: number
  pageSize: number
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface ListSubscriptionAppliesResponse {
  list: SubscriptionApply[]
  total: number
  page: number
  pageSize: number
}

/** 订阅申请列表（后端 PENDING 优先） */
export function listSubscriptionApplies(params: ListSubscriptionAppliesParams) {
  return request.get<ListSubscriptionAppliesResponse>('/platform/subscription-applies', { params })
}

/** 订阅申请详情 */
export function getSubscriptionApply(id: number) {
  return request.get<SubscriptionApply>(`/platform/subscription-applies/${id}`)
}

/** 审核订阅申请（通过/驳回） */
export function auditSubscriptionApply(id: number, action: 'APPROVED' | 'REJECTED', auditRemark?: string) {
  return request.put<SubscriptionApply>(`/platform/subscription-applies/${id}/audit`, { action, auditRemark })
}
