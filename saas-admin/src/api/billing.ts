import { api } from '../api'

/**
 * R101-C4-F：平台财务（对账 / 账单 / 欠费 / 增值扣费）端点封装。
 *
 * 契约来源（唯一口径）：
 * - 包A（已合并 #81，本分支在网）：`backend/src/routes/platform-billing.routes.ts`
 * - 包B（分支 `feat/c4-1b-pkgBC` @ `e7308562c`，**合入后才在网**）：
 *   `backend/src/routes/platform-billing-arrears.routes.ts`
 *
 * 共同口径：
 * - 信封 `{ code:"0", msg:"成功", data:<payload>, traceId }` ⇒ 调用方取 `res.data.data`（沿页面既有写法）；
 * - 金额一律「元 / 2 位小数」（响应带 `amountUnit:"CNY"` / `amountScale:2`，单价 `unitPriceScale:4`）；
 * - 无载体字段后端返回 `null`（**不得**在前端补 0）；
 * - 催缴**仅站内**：`POST /arrears/urge` 响应带 `channel:"IN_APP"` + `channelNote`，前端如实透出；
 * - `tenantIds` 必填、元素为**字符串**租户ID、单次上限 200（包A 与包B 同一收紧口径）。
 *
 * 本文件只**新增**导出，不改 `src/api.ts` 任何既有函数（派单卡 §二.2 红线）。
 */

const BILLING_BASE = '/platform/billing'

/** 单次租户ID列表上限（与后端 `tenantIdsSchema.max(200)` 一致） */
export const TENANT_IDS_MAX = 200

// ==================== 包A：日对账 / 对账单 / 手动生成账单 / 开票 ====================

export interface DailyReconciliationRow {
  id: number
  platform: string
  date: string
  platformOrderCount: number
  platformAmount: number
  systemOrderCount: number
  systemAmount: number
  diffCount: number
  diffAmount: number
  /** 佣金金额（无载体 ⇒ null，界面显示 —） */
  commissionAmount: number | null
  /** PENDING / MATCHED / DIFF / ADJUSTED（见 docs/migrations/050_add_platform_reconciliation.sql） */
  status: string
  updatedAt: string
}

export interface DailyReconciliationListResult {
  records: DailyReconciliationRow[]
  total: number
  page: number
  pageSize: number
  amountUnit: string
  amountScale: number
}

export interface DailyDiffResult {
  date: string
  /** 逐笔差异明细无载体 ⇒ 恒为空数组（后端 note 必须原样展示） */
  records: unknown[]
  rowCount: number
  diffCount: number
  diffAmount: number
  note: string
  amountUnit: string
  amountScale: number
}

export interface GenerateBillingResult {
  periodStart: string
  periodEnd: string
  created: number
  reused: number
  amountSource: string
  note: string
  records: { tenantId: string; settlementId: number; settlementNo: string; idempotent: boolean }[]
  amountUnit: string
  amountScale: number
}

export interface InvoiceCreateResult {
  invoiceNo: string
  invoiceType: string
  relatedType: string
  relatedNo: string | null
  /** 申请即 PENDING，后端绝不伪造 ISSUED */
  status: string
  tenantId: string
  amount: number
  taxRate: number
  taxAmount: number
  settlementId: number
  settlementNo: string
  amountUnit: string
  amountScale: number
}

/** GET /api/platform/billing/reconciliation-daily —— 日对账列表（包A，在网） */
export function listDailyReconciliations(params?: {
  dateStart?: string
  dateEnd?: string
  status?: string
  platform?: string
  page?: number
  pageSize?: number
}) {
  return api.get<any, { data: { code: string; data: DailyReconciliationListResult } }>(
    `${BILLING_BASE}/reconciliation-daily`,
    { params: { page: 1, pageSize: 20, ...params } }
  )
}

/** GET /api/platform/billing/reconciliation-daily/:date/statement —— 当日对账单（CSV 文件流） */
export function exportDailyStatementCsv(date: string) {
  return api.get<any, { data: Blob; headers: Record<string, string> }>(
    `${BILLING_BASE}/reconciliation-daily/${encodeURIComponent(date)}/statement`,
    { responseType: 'blob' }
  )
}

/** GET /api/platform/billing/reconciliation-daily/:date/diff —— 当日差异汇总（records 恒为空） */
export function getDailyDiff(date: string) {
  return api.get<any, { data: { code: string; data: DailyDiffResult } }>(
    `${BILLING_BASE}/reconciliation-daily/${encodeURIComponent(date)}/diff`
  )
}

/** POST /api/platform/billing/statement/export —— 对账单导出（CSV 文件流，body 为账期区间） */
export function exportStatementCsv(data: { dateStart: string; dateEnd: string; platform?: string }) {
  return api.post<any, { data: Blob; headers: Record<string, string> }>(
    `${BILLING_BASE}/statement/export`,
    data,
    { responseType: 'blob' }
  )
}

