/**
 * 开放平台（总后台）接口封装 —— `/api/platform/open/**`（R101-C3-2）
 *
 * 依据：
 * - `docs/tasks/cards/R101-C3-0-凌舟裁定.md` §二（7 项裁定）+ §三（实现形态）；
 * - C3-1 后端已合并 main `e122502b0`：新域 16 端点（密钥 8 + event 目录 1 + Webhook 7），
 *   契约逐条见 `docs/tasks/cards/R101-C3-1-阿坚回传.md` §九（**前端唯一依据**）。
 *
 * 边界与口径（与后端实现逐条对齐，勿凭注释猜路径）：
 * 1. 路径前缀：本模块所有路径都以 `/platform/open/` 开头（`utils/request.ts` 的 baseURL 是 `/api`），
 *    与后端 `backend/src/routes/platform-open.routes.ts` 的 `prefix: "/api/platform/open"` 对齐；
 * 2. 完成轮换是 **`/rotate-complete`**（语义化子路由，裁定 §二.3 A），**不是** `/rotate/complete`；
 * 3. 10 条写端点（POST/PUT/DELETE）经 `auto-routes` 挂载 `csrfMiddleware`，请求头 `x-csrf-token`
 *    由 `utils/request.ts` 统一注入（本模块不重复处理）；
 * 4. 列表/详情/统计返回的 `apiKey` **已是服务端打码值**（`maskAppKey`：4 位前缀 + `****` + 4 位后缀），
 *    前端**不得**再打码一次（双重打码），也**不得**展示完整密钥；
 * 5. 明文只在 `POST /api-keys`（`apiKey` + `apiSecret`）与 `POST /api-keys/:id/rotate`（新 `apiKey` + `apiSecret`）、
 *    `POST /webhooks`（`signSecret`）三处响应出现一次，页面关闭/刷新后不再可见；
 * 6. 租户下拉按裁定 §二.1（A）复用现成 `GET /api/platform/tenants`（见 `./tenant.ts` 的 `listTenantsApi`），
 *    本文件**不**新增租户端点、**不**新增「开通状态」字段（登记 S3-87）。
 */
import request from '../utils/request'

// ==================== 类型定义（对应后端返回 data 结构） ====================

/** 密钥三态：轮换中由 `rotate_expire_at` 派生（后端 `rotateStatusOf`） */
export type OpenApiKeyRotateStatus = 'ACTIVE' | 'ROTATING' | 'DISABLED'

