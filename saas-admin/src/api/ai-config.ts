/**
 * AI 底座配置管理 API 封装（saas-admin 平台总后台）
 *
 * AI 底座为独立 NestJS 服务（默认端口 3016），通过环境变量 VITE_AI_BASE_URL 配置地址。
 *
 * ⚠️ 代码位置（2026-09-16 S3-36 更正）：AI 底座**不在本仓**。权威仓库为
 * `wen-868/ZXQL-AI`（本地 D:/Users/ZXQL/ZXQL-AI，生产检出 /opt/zhixiang/ai-base）；
 * 本仓原有的 `backend/ai-base` 是无 .git 的非部署副本，已删除。
 * 端点契约唯一真相源（禁止凭空猜测）——**均在 ZXQL-AI 仓库内**：
 *   - src/gateway/ai-config.controller.ts
 *   - src/tenant/ai-config-admin.service.ts
 *   - src/gateway/dto/ai-config.dto.ts
 *
 * 端点列表（底座全局前缀 /api）：
 *   - GET  /api/admin/ai-config/platform          获取平台默认配置
 *   - PUT  /api/admin/ai-config/platform          更新平台默认配置
 *   - GET  /api/admin/ai-config/tenants           租户 AI 配置列表（分页，可 tenantId 过滤）
 *   - GET  /api/admin/ai-config/tenants/:tenantId 租户配置详情
 *   - PUT  /api/admin/ai-config/tenants/:tenantId 更新租户配置（apiKey 加密后存储）
 *   - GET  /api/admin/ai-config/usage             用量统计（startDate/endDate/tenantId）
 *   - GET  /api/admin/ai-config/billing           计费套餐列表（分页，可 tenantId 过滤）
 *   - PUT  /api/admin/ai-config/billing/:tenantId 更新租户计费套餐
 *
 * 安全约定（对齐后端 ai-config-admin.service.ts）：
 *   - apiKey 写入：非空字符串才加密存储（空字符串表示"不改动"）
 *   - apiKey 读取：响应仅返回 apiKeySet(boolean) + apiKeyMasked(脱敏)，永不返回明文
 */
import axios from "axios";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";

// ==================== AI 底座基础配置 ====================

/** 开发环境回退地址（仅 dev 生效） */
const AI_BASE_DEV_FALLBACK = "http://localhost:3016";

/** 生产环境未注入时的提示，只弹一次，避免每个请求刷屏 */
let aiBaseWarned = false;
function warnAiBaseMissing(): string {
  const msg =
    "AI 服务地址未配置（VITE_AI_BASE_URL）。生产构建需注入该变量，例如 " +
    "VITE_AI_BASE_URL=https://saas.onepan.cn/ai-api";
  if (!aiBaseWarned) {
    aiBaseWarned = true;
    ElMessage.error(msg);
  }
  console.error("[ai-config] " + msg);
  return msg;
}

/**
 * 解析 AI 底座服务地址。
 *
 * ⚠️ 生产环境**禁止**回退 localhost：浏览器会把 http://localhost:3016 解析成
 * 访问者自己的机器 → 请求必然失败且界面无任何提示（静默故障，极难排查）。
 * 因此生产未注入时返回空串，由请求拦截器显式报错并阻止请求（S3-38）。
 * 开发环境保留 localhost 回退（本地直连 ai-base 3016）。
 */
function resolveAiBase(): string {
  const configured = import.meta.env.VITE_AI_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (import.meta.env.PROD) return "";
  return AI_BASE_DEV_FALLBACK;
}

/**
 * AI 底座请求实例：仅携带 JWT（AI 底座通过 Authorization 解析租户上下文）。
 * 不注入 x-csrf-token —— AI 底座不校验 CSRF（与 admin-web R70-16 既有实现一致）。
 */
const aiRequest = axios.create({
  baseURL: resolveAiBase(),
  timeout: 15000,
});

aiRequest.interceptors.request.use((config) => {
  // 生产未注入 VITE_AI_BASE_URL 时 baseURL 为空串：
  // 若不拦截，axios 会退化成同源相对请求，失败依旧无提示 —— 必须显式阻断。
  if (!aiRequest.defaults.baseURL) {
    return Promise.reject(new Error(warnAiBaseMissing()));
  }
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

/** 从 NestJS 错误响应中提取可读信息（message 可能是字符串或字符串数组） */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { message?: string | string[] } | undefined;
    const msg = body?.message;
    if (Array.isArray(msg)) return msg.join("；");
    if (msg) return msg;
  }
  return fallback;
}

aiRequest.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error?.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      window.location.hash = "#/login";
    }
    ElMessage.error(extractErrorMessage(error, "AI 配置请求失败，请检查 AI 底座服务是否可用"));
    return Promise.reject(error);
  }
);

// ==================== 类型定义（与后端契约严格对齐） ====================

