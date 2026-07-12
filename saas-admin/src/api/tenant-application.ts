import request from '../utils/request'

export interface TenantApplication {
  id: number
  company_name: string
  company_short_name: string
  contact_person: string
  contact_mobile: string
  contact_email: string
  province: string
  city: string
  district: string
  address: string
  business_license: string
  legal_person: string
  industry: string
  company_scale: string
  admin_username: string
  admin_real_name: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reject_reason?: string
  reviewed_at?: string
  reviewed_by?: number
  created_at: string
  updated_at: string
}

export interface ListApplicationsParams {
  page: number
  pageSize: number
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface ListApplicationsResponse {
  items: TenantApplication[]
  total: number
  page: number
  pageSize: number
}

export function listApplications(params: ListApplicationsParams) {
  return request.get<ListApplicationsResponse>('/tenant/applications', { params })
}

export function getApplication(id: number) {
  return request.get<TenantApplication>(`/tenant/applications/${id}`)
}

export function approveApplication(id: number, reviewerId?: number) {
  return request.post(`/tenant/applications/${id}/approve`, { reviewerId })
}

export function rejectApplication(id: number, rejectReason: string, reviewerId?: number) {
  return request.post(`/tenant/applications/${id}/reject`, { rejectReason, reviewerId })
}
