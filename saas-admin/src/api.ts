import axios from "axios";
import { ElMessage } from "element-plus";
// R101-S2-01 裁定 2：错误文案集中一处，与新客户端 src/utils/request.ts 共用同一份
import { isBizFailure, resolveBizErrorText, resolveHttpErrorText } from "./utils/http-error";

/** 401 提示节流时间戳：并发请求同时 401 时只提示一次 */
let lastAuthTipTime = 0;

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
  (response) => {
    // R101-S2-01 裁定 1：旧客户端此前不判业务码，后端 HTTP 200 但 code 非 0 时
    // 调用方若不自行判断就是「静默失败」——页面毫无反应也看不出原因。
    // 这里与新客户端同口径：非 0 → 中文提示 + reject。
    // 成功路径仍原样返回 AxiosResponse，不改任何既有调用点的解包方式。
    if (isBizFailure(response?.data)) {
      const text = resolveBizErrorText(response.data, "请求失败");
      ElMessage.error(text);
      return Promise.reject(new Error(text));
    }
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      // 与新客户端同口径：401 的真实原因（「未登录」/「登录状态已失效」）要可见，
      // 不能静默踢走。先给中文提示再跳转；1.5s 内只提示一次，避免并发请求刷屏。
      if (Date.now() - lastAuthTipTime > 1500) {
        lastAuthTipTime = Date.now();
        ElMessage.error(resolveHttpErrorText(error));
      }
      localStorage.removeItem("platform_token");
      if (typeof window !== "undefined") {
        window.location.hash = "#/login";
      }
      return Promise.reject(error);
    }
    // 统一中文文案：覆盖 4xx/5xx/超时/断网，禁止 axios 英文原文上屏
    ElMessage.error(resolveHttpErrorText(error));
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

/**
 * C1-1：删除套餐。
 * ⚠️ 前缀口径必须单独说明（踩坑点）：
 *   - backend/src/routes/subscription.routes.ts（prefix `/api/platform/subscriptions-management`）
 *     只注册了 GET/POST/PUT `/plans`、`/plans/:planId`、`/plans/:planId/policy`，
 *     **没有 DELETE**（该文件第 11~19 行可核）。
 *   - DELETE 只挂在 backend/src/routes/platform-plans.routes.ts:24 的 `DELETE /:planId`
 *     （prefix `/api/platform/plans`）。
 * ⇒ 故此处必须走 `/platform/plans/:id`，若照抄 getPlans 的 subscriptions-management 前缀会 404。
 */
export function deletePlan(id: number) {
  return api.delete<any, { data: ApiResult<any> }>(`/platform/plans/${id}`);
}

/**
 * C1-2 B1：GET /api/platform/plans/upgrade-flow-report —— 升降级流向报表
 * ⚠️ range 枚举是后端强校验的 month / 3m / 12m（传「本月」会 400），前端页签文案需映射。
 * 响应：{ range, rangeStart, dataSource, summary:{events,tenants},
 *        records:[{direction,dir:'UP'|'DOWN',fromPlanName,toPlanName,eventCount,tenantCount,lastAt}] }
 */
export function getPlanUpgradeFlowReport(range: "month" | "3m" | "12m") {
  return api.get<any, { data: ApiResult<any> }>("/platform/plans/upgrade-flow-report", { params: { range } });
}

/**
 * C1-2 B2：POST /api/platform/plans/:planId/copy —— 复制套餐（含 features 与策略包）
 * ⚠️ 当前套餐列表页**未改道**到本接口：既有「复制」走 /packages/create?copyFrom=<id>
 *    （PackageForm.vue:466-468 读源套餐回填为初值），保留「命名新套餐」这一步。
 *    是否改为一键复制由凌舟裁定；接口已就绪，前端改一行即可切。
 */