/** 平台默认配置对外视图（apiKey 脱敏） */
export interface PlatformConfigView {
  id: number;
  defaultProvider: string;
  defaultModel: string;
  defaultEndpoint: string | null;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultSystemPrompt: string | null;
  apiKeySet: boolean;
  apiKeyMasked: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 租户 AI 配置对外视图（apiKey 脱敏） */
export interface TenantConfigView {
  id: number;
  tenantId: string;
  enabled: number;
  provider: string;
  apiEndpoint: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
  apiKeySet: boolean;
  apiKeyMasked: string | null;
  createdAt: string;
  updatedAt: string;
}

/** AI 用量日统计（t_ai_usage_daily 一行） */
export interface UsageDailyItem {
  id: number;
  tenantId: string;
  statDate: string;
  chatCount: number;
  toolCallCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCost: number;
  completionCost: number;
  totalCost: number;
  provider: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 用量统计汇总 */
export interface UsageSummary {
  chatCount: number;
  toolCallCount: number;
  totalTokens: number;
  totalCost: number;
}

/** 租户计费套餐配置（t_tenant_ai_billing 一行） */
export interface TenantBillingItem {
  id: number;
  tenantId: string;
  planType: string;
  freeChatCount: number;
  freeTokenLimit: number;
  overagePrice: number;
  monthlyChatLimit: number;
  monthlyTokenLimit: number;
  monthlyPrice: number;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

/** 分页响应（后端返回 list/total/page/pageSize 结构） */
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 更新平台默认配置（字段均可选，apiKey 空字符串表示不改动） */
export interface UpdatePlatformAiConfigPayload {
  defaultProvider?: string;
  defaultModel?: string;
  apiKey?: string;
  defaultEndpoint?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultSystemPrompt?: string;
}

/** 更新租户 AI 配置（字段均可选，apiKey 空字符串表示不改动） */
export interface UpdateTenantAiConfigPayload {
  enabled?: number;
  provider?: string;
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/** 更新租户计费套餐 */
export interface UpdateTenantBillingPayload {
  planType?: string;
  freeChatCount?: number;
  freeTokenLimit?: number;
  overagePrice?: number;
  monthlyChatLimit?: number;
  monthlyTokenLimit?: number;
  monthlyPrice?: number;
  enabled?: number;
}

/** 外部模型对外视图（apiKey 脱敏） */
export interface ExternalModelView {
  id: number;
  name: string;
  displayName: string;
  providerBaseUrl: string;
  modelName: string;
  enabled: number;
  sortOrder: number;
  apiKeySet: boolean;
  apiKeyMasked: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 外部模型选项（配置页下拉） */
export interface ExternalModelOption {
  name: string;
  displayName: string;
  modelName: string;
}

/** 外部模型创建/更新载荷（apiKey 更新时留空表示不修改） */
export interface ExternalModelPayload {
  name: string;
  displayName: string;
  providerBaseUrl: string;
  apiKey?: string;
  modelName: string;
  enabled?: number;
  sortOrder?: number;
}

/** 连通性测试载荷 */
export interface TestExternalModelPayload {
  providerBaseUrl: string;
  apiKey: string;
  modelName: string;
}

// ==================== API 函数 ====================

/** 获取平台默认 AI 配置 */
export function getPlatformAiConfig() {
  return aiRequest.get<unknown, PlatformConfigView>("/api/admin/ai-config/platform");
}

/** 更新平台默认 AI 配置（apiKey 非空则加密存储，空字符串表示不改动） */
export function updatePlatformAiConfig(payload: UpdatePlatformAiConfigPayload) {
  return aiRequest.put<unknown, PlatformConfigView>("/api/admin/ai-config/platform", payload);
}

/** 租户 AI 配置分页列表（可按 tenantId 过滤） */
export function listTenantAiConfigs(params: { tenantId?: string; page?: number; pageSize?: number }) {
  return aiRequest.get<unknown, PaginatedResult<TenantConfigView>>("/api/admin/ai-config/tenants", { params });
}

/** 获取租户 AI 配置详情 */
export function getTenantAiConfig(tenantId: string) {
  return aiRequest.get<unknown, TenantConfigView>(`/api/admin/ai-config/tenants/${encodeURIComponent(tenantId)}`);
}

/** 更新租户 AI 配置（apiKey 非空则加密存储，空字符串表示不改动） */
export function updateTenantAiConfig(tenantId: string, payload: UpdateTenantAiConfigPayload) {
  return aiRequest.put<unknown, TenantConfigView>(`/api/admin/ai-config/tenants/${encodeURIComponent(tenantId)}`, payload);
}

/** 用量统计（按日查询 t_ai_usage_daily，支持租户 + 日期范围过滤） */
export function getAiUsage(params: { startDate?: string; endDate?: string; tenantId?: string }) {
  return aiRequest.get<unknown, { list: UsageDailyItem[]; summary: UsageSummary }>("/api/admin/ai-config/usage", { params });
}

/** 租户计费套餐分页列表（可按 tenantId 过滤） */
export function listAiBillings(params: { tenantId?: string; page?: number; pageSize?: number }) {
  return aiRequest.get<unknown, PaginatedResult<TenantBillingItem>>("/api/admin/ai-config/billing", { params });
}

/** 更新租户计费套餐（不存在则创建） */
export function updateTenantAiBilling(tenantId: string, payload: UpdateTenantBillingPayload) {
  return aiRequest.put<unknown, TenantBillingItem>(`/api/admin/ai-config/billing/${encodeURIComponent(tenantId)}`, payload);
}

// ==================== 外部大模型管理（完善度-外部模型接入） ====================

/** 外部模型列表（apiKey 脱敏） */
export function listExternalModels() {
  return aiRequest.get<unknown, ExternalModelView[]>("/api/admin/ai-config/external-models");
}

/** 启用外部模型选项（配置页下拉） */
export function listExternalModelOptions() {
  return aiRequest.get<unknown, ExternalModelOption[]>("/api/admin/ai-config/external-models/options");
}

/** 添加外部模型（apiKey 加密存储并注册到运行时） */
export function createExternalModel(payload: ExternalModelPayload) {
  return aiRequest.post<unknown, ExternalModelView>("/api/admin/ai-config/external-models", payload);
}

/** 更新外部模型（apiKey 留空不修改；停用即注销运行时） */
export function updateExternalModel(id: number, payload: ExternalModelPayload) {
  return aiRequest.put<unknown, ExternalModelView>(`/api/admin/ai-config/external-models/${id}`, payload);
}

/** 删除外部模型（同步注销运行时） */
export function deleteExternalModel(id: number) {
  return aiRequest.delete<unknown, { success: boolean }>(`/api/admin/ai-config/external-models/${id}`);
}

/** 连通性测试（不落库，直接发起调用验证 baseUrl/apiKey/model） */
export function testExternalModel(payload: TestExternalModelPayload) {
  return aiRequest.post<unknown, { success: boolean; message: string; latencyMs: number }>(
    "/api/admin/ai-config/external-models/test",
    payload
  );
}

/** 按 ID 测试已保存模型（后端解密密钥执行，前端不接触明文） */
export function testExternalModelById(id: number) {
  return aiRequest.post<unknown, { success: boolean; message: string; latencyMs: number }>(
    `/api/admin/ai-config/external-models/test/${id}`
  );
}

// ==================== AI 认知层管理（长期记忆/学习/进化） ====================

/** 长期记忆总览 */
export interface LtmOverview {
  tenantId: string;
  profiles: Array<{ k: string; v: unknown }>;
  episodes: Array<{
    id: number;
    summary: string | null;
    what: string | null;
    outcome: string | null;
    createdAt: string;
  }>;
  archivals: Array<{ id: number; title: string; source: string | null; createdAt: string }>;
  counts: { profiles: number; episodes: number; archivals: number };
}

/** 学习回流记录 */
export interface LearningLogItem {
  id: number;
  tenantId: string;
  expId: number | null;
  hintKey: string | null;
  effect: string | null;
  note: string | null;
  appliedAt: string;
}

/** 学习提示 */
export interface LearningHints {
  toolSelect: Array<{ tool: string; note: string }>;
  routing: Array<{ key: string; note: string }>;
}

/** 进化版本 */
export interface EvolutionItem {
  id: number;
  tenantId: string;
  target: string;
  version: number;
  status: string;
  rationale: string | null;
  reviewId: number | null;
  grayPercent: number;
  proposedBy: string | null;
  createdAt: string;
}

/** 长期记忆总览 */
export function getLtmOverview(tenantId = "default") {
  return aiRequest.get<unknown, LtmOverview>("/api/admin/ltm", { params: { tenantId } });
}

/** 学习回流记录 */
export function getLearningLogs(tenantId = "default", limit = 50) {
  return aiRequest.get<unknown, LearningLogItem[]>("/api/admin/learning", {
    params: { tenantId, limit },
  });
}

/** 学习提示 */
export function getLearningHints(tenantId = "default") {
  return aiRequest.get<unknown, LearningHints>("/api/admin/learning/hints", {
    params: { tenantId },
  });
}

/** 进化版本列表 */
export function getEvolutionList(tenantId = "default", status?: string) {
  return aiRequest.get<unknown, EvolutionItem[]>("/api/admin/evolution", {
    params: { tenantId, ...(status ? { status } : {}) },
  });
}

/** 进化提案（prompt 文本或 newtool JSON） */
export function proposeEvolution(payload: {
  tenantId: string;
  target: string;
  proposed: string;
  rationale?: string;
  proposedBy?: string;
}) {
  return aiRequest.post<unknown, EvolutionItem>("/api/admin/evolution", payload);
}

/** 审核通过 → 灰度 */
export function approveEvolution(id: number) {
  return aiRequest.post<unknown, EvolutionItem>(`/api/admin/evolution/${id}/approve`, {});
}

/** 审核驳回 */
export function rejectEvolution(id: number, reason: string) {
  return aiRequest.post<unknown, EvolutionItem>(`/api/admin/evolution/${id}/reject`, { reason });
}

/** 灰度转正式生效 */
export function rolloutEvolution(id: number) {
  return aiRequest.post<unknown, EvolutionItem>(`/api/admin/evolution/${id}/rollout`, {});
}

/** 一键回滚 */
export function rollbackEvolution(id: number) {
  return aiRequest.post<unknown, EvolutionItem>(`/api/admin/evolution/${id}/rollback`, {});
}