/**
 * POST /api/platform/billing/generate —— 按账期手动生成结算单（幂等）。
 * ⚠️ `tenantIds` **必填**（≥1、≤200、元素为字符串）：缺失 / 非数组 / 空数组 ⇒ 400，
 * 超过 200 ⇒ 400（错误文案不同）。前端必须让用户显式选择租户并先行拦截。
 */
export function generateBilling(data: { periodStart: string; periodEnd: string; tenantIds: string[] }) {
  return api.post<any, { data: { code: string; data: GenerateBillingResult } }>(
    `${BILLING_BASE}/generate`,
    data
  )
}

/** POST /api/platform/billing/invoice —— 平台开票申请（成功码 201；状态恒 PENDING） */
export function createInvoice(data: {
  tenantId: string
  settlementId?: number
  settlementNo?: string
  amount?: number
  taxRate?: number
}) {
  return api.post<any, { data: { code: string; data: InvoiceCreateResult } }>(
    `${BILLING_BASE}/invoice`,
    data
  )
}

// ==================== 包B（ref e7308562c，合入后在网）：欠费 / 催缴 / 增值扣费 ====================

/** 欠费处理阶段（派生值；策略未配置 ⇒ stage / nextAction 为 null + stageNote 说明） */
export type ArrearsStage = '宽限期' | '功能降级' | '已冻结' | '保留期' | '待注销'

export interface ArrearsRow {
  id: number
  tenantId: string
  tenantName: string
  /** 租户编码（行内副标题） */
  tenantSub: string | null
  billNo: string
  /** 欠费金额（元 / 2 位小数；无载体 ⇒ null） */
  amount: number | null
  days: number
  stage: ArrearsStage | null
  stageNote: string | null
  nextAction: string | null
  periodStart: string
  periodEnd: string
  status: string
}

export interface ArrearsListResult {
  records: ArrearsRow[]
  total: number
  page: number
  pageSize: number
  stagePolicy: {
    configured: boolean
    graceEndDays: number | null
    degradeEndDays: number | null
    freezeEndDays: number | null
    retainEndDays: number | null
    note: string
  }
  scanLimit: number
  scanLimitReached: boolean
  amountUnit: string
  amountScale: number
}

/** 单租户催缴结果状态（逐租户如实提示，不得合并成一句成功） */
export type UrgeItemStatus =
  | 'NOTIFIED'
  | 'NO_ARREARS'
  | 'NO_ACTIVE_ADMIN_USER'
  | 'TENANT_NOT_FOUND'

export interface UrgeResult {
  requested: number
  uniqueTenants: number
  notifiedTenants: number
  totalNotifications: number
  /** 恒为 IN_APP（本端点不调用短信/邮件/微信） */
  channel: string
  channelNote: string
  amountUnit: string
  amountScale: number
  records: {
    tenantId: string
    tenantName: string | null
    status: UrgeItemStatus
    billCount: number
    amount: number | null
    dueDate: string | null
    notifiedUsers: number
    note: string | null
  }[]
}

export interface AddonChargeRow {
  id: number
  serialNo: string
  tenantId: string
  tenantName: string | null
  item: string
  /** 单价（元 / 4 位小数；null = 单价未配置，不填 0） */
  unitPrice: number | null
  usage: number
  /** 扣费金额（元 / 2 位小数；null = 单价未配置未出账，不填 0） */
  amount: number | null
  periodStart: string
  periodEnd: string
  status: string
  /** 无列载体 ⇒ 恒 null（界面显示 —） */
  method: null
  relBill: null
  relBillId: null
  time: string
}

export interface AddonChargeListResult {
  records: AddonChargeRow[]
  total: number
  page: number
  pageSize: number
  amountUnit: string
  amountScale: number
  unitPriceScale: number
  contractNotes: string[]
}

/** GET /api/platform/billing/arrears —— 平台级欠费清单（包B） */
export function listArrears(params?: {
  stage?: ArrearsStage
  keyword?: string
  page?: number
  pageSize?: number
}) {
  return api.get<any, { data: { code: string; data: ArrearsListResult } }>(
    `${BILLING_BASE}/arrears`,
    { params: { page: 1, pageSize: 100, ...params } }
  )
}

/**
 * POST /api/platform/billing/arrears/urge —— 批量/单租户催缴（**仅站内**通知）。
 * `tenantIds` 必填（≥1、≤200、字符串）；单租户催缴传单元素数组即可。
 */
export function urgeArrears(tenantIds: string[]) {
  return api.post<any, { data: { code: string; data: UrgeResult } }>(
    `${BILLING_BASE}/arrears/urge`,
    { tenantIds }
  )
}

/** GET /api/platform/billing/addon-charges —— 增值扣费流水（包B） */
export function listAddonCharges(params?: {
  tenantId?: string
  item?: string
  page?: number
  pageSize?: number
}) {
  return api.get<any, { data: { code: string; data: AddonChargeListResult } }>(
    `${BILLING_BASE}/addon-charges`,
    { params: { page: 1, pageSize: 100, ...params } }
  )
}