export function copyPlan(id: number, data?: { planCode?: string; planName?: string; status?: string }) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/plans/${id}/copy`, data ?? {});
}

/**
 * R101-S2-02 组1：套餐策略配置（升级/降级/续费/扩展额度/限时活动）
 * 这些项在 t_subscription_plan 无对应列，落 t_platform_config（config_key='plan_policy:<id>'）。
 * 未配置的子项不会出现在响应中，响应另含只读元字段 _unconfigured / _configured。
 */
export function getPlanPolicy(id: number) {
  return api.get<any, { data: ApiResult<any> }>(`/platform/subscriptions-management/plans/${id}/policy`);
}

export function updatePlanPolicy(id: number, data: any) {
  return api.put<any, { data: ApiResult<any> }>(
    `/platform/subscriptions-management/plans/${id}/policy`,
    data
  );
}

/**
 * R101-S2-02 组2：账单类配置（04 账单计费）
 * 落 t_platform_config：config_key='billing:arrears_policy' / 'billing:addon_price'
 * 未配置的子项不会出现在响应中；响应另含只读元字段 _unconfigured / _configured。
 */
export function getArrearsPolicy() {
  return api.get<any, { data: ApiResult<any> }>("/platform/billing/arrears-policy");
}

export function updateArrearsPolicy(data: any) {
  return api.put<any, { data: ApiResult<any> }>("/platform/billing/arrears-policy", data);
}

export function getAddonPrice() {
  return api.get<any, { data: ApiResult<any> }>("/platform/billing/addon-price");
}

export function updateAddonPrice(data: any) {
  return api.put<any, { data: ApiResult<any> }>("/platform/billing/addon-price", data);
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
// R101-S3-115：入参/返回类型严格对齐 S3-114 已定稿的后端契约
// （backend/src/controllers/admin/platform-review.controller.ts）。后端只接受
// page / pageSize / platform / rating；其余查询参数会被 zod strip（不报错、也不生效），
// 因此这里**只声明后端真实支持的入参**，不得再透传无载体参数。
export function getPlatformReviews(params?: {
  page?: number;
  pageSize?: number;
  platform?: string;
  rating?: number;
}) {
  return api.get<any, { data: ApiResult<PaginatedResult<any>> }>("/platform/reviews", { params: { page: 1, pageSize: 20, ...params } });
}

/** 统计契约：{ stats: [{ platform, cnt }] }（按平台分组的评价条数，无总量/平均分聚合） */
export function getPlatformReviewStats() {
  return api.get<any, { data: ApiResult<{ stats: Array<{ platform: string; cnt: number }> }> }>("/platform/reviews/stats");
}

/** 回复评价：后端 body 键为 replyContent（controller:31），键位不符会被 zod 拒绝 → 400 */
export function replyPlatformReview(id: number, replyContent: string) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/reviews/${id}/reply`, { replyContent });
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

// ==================== AI 计费管理配置（R101-S2-02 组3） ====================
// 落 t_platform_config（config_key='ai:billing_strategy' | 'ai:free_grant' | 'ai:quota_pack' | 'ai:points_rate'）
// 响应体统一 { code, data, message }，data 含只读元字段 _configured(boolean) / _unconfigured(string[])（契约 §三，不得回写）。
// 端点契约唯一真相源：docs/R101-S2-02-组3-AI类配置契约.md §四（主后端 8080，requirePlatformAuth）。
// 未配置 / 接口不可用 -> 调用方保持空态，绝不回落任何默认业务值（护栏④）。
export function getAiBillingStrategy() {
  return api.get('/platform/ai-billing/billing-strategy')
}
export function updateAiBillingStrategy(data: any) {
  return api.put('/platform/ai-billing/billing-strategy', data)
}
export function getAiFreeGrant() {
  return api.get('/platform/ai-billing/free-grant')
}
export function updateAiFreeGrant(data: any) {
  return api.put('/platform/ai-billing/free-grant', data)
}
export function getAiQuotaPacks() {
  return api.get('/platform/ai-billing/quota-packs')
}
export function updateAiQuotaPacks(data: any) {
  return api.put('/platform/ai-billing/quota-packs', data)
}
export function getAiPointsRate() {
  return api.get('/platform/ai-billing/points-rate')
}
export function updateAiPointsRate(data: any) {
  return api.put('/platform/ai-billing/points-rate', data)
}

// ==================== AI 模型与用量（R101-C5-2；契约见 C5-1 卡 §一，前缀 /api/platform/ai） ====================
// 4 条平台级只读 GET，路径由凌舟钉死、**逐字照用**（禁止在前端拼路径变体、禁止自造同义端点）。
// 统一信封 { code, message, data }：api 实例成功时原样返回 AxiosResponse ⇒ 调用方取 res.data.data。
// 零假数据：接口未返回 / 字段缺失 ⇒ 页面显示「—」或空态，**不得**补 0、不得造日期。
export function getPlatformAiPublicModels() {
  return api.get<any, { data: ApiResult<any> }>("/platform/ai/public-models");
}

/** 逐次计量流水（分页）。历史行 cost / deduct_source 为 NULL（C5-1 不回填）⇒ 按「无值」渲染，不得当 0 */
export function getPlatformAiMeteringLog(params?: { page?: number; pageSize?: number }) {
  return api.get<any, { data: ApiResult<any> }>("/platform/ai/metering-log", { params });
}

/** 异常用量租户（计数 + 明细；阈值来源由后端给，取不到即不出判定） */
export function getPlatformAiAbnormalTenants() {
  return api.get<any, { data: ApiResult<any> }>("/platform/ai/abnormal-tenants");
}

/** 模型消耗占比（后端只按 t_ai_audit_log 逐次明细 GROUP BY model，不得用日聚合近似） */
export function getPlatformAiModelShare() {
  return api.get<any, { data: ApiResult<any> }>("/platform/ai/model-share");
}
