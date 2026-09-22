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

export function listTenantsApi(params: { page: number; pageSize: number; keyword?: string; status?: string }) {
  return request.get('/platform/tenants', { params })
}

export function getTenantApi(id: number) {
  return request.get(`/platform/tenants/${id}`)
}

export function getTenantQuotaApi(tenantId: number) {
  return request.get(`/platform/tenants/${tenantId}/quota`)
}

/**
 * C1-1：租户使用统计。后端 GET /api/platform/tenants/usage-stats（platform-tenant.routes.ts:18）
 * 响应结构：{ overview:{ totalUsers,totalOrders,totalSales,totalProducts }, trendData:[{period,value}], moduleUsage }
 * ⚠️ 注意：这不是「各状态租户计数」（C1-2 的 /platform/tenants/stats），二者不是同一件事。
 * 传 tenantId 时 overview 四项为该租户口径；trendData 支持 period=day|week|month。
 */
export function getTenantUsageStatsApi(params: { tenantId?: number | string; metric?: string; period?: 'day' | 'week' | 'month'; dateStart?: string; dateEnd?: string }) {
  return request.get('/platform/tenants/usage-stats', { params })
}

/**
 * C1-2 A1：GET /api/platform/tenants/stats —— 各状态租户计数
 * 响应：{ total, counts:{normal,owed,frozen,cancelled,expired}, byStatus:[{status,count}], unmapped:[] }
 * ⚠️ 与 GET /platform/tenants/usage-stats **不是同一件事**（后者是使用量指标，无状态计数）。
 * 枚举口径见 backend/src/services/platform/tenant-status-stats.service.ts:39-41：
 *   正常 ← ACTIVE / '1'   停用 ← DISABLED / '0'   已到期 ← EXPIRED
 *   欠费(owed) / 已注销(cancelled) 后端无对应枚举 → 恒 0
 */
export function getTenantStatusStatsApi() {
  return request.get('/platform/tenants/stats')
}

/**
 * C1-2 A2：GET /api/platform/tenants/export —— 租户列表导出（CSV）
 * 响应：text/csv（BOM + Content-Disposition: attachment），另有 X-Export-Total / X-Export-Rows 头
 * ⚠️ 注意：request 拦截器只回传 response.data，拿不到响应头，故「已截断」提示本单未实现。
 */
export function exportTenantsApi(keyword?: string) {
  return request.get('/platform/tenants/export', {
    params: keyword ? { keyword } : {},
    responseType: 'blob',
  })
}

/**
 * C1-2 A3：GET /api/platform/tenants/:id/overview —— 单租户概况聚合（只读）
 * 响应含 goods/goodsCap/orders/ordersMomPct/staff/staffActive7d/docCount/store/storeRate，
 * 无数据源的维度返回 null 并在 unavailable[] 写明原因（后端零编造口径）。
 */
export function getTenantOverviewApi(id: number | string) {
  return request.get(`/platform/tenants/${id}/overview`)
}

/** C1-2 A4：POST /api/platform/tenants/:id/proxy-login —— 代登录（写操作 + t_platform_audit_log 留痕） */
export function proxyLoginTenantApi(id: number | string, data: { reason: string; username?: string }) {
  return request.post(`/platform/tenants/${id}/proxy-login`, data)
}

/** C1-2 A5：POST /api/platform/tenants/:id/quota-expand —— 临时扩容（写操作 + 留痕） */
export function expandTenantQuotaApi(
  id: number | string,
  data: { field: string; amount: number; days: number; reason?: string },
) {
  return request.post(`/platform/tenants/${id}/quota-expand`, data)
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

export function auditTenantApi(id: number, data: { result: string; remark?: string }) {
  return request.post(`/platform/tenants/${id}/audit`, data)
}
