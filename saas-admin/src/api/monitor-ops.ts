import { api } from '../api'

/**
 * R101-C4-F：平台监控运维端点封装（含 KPI 真源 `/platform/monitor/api-stats`）。
 *
 * 契约来源（唯一口径）：
 * - 已在网：`backend/src/routes/platform-monitor.routes.ts`（`/`、`/api-stats`、`/db-status`…）
 * - 包C（分支 `feat/c4-1b-pkgBC` @ `e7308562c`，**合入后才在网**）：
 *   `backend/src/routes/platform-monitor-ops.routes.ts`（proxy-audit / storage / tenant-api / thresholds）
 *
 * 共同口径：
 * - 信封 `{ code:"0", msg:"成功", data:<payload>, traceId }` ⇒ 调用方取 `res.data.data`；
 * - 零假数据：无数据 `records: []`；无载体字段 `null` + `fieldNotes` / `unavailable` 逐条说明，
 *   前端显示 `—` 或空态明文，**不得补 0 / 不得回落内置默认值**；
 * - CSV 导出返回文件流（BOM + `text/csv` + `X-Export-Total/Rows/Truncated`），必须 `responseType:'blob'`。
 *
 * 本文件只**新增**导出，不改 `src/api.ts` 任何既有函数（派单卡 §二.2 红线）。
 */

const MONITOR_BASE = '/platform/monitor'

/** 监控阈值整包（未配置 ⇒ 后端 `thresholds: null`，不回落默认值） */
export interface MonitorThresholds {
  version: number
  warnPercent: number
  alertPercent: number
  blockPercent: number
  notify: {
    warn: { inApp: boolean; email: boolean; sms: boolean }
    alert: { escalateTicket: boolean; notifyCsm: boolean }
    block: { hardLimit429: boolean; tempQuotaPlus20: boolean }
  }
}

export interface MonitorThresholdsResult {
  configured: boolean
  valid: boolean | null
  thresholds: MonitorThresholds | null
  configKey: string
  note: string | null
}

/** 代登录审计行（无载体字段恒 null，界面显示 —） */
export interface ProxyAuditRow {
  id: number
  ticketNo: string | null
  operator: string
  operatorId: number
  tenantId: string | null
  tenant: string | null
  tenantCode: string | null
  reason: string | null
  loginUsername: string | null
  enterAt: string | null
  expiresAt: string | null
  exitAt: string | null
  duration: null
  ongoing: boolean | null
  actionSummary: null
  approver: null
  ip: string | null
  description: string | null
}

export interface ProxyAuditListResult {
  records: ProxyAuditRow[]
  total: number
  page: number
  pageSize: number
  month: string
  criteria: string
  fieldNotes: { field: string; reason: string }[]
}

export interface ProxyAuditReportResult {
  id: number
  operator: string
  operatorId: number
  tenantId: string | null
  tenantName: string | null
  tenantCode: string | null
  reason: string | null
  loginUsername: string | null
  ip: string | null
  enterAt: string | null
  ttlSeconds: number | null
  expiresAt: string | null
  sessionStatus: 'ONGOING' | 'EXPIRED' | 'UNKNOWN'
  steps: { step: number; name: string; status: 'DONE' | 'NO_CARRIER'; basis: string }[]
  criteria: string
  fieldNotes: { field: string; reason: string }[]
}

export interface StorageTopRow {
  rank: number
  tenantId: string
  tenantName: string | null
  tenantCode: string | null
  usedBytes: number
  usedGb: number
  fileCount: number
  quotaLimitGb: number | null
  /** 使用率（%；无配额载体 ⇒ null ⇒ 显示 —，不得显示 0） */
  usagePercent: number | null
  quotaSource: 'UNCONFIGURED' | 'TENANT_QUOTA'
}

export interface StorageTopResult {
  records: StorageTopRow[]
  total: number
  limit: number
  unit: string
  criteria: string
  notes: string[]
}

export interface OrphanScanResult {
  records: {
    id: number
    tenantId: string
    tenantName: string | null
    fileName: string | null
    filePath: string | null
    fileSize: number
    bizType: string | null
    bizId: number | null
    createdAt: string | null
    reasons: ('TENANT_MISSING' | 'NO_BIZ_LINK')[]
  }[]
  total: number
  scanLimit: number
  scanLimitReached: boolean
  criteria: string[]
  notes: string[]
}

