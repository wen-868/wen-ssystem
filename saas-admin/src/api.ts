import axios from "axios";

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location.hostname.endsWith(".onepan.cn")) {
    return "https://api.onepan.cn/api";
  }
  return "/api";
}

export const api = axios.create({
  baseURL: resolveApiBase()
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("platform_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // CSRF 防护：写操作需注入 x-csrf-token（登录/ME 接口下发，存于 platform_csrf_token）
  const csrfToken = localStorage.getItem("platform_csrf_token");
  if (csrfToken) {
    config.headers["x-csrf-token"] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("platform_token");
      if (typeof window !== "undefined") {
        window.location.hash = "#/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface TenantItem {
  id: number;
  tenantCode: string;
  companyName: string;
  companyShortName?: string;
  contactPerson: string;
  contactMobile: string;
  contactEmail?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  businessLicense?: string;
  legalPerson?: string;
  industry?: string;
  companyScale?: string;
  source: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "CLOSED";
  suspendReason?: string;
  suspendedAt?: string;
  expireAt?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDetail extends TenantItem {
  modules: TenantModule[];
}

export interface TenantModule {
  moduleCode: string;
  moduleName: string;
  enabled: number;
  grantedBy: "PLAN" | "MANUAL" | "ADDON";
  grantedAt?: string;
  expireAt?: string;
}

export interface PaginatedResult<T> {
  total: number;
  page: number;
  pageSize: number;
  records: T[];
}

export interface ApiResult<T> {
  code: string;
  message?: string;
  data: T;
}

// ==================== 认证 ====================
// 平台登录请使用 src/api/auth.ts 中的 loginApi（调 /platform-auth/login）
// 旧的 saasLogin 已删除，它调的是商家登录接口 /admin/auth/login，不是平台登录

// ==================== 租户管理 ====================
export function getTenants(params: {
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return api.get<any, { data: ApiResult<PaginatedResult<TenantItem>> }>("/platform/tenants-management", { params });
}

export function getTenantDetail(id: number) {
  return api.get<any, { data: ApiResult<TenantDetail> }>(`/platform/tenants-management/${id}`);
}

export function createTenant(data: any) {
  return api.post<any, { data: ApiResult<{ tenant_code: string }> }>("/platform/tenants-management", data);
}

export function updateTenant(id: number, data: any) {
  return api.put<any, { data: ApiResult<TenantItem> }>(`/platform/tenants-management/${id}`, data);
}

export function changeTenantStatus(id: number, status: string, reason?: string) {
  return api.put<any, { data: ApiResult<TenantItem> }>(`/platform/tenants-management/${id}/status`, { status, reason });
}

export function getTenantModules(id: number) {
  return api.get<any, { data: ApiResult<PaginatedResult<TenantModule>> }>(`/platform/tenants-management/${id}/modules`);
}

export function updateTenantModules(id: number, modules: TenantModule[]) {
  return api.put<any, { data: ApiResult<PaginatedResult<TenantModule>> }>(`/platform/tenants-management/${id}/modules`, { modules });
}

// ==================== 套餐管理 ====================
export function getPlans(params?: { status?: string }) {
  return api.get<any, { data: ApiResult<PaginatedResult<any>> }>("/platform/subscriptions-management/plans", { params });
}

export function getPlanDetail(id: number) {
  return api.get<any, { data: ApiResult<any> }>(`/platform/subscriptions-management/plans/${id}`);
}

export function createPlan(data: any) {
  return api.post<any, { data: ApiResult<{ plan_code: string }> }>("/platform/subscriptions-management/plans", data);
}

export function updatePlan(id: number, data: any) {
  return api.put<any, { data: ApiResult<any> }>(`/platform/subscriptions-management/plans/${id}`, data);
}

// ==================== 订阅管理 ====================
export function getSubscriptions(params: {
  tenantId?: number;
  status?: string;
  paymentStatus?: string;
  page?: number;
  pageSize?: number;
}) {
  return api.get<any, { data: ApiResult<PaginatedResult<any>> }>("/platform/subscriptions-management", { params });
}

export function getSubscriptionDetail(id: number) {
  return api.get<any, { data: ApiResult<any> }>(`/platform/subscriptions-management/${id}`);
}

export function createSubscription(data: any) {
  return api.post<any, { data: ApiResult<{ subscription_no: string }> }>("/platform/subscriptions-management", data);
}

export function renewSubscription(id: number, data: any) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/subscriptions-management/${id}/renew`, data);
}

export function changeSubscriptionPlan(id: number, data: any) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/subscriptions-management/${id}/change-plan`, data);
}

export function cancelSubscription(id: number, reason?: string) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/subscriptions-management/${id}/cancel`, { reason });
}

export function paySubscription(id: number, data: any) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/subscriptions-management/${id}/pay`, data);
}

// ==================== 平台看板 ====================
export function getPlatformOverview() {
  return api.get<any, { data: ApiResult<any> }>("/platform/dashboard/overview");
}

// ==================== 平台配置 ====================
export function getPlatformConfig() {
  return api.get<any, { data: ApiResult<any> }>("/platform/config/sys-config");
}

export function updatePlatformConfig(data: any) {
  return api.put<any, { data: ApiResult<any> }>("/platform/config/sys-config", data);
}

// ==================== 操作日志 ====================
export function getAuditLogs(params?: { keyword?: string; action?: string; userId?: number; page?: number; pageSize?: number }) {
  return api.get<any, { data: ApiResult<any> }>("/platform/audit-logs", { params: { page: 1, pageSize: 20, ...params } });
}

// ==================== 监控告警 ====================
export function fetchDbStatus() {
  return api.get<any, { data: ApiResult<any> }>("/platform/monitor/db-status");
}

export function fetchApiStats() {
  return api.get<any, { data: ApiResult<any> }>("/platform/monitor/api-stats");
}

export function fetchExpiringTenants(days?: number) {
  return api.get<any, { data: ApiResult<any> }>("/platform/monitor/expiring-tenants", { params: { days } });
}

export function notifyExpiringTenants(tenantIds: number[]) {
  return api.post<any, { data: ApiResult<any> }>("/platform/monitor/notify-expiring", { tenantIds });
}

// ==================== 平台公告 ====================
export function getAnnouncements(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}) {
  return api.get<any, { data: ApiResult<PaginatedResult<any>> }>("/platform/announcements", { params: { page: 1, pageSize: 20, ...params } });
}

export function getAnnouncementDetail(id: number) {
  return api.get<any, { data: ApiResult<any> }>(`/platform/announcements/${id}`);
}

export function createAnnouncement(data: {
  title: string;
  content: string;
  type?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}) {
  return api.post<any, { data: ApiResult<any> }>("/platform/announcements", data);
}

export function updateAnnouncement(id: number, data: any) {
  return api.put<any, { data: ApiResult<any> }>(`/platform/announcements/${id}`, data);
}

export function deleteAnnouncement(id: number) {
  return api.delete<any, { data: ApiResult<any> }>(`/platform/announcements/${id}`);
}

// ==================== 平台评价 ====================
export function getPlatformReviews(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  rating?: number;
  keyword?: string;
}) {
  return api.get<any, { data: ApiResult<PaginatedResult<any>> }>("/platform/reviews", { params: { page: 1, pageSize: 20, ...params } });
}

