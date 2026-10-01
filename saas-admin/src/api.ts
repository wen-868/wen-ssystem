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

// ==================== 平台报表导出任务中心（R101-C6-3-0；前缀 /api/platform/reports/export） ====================
// 端点契约唯一真相源：backend/src/routes/platform-export-task.routes.ts + services/platform/platform-export-task.service.ts
// 硬口径：创建 ⇒ 恒 PENDING/progress 0/fileURL null；下载 —— 无 file_url 时后端 404 并给出业务文案
// （原文由后端 DOWNLOAD_NOT_READY_MSG 给出），前端**必须原样展示该文案**，不得改写成成功或本地空文件。
export function listExportTasks(params?: { page?: number; pageSize?: number; status?: string }) {
  return api.get<any, { data: ApiResult<any> }>("/platform/reports/export", { params });
}

/** 导出格式仅 CSV|XLSX（后端 EXPORT_TASK_FORMATS 强校验；传 PDF 会被 400 拒绝） */
export function createExportTask(data: { exportType: string; period?: string | null; format: "CSV" | "XLSX" }) {
  return api.post<any, { data: ApiResult<{ id: number; taskNo: string; status: string }> }>(
    "/platform/reports/export",
    data
  );
}

export function getExportTaskStatus(id: number) {
  return api.get<any, { data: ApiResult<any> }>(`/platform/reports/export/${id}/status`);
}

/**
 * 导出文件下载。响应：本期无生成器 ⇒ 无 file_url ⇒ 404 + 业务文案；有 file_url 时后端 501（未接通下载通道）。
 * ⚠️ 这里**刻意不设 responseType: 'blob'**：一旦设成 blob，错误响应体也会是 Blob，中文业务文案会被丢掉，
 * 只剩状态码兜底文案（与卡内「原样展示 404 业务提示」冲突）。将来后端真能吐文件时，改走
 * `utils/download-blob.ts` 的 saveBlobResponse + responseType: 'blob'。
 */
export function downloadExportTask(id: number) {
  return api.get<any, { data: ApiResult<any> }>(`/platform/reports/export/${id}/download`);
}

/** 任务日志：{ logs: [{ level, message, createdAt }] }，created_at 升序；任务不存在 ⇒ 404 */
export function getExportTaskLogs(id: number) {
  return api.get<any, { data: ApiResult<{ logs: Array<{ level: string; message: string; createdAt: any }> }> }>(
    `/platform/reports/export/${id}/logs`
  );
}

// ==================== 平台管理员 / 角色 / 权限点目录（R101-C6-3-0；C6-1A + C6-2-T6 已上线） ====================
// 路径逐字照用（不得自拟变体）：GET /platform/admins · /platform/admins/roles · /platform/permissions/catalog
//                              · GET|PUT /platform/roles/:id/permissions
/** 管理员列表：{ total, page, pageSize, records: [{ id, username, realName, phone, email, role, status, lastLoginAt, createdAt }] } */
export function getPlatformAdmins(params?: { page?: number; pageSize?: number; role?: string; status?: string; keyword?: string }) {
  return api.get<any, { data: ApiResult<PaginatedResult<any>> }>("/platform/admins", {
    params: { page: 1, pageSize: 20, ...params },
  });
}

/** 角色列表：{ roles: [{ id, name, code, type, domainCount }] }（空表 ⇒ roles: []） */
export function getPlatformRoles() {
  return api.get<any, { data: ApiResult<{ roles: any[] }> }>("/platform/admins/roles");
}

/** 权限点目录：{ modules: [{ moduleCode, moduleName, permissions: [{ permCode, permName, permLevel }] }] }（恒 18 条） */
export function getPermissionCatalog() {
  return api.get<any, { data: ApiResult<{ modules: any[] }> }>("/platform/permissions/catalog");
}

/** 角色权限矩阵：{ roleId, matrix: [{ moduleCode, canMenu, canPageBtn, dataScope }] }（目录内每个域都出现） */
export function getRolePermissions(id: number) {
  return api.get<any, { data: ApiResult<{ roleId: number; matrix: any[] }> }>(`/platform/roles/${id}/permissions`);
}

