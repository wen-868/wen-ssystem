/**
 * AI 底座配置管理 API 封装（saas-admin 平台总后台）
 *
 * AI 底座为独立 NestJS 服务（默认端口 3016），通过环境变量 VITE_AI_BASE_URL 配置地址。
 * 端点契约唯一真相源（禁止凭空猜测）：
 *   - backend/ai-base/src/gateway/ai-config.controller.ts
 *   - backend/ai-base/src/tenant/ai-config-admin.service.ts
 *   - backend/ai-base/src/gateway/dto/ai-config.dto.ts
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

/** 解析 AI 底座服务地址：优先读 VITE_AI_BASE_URL，未配置时默认本地 3016 端口 */
function resolveAiBase(): string {
  const configured = import.meta.env.VITE_AI_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "http://localhost:3016";
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