export interface TenantApiResult {
  records: {
    tenantId: string
    tenantName: string | null
    tenantCode: string | null
    callCount: number
    errorCount: number
    errorRate: number | null
    /** 配额 / 使用率 / 三档状态无载体 ⇒ 恒 null（在 unavailable[] 说明） */
    quota: null
    usagePercent: null
    status: null
  }[]
  total: number
  period: string
  scanLimit: number
  scanLimitReached: boolean
  criteria: string
  unavailable: { key: string; reason: string }[]
}

export interface MonitorApiStats {
  totalRequests: number
  errorCount: number
  errorRate: number
  avgResponseTime: number
  statusCodes: Record<string, number>
  todayErrorCount: number
  /** 近 7 天错误数（**无小时级请求量时间序列** ⇒ 趋势图保持空态明文） */
  weeklyErrorTrend: { date: string; count: number }[]
}

/** GET /api/platform/monitor/api-stats —— KPI 真源（在网；字段见 services/admin/monitor.service.ts:69-130） */
export function fetchMonitorApiStats() {
  return api.get<any, { data: { code: string; data: MonitorApiStats } }>(`${MONITOR_BASE}/api-stats`)
}

/** GET /api/platform/monitor/proxy-audit —— 代登录审计（包C；operator/month 可筛） */
export function listProxyAudit(params?: {
  operator?: string
  month?: string
  page?: number
  pageSize?: number
}) {
  return api.get<any, { data: { code: string; data: ProxyAuditListResult } }>(
    `${MONITOR_BASE}/proxy-audit`,
    { params: { page: 1, pageSize: 50, ...params } }
  )
}

/** GET /api/platform/monitor/proxy-audit/export —— 代登录审计导出（CSV 文件流） */
export function exportProxyAuditCsv(params?: { operator?: string; month?: string }) {
  return api.get<any, { data: Blob; headers: Record<string, string> }>(
    `${MONITOR_BASE}/proxy-audit/export`,
    { params: { ...params }, responseType: 'blob' }
  )
}

/** GET /api/platform/monitor/proxy-audit/:id/report —— 五步审计法报告（包C） */
export function getProxyAuditReport(id: number | string) {
  return api.get<any, { data: { code: string; data: ProxyAuditReportResult } }>(
    `${MONITOR_BASE}/proxy-audit/${id}/report`
  )
}

/** GET /api/platform/monitor/storage/top5 —— 租户存储占用 TOP N（包C） */
export function getStorageTop5(limit?: number) {
  return api.get<any, { data: { code: string; data: StorageTopResult } }>(
    `${MONITOR_BASE}/storage/top5`,
    { params: limit ? { limit } : {} }
  )
}

/**
 * GET /api/platform/monitor/storage/orphan-scan —— 孤儿文件扫描（包C）。
 * `scanLimitReached=true` 必须显式提示（不得静默截断）。
 */
export function scanOrphanFiles(params?: { tenantId?: string }) {
  return api.get<any, { data: { code: string; data: OrphanScanResult } }>(
    `${MONITOR_BASE}/storage/orphan-scan`,
    { params: { ...params } }
  )
}

/** GET /api/platform/monitor/tenant-api —— 各租户 API 调用量（包C；period 默认当月） */
export function getTenantApiUsage(period?: string) {
  return api.get<any, { data: { code: string; data: TenantApiResult } }>(
    `${MONITOR_BASE}/tenant-api`,
    { params: period ? { period } : {} }
  )
}

/** GET /api/platform/monitor/tenant-api/export —— 租户 API 月报（CSV 文件流） */
export function exportTenantApiCsv(period?: string) {
  return api.get<any, { data: Blob; headers: Record<string, string> }>(
    `${MONITOR_BASE}/tenant-api/export`,
    { params: period ? { period } : {}, responseType: 'blob' }
  )
}

/** GET /api/platform/monitor/thresholds —— 监控阈值配置（未配置 ⇒ thresholds null） */
export function getMonitorThresholds() {
  return api.get<any, { data: { code: string; data: MonitorThresholdsResult } }>(
    `${MONITOR_BASE}/thresholds`
  )
}

/** PUT /api/platform/monitor/thresholds —— 整包保存阈值（三档必须 warn<alert<block） */
export function updateMonitorThresholds(data: MonitorThresholds) {
  return api.put<any, { data: { code: string; data: unknown } }>(`${MONITOR_BASE}/thresholds`, data)
}