/** 整表替换权限矩阵；目录外的域 / 4 档外的数据范围 ⇒ 后端 400（前端如实提示，不吞错） */
export function replaceRolePermissions(id: number, matrix: any[]) {
  return api.put<any, { data: ApiResult<{ roleId: number; saved: number }> }>(`/platform/roles/${id}/permissions`, {
    matrix,
  });
}

/* ── C6-3-0b：4 个「后端已上线、页面未接」的动作（端点逐字，页面不得再散落字面路径） ──
 * 端点唯一真相源：
 *   PUT  /api/platform/admins/:id/status          backend/src/routes/platform.routes.ts:28
 *   POST /api/platform/admins/:id/reset-password  backend/src/routes/platform.routes.ts:27
 *   POST /api/platform/admins/invite              backend/src/routes/platform.routes.ts:26
 *   POST /api/platform/roles                      backend/src/routes/platform-role.routes.ts（prefix /api/platform/roles）
 */

/** 启停管理员：请求体 { status: 'ACTIVE' | 'DISABLED' }；响应 { id, status }（页面以响应为准刷新该行） */
export function updatePlatformAdminStatus(id: number, status: "ACTIVE" | "DISABLED") {
  return api.put<any, { data: ApiResult<{ id: number; status: "ACTIVE" | "DISABLED" }> }>(
    `/platform/admins/${id}/status`,
    { status }
  );
}

/** 重置管理员密码：无请求体；响应 { id, username, realName, initialPassword, passwordShownOnce }，明文口令仅此一次 */
export function resetPlatformAdminPassword(id: number) {
  return api.post<
    any,
    {
      data: ApiResult<{
        id: number;
        username: string;
        realName: string;
        initialPassword: string;
        passwordShownOnce: boolean;
      }>;
    }
  >(`/platform/admins/${id}/reset-password`);
}

/** 邀请建号提交体：本单只收 username + name + phone（不带 roleId/dataScope） */
export interface InvitePlatformAdminBody {
  username: string;
  name: string;
  phone: string;
}

/** 邀请建号：响应在既有建号结果上追加 { initialPassword, passwordShownOnce }（不发邮件/短信，明文口令仅此一次） */
export function invitePlatformAdmin(body: InvitePlatformAdminBody) {
  return api.post<
    any,
    {
      data: ApiResult<{
        id: number;
        username: string;
        realName: string;
        role: string;
        initialPassword: string;
        passwordShownOnce: boolean;
      }>;
    }
  >("/platform/admins/invite", body);
}

/** 新建自定义角色提交体：{ name, code, remark? }（type 由后端固定为 custom，不接受入参） */
export interface CreatePlatformRoleBody {
  name: string;
  code: string;
  remark?: string;
}

/** 新建自定义角色：code 重复 ⇒ 后端 409，页面原样展示后端文案 */
export function createPlatformRole(body: CreatePlatformRoleBody) {
  return api.post<any, { data: ApiResult<{ id: number }> }>("/platform/roles", body);
}

// ==================== 平台工单（R101-C6-3-0；前缀 /api/platform/support） ====================
// 端点契约唯一真相源：backend/src/routes/platform-ticket.routes.ts + platform-ticket.service.ts
/** 看板：{ groups: { pending, processing, resolved }, summary: { pending, processing, resolved, closed } } */
export function listSupportTickets(params?: { onlyMine?: boolean; status?: string; page?: number; pageSize?: number }) {
  return api.get<any, { data: ApiResult<any> }>("/platform/support/tickets", { params });
}

export function getSupportTicket(id: number | string) {
  return api.get<any, { data: ApiResult<any> }>(`/platform/support/tickets/${id}`);
}

/** 对话时间线（平台视角，含 PUBLIC/INTERNAL/TENANT）：{ items: [{ id, senderType, senderName, bubbleType, content, createdAt }] } */
export function getSupportTicketTimeline(id: number | string) {
  return api.get<any, { data: ApiResult<{ items: any[] }> }>(`/platform/support/tickets/${id}/timeline`);
}

