import { api } from "./request";

// ==================== Subscription APIs ====================
export const fetchSubscriptions = (params: any) => api.get('/admin/subscriptions', { params });
export const fetchSubscriptionPlans = (params?: any) => api.get('/admin/subscription-plans', { params });
export const createSubscription = (data: any) => api.post('/admin/subscriptions', data);
export const createSubscriptionPlan = (data: any) => api.post('/admin/subscription-plans', data);
export const updateSubscriptionPlan = (id: number, data: any) => api.put(`/admin/subscription-plans/${id}`, data);
export const changeSubscriptionPlan = (id: number, data: any) => api.put(`/admin/subscriptions/${id}/change-plan`, data);
export const cancelSubscription = (id: number) => api.post(`/admin/subscriptions/${id}/cancel`);
export const paySubscription = (id: number) => api.post(`/admin/subscriptions/${id}/pay`);
export const renewSubscription = (id: number) => api.post(`/admin/subscriptions/${id}/renew`);
export const fetchExpiringSubscriptions = () => api.get('/admin/subscriptions/expiring');
export const fetchExpiredSubscriptions = () => api.get('/admin/subscriptions/expired');


// ==================== Tenant APIs ====================
export const fetchTenants = (params: any) => api.get('/admin/tenants', { params });
export const createTenant = (data: any) => api.post('/admin/tenants', data);
export const updateTenant = (id: number, data: any) => api.put(`/admin/tenants/${id}`, data);
export const changeTenantStatus = (id: number, status: string) => api.patch(`/admin/tenants/${id}/status`, { status });
export const fetchTenantDetail = (id: number) => api.get(`/admin/tenants/${id}`);
export const fetchTenantModules = (id: number) => api.get(`/admin/tenants/${id}/modules`);


// ==================== 租户注册 API ====================
export async function tenantRegister(payload: {
  company_name: string;
  company_short_name?: string;
  contact_person: string;
  contact_mobile: string;
  contact_email?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  business_license?: string;
  legal_person?: string;
  industry?: string;
  company_scale?: string;
  admin_username: string;
  admin_password: string;
  admin_real_name: string;
}) {
  const { data } = await api.post("/tenant/register", payload);
  return data.data;
}


// ==================== 入驻审核 API ====================
export async function fetchTenantApplications(params?: {
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get("/tenant/applications", { params });
  return data.data;
}

export async function getTenantApplicationDetail(id: number) {
  const { data } = await api.get(`/tenant/applications/${id}`);
  return data.data;
}

export async function approveTenantApplication(id: number, payload?: { remark?: string }) {
  const { data } = await api.post(`/tenant/applications/${id}/approve`, payload);
  return data.data;
}

export async function rejectTenantApplication(id: number, payload: { remark: string }) {
  const { data } = await api.post(`/tenant/applications/${id}/reject`, payload);
  return data.data;
}


// ==================== PlatformAnnouncement 扩展 API ====================
export async function revokePlatformAnnouncement(id: number) {
  const { data } = await api.post(`/admin/platform-announcements/${id}/revoke`, {});
  return data.data;
}

export async function pinPlatformAnnouncement(id: number) {
  const { data } = await api.post(`/admin/platform-announcements/${id}/pin`, {});
  return data.data;
}

export async function unpinPlatformAnnouncement(id: number) {
  const { data } = await api.post(`/admin/platform-announcements/${id}/unpin`, {});
  return data.data;
}


// ==================== PlatformAuditLog API ====================
export async function fetchPlatformAuditLogs(params?: {
  page?: number;
  pageSize?: number;
  operationType?: string;
  adminName?: string;
  module?: string;
  keyword?: string;
  startTime?: string;
  endTime?: string;
}) {
  const { data } = await api.get("/admin/platform-audit-logs", { params });
  return data.data;
}

export async function fetchPlatformAuditLogDetail(id: number) {
  const { data } = await api.get(`/admin/platform-audit-logs/${id}`);
  return data.data;
}


// ==================== TenantUsage API ====================
export async function fetchTenantUsageStats(params?: {
  startDate?: string;
  endDate?: string;
}) {
  const { data } = await api.get("/admin/tenant-usage/stats", { params });
  return data.data;
}

export async function fetchTenantUsageTrend(params?: {
  granularity?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { data } = await api.get("/admin/tenant-usage/trend", { params });
  return data.data;
}

export async function fetchTenantUsageRanking(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { data } = await api.get("/admin/tenant-usage/ranking", { params });
  return data.data;
}

export async function fetchTenantModuleUsage(params?: {
  startDate?: string;
  endDate?: string;
}) {
  const { data } = await api.get("/admin/tenant-usage/module-usage", { params });
  return data.data;
}