export function getPlatformReviewStats(params?: any) {
  return api.get<any, { data: ApiResult<any> }>("/platform/reviews/stats", { params });
}

export function replyPlatformReview(id: number, reply: string) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/reviews/${id}/reply`, { reply });
}

// ==================== 财务结算 ====================
export function getPlatformReconciliations(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  keyword?: string;
}) {
  return api.get<any, { data: ApiResult<PaginatedResult<any>> }>("/platform/reconciliation", { params: { page: 1, pageSize: 20, ...params } });
}

export function getPlatformReconciliationDetail(id: number) {
  return api.get<any, { data: ApiResult<any> }>(`/platform/reconciliation/${id}`);
}

// ==================== 租户使用统计 ====================
export function getTenantUsageStats(params?: {
  tenantId?: number;
  dateStart?: string;
  dateEnd?: string;
  metric?: string;
}) {
  return api.get<any, { data: ApiResult<any> }>("/platform/tenants/usage-stats", { params });
}

export function getTenantStatistics() {
  return api.get<any, { data: ApiResult<any> }>("/platform/tenants/statistics/overview");
}

export function getTenantRank(params?: {
  sortBy?: string;
  limit?: number;
}) {
  return api.get<any, { data: ApiResult<any[]> }>("/platform/tenants/rank", { params });
}

export function getReconciliationStats() {
  return api.get<any, { data: ApiResult<any> }>("/platform/reconciliation/stats");
}

export function settleReconciliation(id: number) {
  return api.put<any, { data: ApiResult<any> }>(`/platform/reconciliation/${id}/settle`);
}

// ==================== 错误日志 ====================
export function getErrorLogs(params?: {
  page?: number;
  pageSize?: number;
  errorType?: string;
  severity?: string;
  source?: string;
  keyword?: string;
}) {
  return api.get<any, { data: ApiResult<PaginatedResult<any>> }>("/platform/error-logs", { params: { page: 1, pageSize: 20, ...params } });
}

// ==================== 应用版本发布（电脑端/移动端更新检查） ====================
export function listAppVersions(params?: { platform?: string }) {
  return api.get<any, { data: ApiResult<any[]> }>("/padmin/app-versions", { params });
}

export function publishAppVersion(payload: {
  platform: string;
  versionCode: number;
  versionName: string;
  minVersionCode?: number;
  isForce?: boolean;
  updateUrl?: string;
  packageUrl?: string;
  updateNote?: string;
  enabled?: boolean;
}) {
  return api.post<any, { data: ApiResult<any> }>("/padmin/app-versions", payload);
}

export function deleteAppVersion(id: number) {
  return api.delete<any, { data: ApiResult<any> }>(`/padmin/app-versions/${id}`);
}