export function replySupportTicket(id: number | string, content: string) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/support/tickets/${id}/reply`, { content });
}

export function noteSupportTicket(id: number | string, content: string) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/support/tickets/${id}/note`, { content });
}

export function transferSupportTicket(id: number | string, assigneeId: number) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/support/tickets/${id}/transfer`, { assigneeId });
}

export function resolveSupportTicket(id: number | string) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/support/tickets/${id}/resolve`);
}

export function closeSupportTicket(id: number | string) {
  return api.post<any, { data: ApiResult<any> }>(`/platform/support/tickets/${id}/close`);
}

/** 服务报表：口径未定 ⇒ { items: [], definitionPending: true }（前端须渲染「口径待定义」显式空态） */
export function getSupportTicketReport() {
  return api.get<any, { data: ApiResult<{ items: any[]; definitionPending: boolean }> }>("/platform/support/tickets/report");
}

/** 工单类型配置：{ categories: [{ id, name, slug, slaHours, sortNo, enabled }] }（零预置 ⇒ []） */
export function listTicketCategories() {
  return api.get<any, { data: ApiResult<{ categories: any[] }> }>("/platform/support/ticket-categories");
}

// ==================== 平台 Logo 上传（R101-C6-3-0；C6-1A #80 已上线） ====================
/**
 * POST /api/platform/config/logo —— multipart，字段名兼容 file/logo，单文件 ≤5MB。
 * 硬口径：本端点**只落盘并返回 URL**（响应带 persisted:false + persistedNote），
 * 持久化必须由调用方再调既有 PUT /api/platform/config/sys-config 完成（不得写 t_platform_config 键值行）。
 */
export function uploadPlatformLogo(file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.post<any, { data: ApiResult<{ url: string; path: string; persisted: boolean; persistedNote?: string }> }>(
    "/platform/config/logo",
    form
  );
}

// ==================== 平台全局功能开关（R101-C6-3-1；迁移 184 + 后端 platform-feature-switch.*） ====================
// 端点契约唯一真相源：backend/src/routes/platform-config.routes.ts（前缀 /api/platform/config）
// 分层口径：本域＝平台"能不能开"；套餐矩阵（租户"有没有"）仍走 t_subscription_plan，前端不经本模块。
/**
 * 功能开关行：{ featureCode, featureName, enabled, defaultForNewTenant, remark }
 * 空表 ⇒ items: []（页面必须渲染"尚未登记功能开关"空态，不得内置假清单）。
 */
export interface FeatureSwitchRow {
  featureCode: string;
  featureName: string;
  enabled: boolean;
  defaultForNewTenant: boolean;
  remark: string | null;
}

/** PUT 请求体：三个字段都可选，但**至少给一项**（后端 zod 反射 + 服务层"无变更 ⇒ 400"双护栏） */
export interface FeatureSwitchUpdateBody {
  enabled?: boolean;
  defaultForNewTenant?: boolean;
  remark?: string | null;
}

/** GET /platform/config/feature-switches —— 功能开关列表（空表 ⇒ items: []） */
export function listFeatureSwitches() {
  return api.get<any, { data: ApiResult<{ items: FeatureSwitchRow[] }> }>(
    "/platform/config/feature-switches"
  );
}

/**
 * PUT /platform/config/feature-switches/:code —— 改 enabled / defaultForNewTenant / remark
 * 响应：{ featureCode, changedFields }；未知 code ⇒ 404；提交值与现值一致（无变更）⇒ 400（拦截器按中文文案提示）。
 */
export function updateFeatureSwitch(code: string, body: FeatureSwitchUpdateBody) {
  return api.put<any, { data: ApiResult<{ featureCode: string; changedFields: string[] }> }>(
    `/platform/config/feature-switches/${code}`,
    body
  );
}