/** 密钥列表项（`GET /api/platform/open/api-keys` 的 records 元素，`apiKey` 已打码、无 `apiSecret`） */
export interface OpenApiKeyItem {
  id: number
  tenantId: string
  appName: string
  apiKey: string
  allowedIps: string[]
  dailyLimit: number
  qps: number
  scopes: string[]
  todayCount: number
  lastCalledAt: string | null
  status: number
  rotateStatus: OpenApiKeyRotateStatus
  rotateExpireAt: string | null
  remark: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface OpenApiKeyListResult {
  records: OpenApiKeyItem[]
  total: number
  page: number
  pageSize: number
}

/** 签发响应（**明文 `apiKey` / `apiSecret` 仅此一次**） */
export interface OpenApiKeyCreated {
  id: number
  tenantId: string
  appName: string
  apiKey: string
  apiSecret: string
  allowedIps: string[]
  dailyLimit: number
  qps: number
  scopes: string[]
  status: number
}

/** 轮换响应（新密钥明文仅此一次；旧密钥并行期见 `rotateExpireAt`） */
export interface OpenApiKeyRotated {
  id: number
  apiKey: string
  apiSecret: string
  previousAppKeyMasked: string
  rotateExpireAt: string | null
  rotateStatus: 'ROTATING'
}

/** 日聚合项（数据源 `t_open_api_call_daily`，`errorRate` 为 0~1 小数或 null） */
export interface OpenApiKeyDailyItem {
  date: string
  callCount: number
  errorCount: number
  errorRate: number | null
}

/** 调用统计响应（`GET /api/platform/open/api-keys/:id/stats`） */
export interface OpenApiKeyStats {
  id: number
  tenantId: string
  appName: string
  apiKey: string
  dailyLimit: number
  qps: number
  scopes: string[]
  todayCount: number
  lastCalledAt: string | null
  status: number
  rotateStatus: OpenApiKeyRotateStatus
  rotateExpireAt: string | null
  range: { days: number }
  series: OpenApiKeyDailyItem[]
  total: { callCount: number; errorCount: number; errorRate: number | null }
  hasData: boolean
}

/** 事件目录项（`GET /api/platform/open/events`，后端常量枚举） */
export interface OpenPlatformEventItem {
  code: string
  name: string
  description: string
}

/** Webhook 订阅项（列表无签名密钥字段——`sign_secret` 只在创建响应出现一次） */
export interface OpenWebhookItem {
  id: number
  tenantId: string
  eventType: string
  callbackUrl: string
  retryPolicy: string
  pauseThreshold: number
  paused: boolean
  lastTriggerAt: string | null
  lastStatus: string | null
  lastError: string | null
  recentPushCount: number
  recentSuccessRate: number | null
  createdAt: string | null
  updatedAt: string | null
}

export interface OpenWebhookListResult {
  records: OpenWebhookItem[]
  total: number
}

/** 投递记录（日志 / 失败原因 / 测试推送 / 重推共用） */
export interface OpenWebhookDelivery {
  id: number
  subscriptionId: number
  eventType: string
  payload: Record<string, unknown> | null
  attempt: number
  status: string
  httpStatus: number | null
  error: string | null
  triggeredBy: string
  durationMs: number | null
  createdAt: string | null
}

/** 新建订阅响应（**明文 `signSecret` 仅此一次**） */
export interface OpenWebhookCreated {
  id: number
  tenantId: string
  eventType: string
  callbackUrl: string
  signSecret: string
  retryPolicy: string
  pauseThreshold: number
  paused: boolean
}

// ==================== API 密钥（8 条） ====================

/** 密钥列表（服务端已打码；`tenantId` / `status` / `keyword` 为过滤条件） */
export function listOpenApiKeysApi(params: {
  page?: number
  pageSize?: number
  tenantId?: string
  status?: number
  keyword?: string
}) {
  return request.get('/platform/open/api-keys', { params })
}

/** 签发密钥（201；响应含一次性明文 `apiKey` / `apiSecret`） */
export function createOpenApiKeyApi(data: {
  appName: string
  tenantId?: string
  allowedIps?: string[] | null
  dailyLimit?: number
  qps?: number
  scopes?: string[]
  remark?: string
}) {
  return request.post('/platform/open/api-keys', data)
}

/** 编辑密钥限额 / QPS / 白名单 / 权限范围 / 状态 / 备注（至少一项） */
export function updateOpenApiKeyApi(
  id: number | string,
  data: {
    dailyLimit?: number
    qps?: number
    allowedIps?: string[] | null
    scopes?: string[]
    status?: number
    remark?: string
  },
) {
  return request.put(`/platform/open/api-keys/${id}`, data)
}

/** 吊销密钥（裁定 §二.2 A：立即吊销，前端做二次确认） */
export function deleteOpenApiKeyApi(id: number | string) {
  return request.delete(`/platform/open/api-keys/${id}`)
}

/** 启用密钥（`status=1`） */
export function enableOpenApiKeyApi(id: number | string) {
  return request.post(`/platform/open/api-keys/${id}/enable`)
}

/** 轮换密钥（新密钥明文仅此一次；已在轮换中 ⇒ 409） */
export function rotateOpenApiKeyApi(id: number | string) {
  return request.post(`/platform/open/api-keys/${id}/rotate`)
}

/** 完成轮换（旧密钥立即失效；不在轮换中 ⇒ 400） */
export function completeOpenApiKeyRotationApi(id: number | string) {
  return request.post(`/platform/open/api-keys/${id}/rotate-complete`)
}

/** 调用统计（近 N 日，默认 7，上限 90；无写入方时 `series` 为空、`hasData=false`） */
export function getOpenApiKeyStatsApi(id: number | string, params?: { days?: number }) {
  return request.get(`/platform/open/api-keys/${id}/stats`, { params })
}

// ==================== 事件目录 + Webhook（7 + 1 条） ====================

/** 事件目录（常量枚举，新建订阅的事件类型下拉取值来源） */
export function listOpenPlatformEventsApi() {
  return request.get('/platform/open/events')
}

/** 订阅列表（含近 7 日推送数 / 成功率派生值） */
export function listOpenWebhooksApi(params?: { tenantId?: string; paused?: number }) {
  return request.get('/platform/open/webhooks', { params })
}

/** 新建订阅（201；响应含一次性明文 `signSecret`） */
export function createOpenWebhookApi(data: { eventType: string; callbackUrl: string; tenantId?: string }) {
  return request.post('/platform/open/webhooks', data)
}

/** 测试推送（出站一条 TEST 报文并落投递记录） */
export function testOpenWebhookApi(id: number | string) {
  return request.post(`/platform/open/webhooks/${id}/test`)
}

/** 投递日志（分页） */
export function listOpenWebhookLogsApi(id: number | string, params: { page?: number; pageSize?: number }) {
  return request.get(`/platform/open/webhooks/${id}/logs`, { params })
}

/** 手动重推（缺省重推最近一条；无投递记录 ⇒ 404） */
export function redeliverOpenWebhookApi(id: number | string, data?: { deliveryId?: number }) {
  return request.post(`/platform/open/webhooks/${id}/redeliver`, data ?? {})
}

/** 恢复订阅（取消自动暂停；未暂停时后端返回 `resumed:false` 且不写库） */
export function resumeOpenWebhookApi(id: number | string) {
  return request.post(`/platform/open/webhooks/${id}/resume`)
}

/** 失败原因（最近失败投递，含 error / httpStatus / attempt） */
export function listOpenWebhookFailuresApi(id: number | string, params?: { limit?: number }) {
  return request.get(`/platform/open/webhooks/${id}/failures`, { params })
}
