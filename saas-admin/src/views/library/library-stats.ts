/**
 * R101-C6-5：商品库「调取统计」纯逻辑（无 Vue / 无 axios / 无 DOM，便于单测）
 *
 * 用途：把后端**已就绪**的三条只读端点响应归一为视图数据，并决定「空态 / 错误态」文案。
 *   · GET /api/platform/library/stats        → 当月调取次数 + 租户排行 + unavailable[]
 *   · GET /api/platform/library/stats/rank   → 租户调取排行 Top10（{ items: [{ tenantId, tenantDisplayName, callCount }] }）
 *   · GET /api/platform/library/stats/trend  → 近 N 天日调取次数（{ days, items: [{ date, count }] }）
 * 后端出处：backend/src/controllers/platform/library-call-log.controller.ts:54/59/64
 *           backend/src/services/platform/library-call-log.service.ts（getCallStats / getTenantRank / getCallTrend）
 * 另含：GET /api/platform/library/spus/:id/review-logs → 审核流水（C6-2-T5，只读）
 *           backend/src/routes/platform-library.routes.ts:50 → library.service.ts getSpuReviewLogs
 *
 * 硬约束（本单口径）：
 *   1) 无数据 ⇒ 诚实空态（「暂无数据」），**不得**用 0 或假数冒充；
 *   2) 请求失败 ⇒ 显式错误态，「加载失败」与「暂无数据」必须是两种可区分的呈现
 *      （禁止把失败静默成空态 / 0 —— 否则路径写错也看不出来）；
 *   3) 本文件是唯一口径实现，组件只做渲染（同一逻辑不得在 .vue 里再写一份）。
 */

/** 后端显式声明的「无载体」维度（如 categoryDist：公共类目树不存在） */
export interface UnavailableDimension {
  key: string
  reason: string
}

/** 排行视图行（rank 由前端按后端返回顺序编号，从 1 起） */
export interface TenantRankRow {
  rank: number
  tenantId: string
  tenantName: string
  callCount: number
}

/** 趋势视图点 */
export interface TrendPoint {
  date: string
  count: number
}

/** KPI 汇总视图 */
export interface CallStatsView {
  /** 当月 1 日至今调取次数；null = 未取到（不可判，不得当成 0） */
  monthCallCount: number | null
  tenantRank: TenantRankRow[]
  unavailable: UnavailableDimension[]
}

/** 审核流水视图行 */
export interface ReviewLogRow {
  id: number | null
  actionLabel: string
  statusText: string
  operatorName: string
  reason: string
  createdAt: string
}

/** 统计块四态：加载中 / 请求失败 / 无数据 / 有数据 */
export type BlockState = 'loading' | 'error' | 'empty' | 'ready'