// ==================== 平台数据字典（R101-C6-3-1；迁移 185 + 后端 platform-dict.*） ====================
// 四类字典类型（卡内逐字）：unit / category_template / payment_channel / bill_type
// 硬口径：本模块**没有**批量导入专用端点（不得自拟导入类路径）——
//   "预置内容"是页面侧代码常量，通过 PUT 整包替换入口写入（零预置：迁移与库内初始均为空）。
/** 字典类型行：{ dictType, dictName, remark, status, itemCount }（零预置 ⇒ 空表 ⇒ items: []） */
export interface DataDictTypeRow {
  dictType: string;
  dictName: string;
  remark: string | null;
  status: string | null;
  itemCount: number;
}

/** 字典项请求体（PUT 整包替换时的单行；itemCode 在同一 dictType 内必须唯一） */
export interface DataDictItemBody {
  itemCode: string;
  itemName: string;
  sortNo?: number;
  status?: string;
  remark?: string | null;
}

/** PUT 请求体：整包替换该类型字典项（空数组＝清空该类型，仍幂等） */
export interface DataDictReplaceBody {
  items: DataDictItemBody[];
}

/** GET /platform/config/data-dict —— 已落库的字典类型列表（空表 ⇒ items: []） */
export function listDataDictTypes() {
  return api.get<any, { data: ApiResult<{ items: DataDictTypeRow[] }> }>(
    "/platform/config/data-dict"
  );
}

/** GET /platform/config/data-dict/:dictType/items —— 该类型字典项（合法类型未落库 ⇒ items: []；未知类型 ⇒ 404） */
export function listDataDictItems(dictType: string) {
  return api.get<any, { data: ApiResult<{ dictType: string; items: DataDictItemBody[] }> }>(
    `/platform/config/data-dict/${dictType}/items`
  );
}

/** PUT /platform/config/data-dict/:dictType —— 整包替换（幂等）→ { dictType, saved }；未知类型 ⇒ 404；itemCode 重复 ⇒ 400 */
export function replaceDataDictItems(dictType: string, body: DataDictReplaceBody) {
  return api.put<any, { data: ApiResult<{ dictType: string; saved: number }> }>(
    `/platform/config/data-dict/${dictType}`,
    body
  );
}

