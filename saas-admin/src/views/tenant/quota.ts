/**
 * C1-1：租户「资源配额使用情况」行渲染 —— TenantList 抽屉与 TenantDetail 共用同一口径
 *
 * 数据源：GET /api/platform/tenants/:id/quota
 *   （backend/src/routes/platform-tenant.routes.ts:25 → tenant-quota.controller）
 * 响应形态：{ quota: { accounts:{used,limit}, products:{...}, storage:{...}, apiDaily:null, ... } }
 *
 * 三条硬规则（禁编造，与 TenantDetail 原实现一致，此处抽为单一事实来源）：
 *   1. 维度为 null（典型是 apiDaily —— 后端无 API 调用计数数据源，见 S3-21）
 *      → 文本显示「—」，**且不画进度条**（hasLimit=false）
 *   2. limit 为 null 或 0 → 视为「无上限」
 *      → 文本显示「used / —」，**不画进度条、不判超限**
 *   3. 百分比仅用于画条宽度；数值换算/除法口径一律由后端完成，前端不自行除
 */

export interface QuotaRow {
  key: string
  label: string
  pct: number
  over: boolean
  text: string
  hasLimit: boolean
}

const QUOTA_META: { key: string; label: string; suffix?: string }[] = [
  { key: 'accounts', label: '账号数' },
  { key: 'products', label: '商品上限' },
  { key: 'stores', label: '仓库数' },
  { key: 'storage', label: '存储容量', suffix: ' GB' },
  { key: 'apiDaily', label: 'API 日额度' },
  { key: 'aiMonthly', label: 'AI 额度', suffix: ' 次·月' },
]

function fmtNum(n: unknown): string {
  return Number(n ?? 0).toLocaleString('en-US')
}

export function buildQuotaRows(quota: any): QuotaRow[] {
  if (!quota) return []
  const q = quota.quota || {}
  return QUOTA_META.map((m) => {
    const dim = q[m.key]
    // 规则 1：无数据源维度 → 不画条
    if (dim == null) {
      return { key: m.key, label: m.label, pct: 0, over: false, text: '—', hasLimit: false }
    }
    const used = Number(dim.used ?? 0)
    const limit = dim.limit == null ? null : Number(dim.limit)
    // 规则 2：上限未知或为 0 → 视为无上限
    const hasLimit = limit != null && limit > 0
    const pct = hasLimit ? Math.min(100, (used / limit) * 100) : 0
    const over = hasLimit && used / limit >= 0.8
    const text = hasLimit
      ? `${fmtNum(used)} / ${fmtNum(limit)}${m.suffix || ''}`
      : `${fmtNum(used)} / —`
    return { key: m.key, label: m.label, pct, over, text, hasLimit }
  })
}

/** 取某一维度的已用值（供「存储水位」等复用展示，无数据返回 null） */
export function pickQuotaDim(quota: any, key: string): { used: number; limit: number | null } | null {
  const dim = quota?.quota?.[key]
  if (dim == null) return null
  return {
    used: Number(dim.used ?? 0),
    limit: dim.limit == null ? null : Number(dim.limit),
  }
}
