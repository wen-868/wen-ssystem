import request from '../utils/request'

export interface TenantItem {
  id: number
  tenantName: string
  contactName: string
  contactMobile: string
  status: string
  expireAt: string
  createdAt: string
}

export function listTenantsApi(params: { page: number; pageSize: number; keyword?: string }) {
  return request.get('/platform/tenants', { params })
}

export function getTenantApi(id: number) {
  return request.get(`/platform/tenants/${id}`)
}

export function createTenantApi(data: any) {
  return request.post('/platform/tenants', data)
}

export function updateTenantApi(id: number, data: any) {
  return request.put(`/platform/tenants/${id}`, data)
}

export function toggleTenantApi(id: number, status: string) {
  return request.post(`/platform/tenants/${id}/toggle`, { status })
}