// ==================== 平台代理商域（R101-C6-3-3 **档 1**；迁移 186/187 + 后端 platform-agent.*） ====================
// 端点契约唯一真相源：backend/src/routes/platform-agent.routes.ts（前缀 /api/platform/agents，8 条）
// 档 1 边界（红线①）：只有**档案**与**层级权益配置**；比例字段是"配置值"，本模块**不产生任何计提**——
//   Tab② 分润台账 / 结算 / 提现属档 2/档 3，未开工，本文件不提供任何台账或结算函数。
/** 代理商档案行：{ id, agentCode, agentName, levelId, levelName, region, contactName, contactPhone, status, remark } */
export interface AgentRow {
  id: number;
  agentCode: string;
  agentName: string;
  levelId: number;
  levelName: string | null;
  region: string | null;
  contactName: string | null;
  contactPhone: string | null;
  /** PENDING-待审核 / ACTIVE-正常 / FROZEN-冻结 / TERMINATED-终止 */
  status: string;
  remark: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 代理商分页结果（卡 §四 逐字：items/total/page/pageSize） */
export interface AgentListResult {
  items: AgentRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** POST /platform/agents 请求体（与后端 createBodySchema 字段集逐字一致） */
export interface AgentCreateBody {
  agentCode: string;
  agentName: string;
  levelId: number;
  region?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  remark?: string | null;
}

/** PUT /platform/agents/:id 请求体：全部可选，但**至少给一项**（后端 zod 反射 + 服务层"无变更 ⇒ 400"双护栏） */
export interface AgentUpdateBody {
  agentName?: string;
  levelId?: number;
  region?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  remark?: string | null;
}

/** POST /platform/agents/:id/status 请求体：取值同后端四态枚举，非法流转 ⇒ 400 */
export interface AgentStatusBody {
  status: "PENDING" | "ACTIVE" | "FROZEN" | "TERMINATED";
}

/** 层级权益配置行：比例/折扣/套餐范围**未配置即 null**（不得折成 0/空数组） */
export interface AgentLevelRow {
  id: number;
  levelCode: string;
  /** D11③ 自定义命名（不写死"一级/二级"） */
  levelName: string;
  allowSubLevel: boolean;
  /** 可售套餐范围：planId 数组；未配置 ⇒ null */
  planScope: number[] | null;
  discountLow: number | null;
  discountHigh: number | null;
  profitModeSignup: boolean;
  profitModeRenew: boolean;
  /** D11② 增值收入初期关闭（默认 false） */
  profitModeUpsell: boolean;
  /** D11① 分润比例＝配置值；未配置 ⇒ null（档 1 不产生任何计提） */
  profitRateSignup: number | null;
  profitRateRenew: number | null;
  profitRateUpsell: number | null;
  sortNo: number;
  status: string;
}

/** POST /platform/agents/levels 请求体（levelCode 必填；未配置项传 null 或不传，**不要传 0/空数组冒充**） */
export interface AgentLevelCreateBody {
  levelCode: string;
  levelName: string;
  allowSubLevel?: boolean;
  planScope?: number[] | null;
  discountLow?: number | null;
  discountHigh?: number | null;
  profitModeSignup?: boolean;
  profitModeRenew?: boolean;
  profitModeUpsell?: boolean;
  profitRateSignup?: number | null;
  profitRateRenew?: number | null;
  profitRateUpsell?: number | null;
  sortNo?: number;
  status?: "ACTIVE" | "DISABLED";
}

/** PUT /platform/agents/levels/:id 请求体：levelCode 不可改，其余同上 */
export interface AgentLevelUpdateBody {
  levelName?: string;
  allowSubLevel?: boolean;
  planScope?: number[] | null;
  discountLow?: number | null;
  discountHigh?: number | null;
  profitModeSignup?: boolean;
  profitModeRenew?: boolean;
  profitModeUpsell?: boolean;
  profitRateSignup?: number | null;
  profitRateRenew?: number | null;
  profitRateUpsell?: number | null;
  sortNo?: number;
  status?: "ACTIVE" | "DISABLED";
}

/** GET /platform/agents —— 代理商列表（分页 + 关键词；空表 ⇒ items: []） */
export function listAgents(params?: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get<any, { data: ApiResult<AgentListResult> }>("/platform/agents", { params });
}

/** GET /platform/agents/:id —— 详情（未知 id ⇒ 404） */
export function getAgent(id: number) {
  return api.get<any, { data: ApiResult<AgentRow> }>(`/platform/agents/${id}`);
}

/** POST /platform/agents —— 新建档案（agentCode 重复 ⇒ 409；levelId 不存在 ⇒ 400） */
export function createAgent(body: AgentCreateBody) {
  return api.post<any, { data: ApiResult<AgentRow> }>("/platform/agents", body);
}

/** PUT /platform/agents/:id —— 部分更新 → { id, changedFields }；未知 id ⇒ 404；无变更 ⇒ 400 */
export function updateAgent(id: number, body: AgentUpdateBody) {
  return api.put<any, { data: ApiResult<{ id: number; changedFields: string[] }> }>(
    `/platform/agents/${id}`,
    body
  );
}

/** POST /platform/agents/:id/status —— 状态流转（非法流转 ⇒ 400；未知 id ⇒ 404） */
export function changeAgentStatus(id: number, body: AgentStatusBody) {
  return api.post<any, { data: ApiResult<{ id: number; status: string }> }>(
    `/platform/agents/${id}/status`,
    body
  );
}

/** GET /platform/agents/levels —— 层级列表（零预置 ⇒ 空表 ⇒ items: []） */
export function listAgentLevels() {
  return api.get<any, { data: ApiResult<{ items: AgentLevelRow[] }> }>("/platform/agents/levels");
}

/** POST /platform/agents/levels —— 新建层级（levelCode 重复 ⇒ 409） */
export function createAgentLevel(body: AgentLevelCreateBody) {
  return api.post<any, { data: ApiResult<AgentLevelRow> }>("/platform/agents/levels", body);
}

/** PUT /platform/agents/levels/:id —— 层级部分更新 → { id, changedFields }；未知 id ⇒ 404；无变更 ⇒ 400 */
export function updateAgentLevel(id: number, body: AgentLevelUpdateBody) {
  return api.put<any, { data: ApiResult<{ id: number; changedFields: string[] }> }>(
    `/platform/agents/levels/${id}`,
    body
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   R101-C6-3-2a · 渠道推广码（t_promo_code / 迁移 188）
   端点由派单卡 §四 逐字钉死，前端不得自拟路径 / 字段：
     · GET  /api/platform/promo-codes                             分页 + 关键词 + 状态
     · POST /api/platform/promo-codes                             生成（返回 { id, promoCode }）
     · POST /api/platform/promo-codes/:id/disable                 停用（已停用 ⇒ 幂等 200）
     · GET  /api/platform/promo-codes/:code/attributions          该码归因只读聚合
   本模块**零金额**（红线①）：不涉及分润 / 佣金 / 结算 / 提现任何字段。
   老带新台账与渠道效果报表归 C6-3-2b，本文件不提供对应函数。
   ══════════════════════════════════════════════════════════════════════════ */

/** 推广码行：{ id, promoCode, channelType, channelName, ownerAdminId, expireAt, status, remark } */
export interface PromoCodeRow {
  id: number;
  promoCode: string;
  /** 来源渠道类型（市场渠道 / 异业合作 / 地推 / 其他，取值由业务侧约定，后端不限定枚举） */
  channelType: string;
  channelName: string;
  /** 渠道负责人（逻辑引用 t_platform_admin.id，未指定 ⇒ null） */
  ownerAdminId: number | null;
  /** 有效期（null = 长期有效） */
  expireAt: string | null;
  /** ACTIVE-启用 / DISABLED-停用 */
  status: "ACTIVE" | "DISABLED";
  remark: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 推广码分页结果（卡 §四 逐字：items/total/page/pageSize） */
export interface PromoCodeListResult {
  items: PromoCodeRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** POST /platform/promo-codes 请求体（与后端 createBodySchema 字段集逐字一致：4 项，无金额字段） */
export interface PromoCodeCreateBody {
  channelType: string;
  channelName: string;
  expireAt?: string | null;
  remark?: string | null;
}

/** 归因明细行（只读聚合；attributionType：AGENT-代理商邀请 / PROMO-推广码 / REFERRAL-老带新） */
export interface PromoCodeAttributionRow {
  tenantId: string;
  attributionType: "AGENT" | "PROMO" | "REFERRAL";
  attributedAt: string;
  promoCodeId: number | null;
  agentId: number | null;
}

/** GET /platform/promo-codes —— 推广码列表（分页 + 关键词 + 状态；零预置 ⇒ 空表 ⇒ items: []） */
export function listPromoCodes(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: "ACTIVE" | "DISABLED";
}) {
  return api.get<any, { data: ApiResult<PromoCodeListResult> }>("/platform/promo-codes", { params });
}

/** POST /platform/promo-codes —— 生成推广码（码值 PC + 8 位去易混大写字母数字）→ { id, promoCode } */
export function createPromoCode(body: PromoCodeCreateBody) {
  return api.post<any, { data: ApiResult<{ id: number; promoCode: string }> }>(
    "/platform/promo-codes",
    body
  );
}

/** POST /platform/promo-codes/:id/disable —— 停用（未知 id ⇒ 404；已停用 ⇒ 幂等 200 + alreadyDisabled） */
export function disablePromoCode(id: number) {
  return api.post<any, { data: ApiResult<{ id: number; status: string; alreadyDisabled: boolean }> }>(
    `/platform/promo-codes/${id}/disable`
  );
}

/** GET /platform/promo-codes/:code/attributions —— 该码归因只读列表（未知码 ⇒ 404） */
export function listPromoCodeAttributions(code: string) {
  return api.get<any, { data: ApiResult<{ items: PromoCodeAttributionRow[] }> }>(
    `/platform/promo-codes/${code}/attributions`
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   R101-C6-3-2b · 老带新台账 + 渠道效果报表（迁移 195 / t_referral_ledger）
   端点由派单卡 §四 逐字钉死，前端不得自拟路径 / 字段：
     · GET /api/platform/referral-ledger                分页 + 关键词 + 状态（老带新台账）
     · GET /api/platform/channel-reports/effect         按归因维度聚合（渠道效果）
   **无任何"写台账"端点**：台账由归因事件驱动，前端只读、不提供手工补录入口。
   零金额（红线①）：本模块只出现"奖励积分"与"计奖基数口径名"，不涉及金额/分润/佣金/结算/提现。
   ══════════════════════════════════════════════════════════════════════════ */

/** 老带新台账行（t_referral_ledger；rewardBasisLabel 是后端给的口径中文名，前端不拼口径字面） */
export interface ReferralLedgerRow {
  id: number;
  inviterTenantId: string;
  /** 邀请人名称（t_tenant.tenant_name / company_name，空 ⇒ null） */
  inviterName: string | null;
  inviteeTenantId: string;
  inviteeTenantCode: string | null;
  /** 被邀请人名称（空 ⇒ null） */
  inviteeName: string | null;
  /** 本条奖励积分（20% 口径，且受年度上限 60000 截断；0 = 本年度额度已满本条不累计） */
  rewardPoints: number;
  /** 计奖基数口径名（如 subscribe_amount，只存口径不存金额） */
  rewardBasis: string;
  /** 计奖基数口径的中文展示名（如"订阅实收"） */
  rewardBasisLabel: string;
  /** 邀请人该行所属自然年的累计奖励积分（status<>REVOKED 口径） */
  inviterYearPoints: number;
  status: "PENDING" | "GRANTED" | "REVOKED";
  grantedAt: string | null;
  remark: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 台账分页结果（卡 §四 逐字：items/total/page/pageSize） */
export interface ReferralLedgerListResult {
  items: ReferralLedgerRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** 渠道效果报表项（按 t_tenant_attribution 维度聚合） */
export interface ChannelEffectItemRow {
  /** AGENT-代理商邀请 / PROMO-渠道推广码 / REFERRAL-老带新 */
  dimension: "AGENT" | "PROMO" | "REFERRAL";
  agentId: number | null;
  agentName: string | null;
  promoCodeId: number | null;
  promoCode: string | null;
  channelType: string | null;
  channelName: string | null;
  tenantCount: number;
  referralCount: number;
  rewardPoints: number;
}

/** 报表口径说明（后端随响应返回，前端原样展示，不自行解释口径） */
export interface ChannelEffectBasis {
  dimension: string;
  tenantCount: string;
  referralCount: string;
  rewardPoints: string;
  rewardRate: number;
  annualCapPoints: number;
  emptyState: string;
  scope: string;
}

export interface ChannelEffectReport {
  items: ChannelEffectItemRow[];
  basis: ChannelEffectBasis;
  /** 本次实际生效的过滤条件回显（null = 该项不过滤） */
  filters: { attributionType: string | null; channelType: string | null };
  totals: { tenantCount: number; referralCount: number; rewardPoints: number };
}

/** GET /platform/referral-ledger —— 老带新台账（分页 + 关键词 + 状态；零预置 ⇒ 空表 ⇒ items: []） */
export function listReferralLedger(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: "PENDING" | "GRANTED" | "REVOKED";
}) {
  return api.get<any, { data: ApiResult<ReferralLedgerListResult> }>("/platform/referral-ledger", {
    params,
  });
}

/** GET /platform/channel-reports/effect —— 渠道效果聚合（无归因数据 ⇒ items: [] 且 totals 全 0） */
export function getChannelEffectReport(params?: {
  attributionType?: "AGENT" | "PROMO" | "REFERRAL";
  channelType?: string;
}) {
  return api.get<any, { data: ApiResult<ChannelEffectReport> }>(
    "/platform/channel-reports/effect",
    { params }
  );
}