/** 审核流水动作 → 中文标签（后端 action ∈ SUBMIT/APPROVE/REJECT/OFFLINE） */
export const REVIEW_ACTION_LABELS: Record<string, string> = {
  SUBMIT: '提交审核',
  APPROVE: '审核通过',
  REJECT: '审核驳回',
  OFFLINE: '下架',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * 兼容请求层两种返回形态：`{ code, msg, data }` 包裹 与 裸数据。
 * （utils/request.ts 的响应拦截器返回 response.data，即包裹体；测试/装置里也可能直接喂裸数据。）
 */
export function unwrapApiData(raw: unknown): unknown {
  if (isRecord(raw) && 'data' in raw) return (raw as { data: unknown }).data
  return raw
}

/** 数值归一：不可解析 / 空值 ⇒ null（**不得**回落成 0，0 与"取不到"语义不同） */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * 统计块状态判定：错误态优先于空态。
 * 这条顺序就是"改错路径必须显示错误态、不能被静默成空态"的实现口径。
 */
export function resolveBlockState(input: {
  loading: boolean
  error: string | null
  hasData: boolean
}): BlockState {
  if (input.loading) return 'loading'
  if (input.error) return 'error'
  return input.hasData ? 'ready' : 'empty'
}

/** 归一 `/stats` 响应（缺失字段 ⇒ null / 空数组，不造值） */
export function normalizeCallStats(payload: unknown): CallStatsView {
  const src = isRecord(payload) ? payload : {}
  const unavailable = Array.isArray(src.unavailable) ? src.unavailable : []
  return {
    monthCallCount: toNumberOrNull(src.monthCallCount),
    tenantRank: normalizeTenantRank({ items: src.tenantRank }),
    unavailable: unavailable
      .filter(isRecord)
      .map((row) => ({ key: toText(row.key), reason: toText(row.reason) }))
      .filter((row) => row.key !== ''),
  }
}

/**
 * 归一 `/stats/rank` 或 `/stats` 的 tenantRank 数组。
 * 计数不可解析的行**整行丢弃**（宁缺勿造）；名称为空显示 `—`，不编造租户名。
 */
export function normalizeTenantRank(payload: unknown): TenantRankRow[] {
  const src = isRecord(payload) ? payload : {}
  const items = Array.isArray(src.items) ? src.items : []
  const rows: TenantRankRow[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    const callCount = toNumberOrNull(raw.callCount)
    if (callCount === null) continue
    const tenantName = toText(raw.tenantDisplayName)
    rows.push({
      rank: rows.length + 1,
      tenantId: toText(raw.tenantId),
      tenantName: tenantName === '' ? '—' : tenantName,
      callCount,
    })
  }
  return rows
}

/** 归一 `/stats/trend` 响应：只保留「合法日期 + 可解析计数」的点，并按日期升序 */
export function normalizeCallTrend(payload: unknown): TrendPoint[] {
  const src = isRecord(payload) ? payload : {}
  const items = Array.isArray(src.items) ? src.items : []
  const points: TrendPoint[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    const count = toNumberOrNull(raw.count)
    const date = toText(raw.date).slice(0, 10)
    if (count === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    points.push({ date, count })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/** KPI「本月租户调取」文案：未取到或为 0 ⇒ 诚实空态「暂无数据」（不得用 0 冒充） */
export function formatMonthCallText(count: number | null): string {
  if (count === null || count <= 0) return '暂无数据'
  return `${count} 次`
}

/** 排行块副标题：有分母才给占比；无数据 / 无分母只给事实，不编百分比 */
export function formatRankSummary(rows: TenantRankRow[], monthCallCount: number | null): string {
  if (rows.length === 0) return '暂无数据'
  const sum = rows.reduce((acc, row) => acc + row.callCount, 0)
  if (monthCallCount === null || monthCallCount <= 0) return `Top${rows.length} 合计 ${sum} 次`
  const pct = Math.round((sum / monthCallCount) * 1000) / 10
  return `Top${rows.length} 合计 ${sum} 次 · 占本月 ${pct}%`
}

/** `/stats` 未声明 categoryDist 时的兜底说明（R1：本期不提供） */
export const CATEGORY_DIST_FALLBACK =
  '本期不提供：公共类目树不存在（t_library_spu 无类目列），按类目分布无可信数据源'

/** 类目分布块的说明文案：优先用后端显式给出的 unavailable.reason，避免前端自述与后端漂移 */
export function formatCategoryDistNote(stats: CallStatsView | null): string {
  const hit = stats?.unavailable.find((row) => row.key === 'categoryDist')
  return hit?.reason ? `本期不提供：${hit.reason}` : CATEGORY_DIST_FALLBACK
}

/**
 * SVG 折线点串（沿用既有 viewBox 0 0 640 170 的坐标：左 40、右 620、上 18、下 129，
 * 与组件里四条水平网格线的端点一致）。
 * 空数组 ⇒ 空串（调用方据此走空态，不画假折线）；全部为 0 ⇒ 贴底，不除零。
 */
export function toTrendPolyline(
  points: TrendPoint[],
  box: { left?: number; right?: number; top?: number; bottom?: number } = {}
): string {
  const left = box.left ?? 40
  const right = box.right ?? 620
  const top = box.top ?? 18
  const bottom = box.bottom ?? 129
  if (points.length === 0) return ''
  const innerWidth = Math.max(right - left, 0)
  const max = points.reduce((acc, point) => Math.max(acc, point.count), 0)
  const scale = max > 0 ? (bottom - top) / max : 0
  return points
    .map((point, index) => {
      const x =
        points.length === 1
          ? left + innerWidth / 2
          : left + (innerWidth * index) / (points.length - 1)
      const y = max > 0 ? bottom - point.count * scale : bottom
      return `${Math.round(x)},${Math.round(y)}`
    })
    .join(' ')
}

/** 归一审核流水响应 `{ logs: [...] }` */
export function normalizeReviewLogs(payload: unknown): ReviewLogRow[] {
  const src = isRecord(payload) ? payload : {}
  const items = Array.isArray(src.logs) ? src.logs : []
  const rows: ReviewLogRow[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    const action = toText(raw.action)
    const from = toText(raw.fromStatus)
    const to = toText(raw.toStatus)
    rows.push({
      id: toNumberOrNull(raw.id),
      actionLabel: REVIEW_ACTION_LABELS[action] ?? (action || '—'),
      statusText: from && to ? `${from} → ${to}` : to || from || '—',
      operatorName: toText(raw.operatorName) || '—',
      reason: toText(raw.reason),
      createdAt: toText(raw.createdAt).replace('T', ' ').slice(0, 16) || '—',
    })
  }
  return rows
}
