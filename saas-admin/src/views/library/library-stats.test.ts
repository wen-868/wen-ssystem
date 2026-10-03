import { describe, expect, it } from 'vitest'
import {
  CATEGORY_DIST_FALLBACK,
  formatCategoryDistNote,
  formatMonthCallText,
  formatRankSummary,
  normalizeCallStats,
  normalizeCallTrend,
  normalizeReviewLogs,
  normalizeTenantRank,
  resolveBlockState,
  toNumberOrNull,
  toTrendPolyline,
  unwrapApiData,
} from './library-stats'

/**
 * R101-C6-5 · A 段纯逻辑单测（真断言，不用快照）
 * 覆盖：三个统计端点的响应归一化、空态判定、错误态与空态必须可区分、审核流水归一化。
 */

describe('C6-5 · 调取统计响应归一化', () => {
  it('unwrapApiData 兼容 { code, msg, data } 包裹与裸数据', () => {
    expect(unwrapApiData({ code: '0', msg: '成功', data: { monthCallCount: 3 } })).toEqual({
      monthCallCount: 3,
    })
    expect(unwrapApiData([1, 2])).toEqual([1, 2])
    expect(unwrapApiData(null)).toBeNull()
  })

  it('toNumberOrNull 把 0 与"取不到"分开', () => {
    expect(toNumberOrNull(0)).toBe(0)
    expect(toNumberOrNull('12')).toBe(12)
    expect(toNumberOrNull(undefined)).toBeNull()
    expect(toNumberOrNull('abc')).toBeNull()
  })

  it('normalizeCallStats 从 /stats 响应取出当月次数、排行与 unavailable', () => {
    const view = normalizeCallStats({
      monthCallCount: 42,
      tenantRank: [{ tenantId: 't1', tenantDisplayName: '甲租户', callCount: 30 }],
      unavailable: [{ key: 'categoryDist', reason: '公共类目树不存在' }],
    })
    expect(view.monthCallCount).toBe(42)
    expect(view.tenantRank).toEqual([
      { rank: 1, tenantId: 't1', tenantName: '甲租户', callCount: 30 },
    ])
    expect(view.unavailable).toEqual([{ key: 'categoryDist', reason: '公共类目树不存在' }])
  })

  it('normalizeCallStats 字段缺失 ⇒ null / 空数组（不得回落成 0）', () => {
    const view = normalizeCallStats({})
    expect(view.monthCallCount).toBeNull()
    expect(view.tenantRank).toEqual([])
    expect(view.unavailable).toEqual([])
    expect(normalizeCallStats(null).monthCallCount).toBeNull()
  })

  it('normalizeTenantRank 归一 /stats/rank 并按 1 起编号', () => {
    const rows = normalizeTenantRank({
      items: [
        { tenantId: 't1', tenantDisplayName: '甲', callCount: 9 },
        { tenantId: 't2', tenantDisplayName: null, callCount: '5' },
      ],
    })
    expect(rows).toEqual([
      { rank: 1, tenantId: 't1', tenantName: '甲', callCount: 9 },
      { rank: 2, tenantId: 't2', tenantName: '—', callCount: 5 },
    ])
  })

  it('normalizeTenantRank 丢弃计数不可解析的行（宁缺勿造）', () => {
    const rows = normalizeTenantRank({
      items: [
        { tenantId: 't1', tenantDisplayName: '甲', callCount: 3 },
        { tenantId: 't2', tenantDisplayName: '乙', callCount: 'N/A' },
        'not-an-object',
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ rank: 1, tenantId: 't1', tenantName: '甲', callCount: 3 })
    expect(normalizeTenantRank(undefined)).toEqual([])
  })

  it('normalizeCallTrend 过滤非法点并按日期升序（无数据 ⇒ []，不补 0）', () => {
    const points = normalizeCallTrend({
      days: 30,
      items: [
        { date: '2026-10-02', count: 4 },
        { date: 'bad-date', count: 9 },
        { date: '2026-10-01', count: '2' },
        { date: '2026-10-03', count: null },
      ],
    })
    expect(points).toEqual([
      { date: '2026-10-01', count: 2 },
      { date: '2026-10-02', count: 4 },
    ])
    expect(normalizeCallTrend({ items: [] })).toEqual([])
  })

  it('formatMonthCallText：null / 0 ⇒ 暂无数据，正数 ⇒ N 次', () => {
    expect(formatMonthCallText(null)).toBe('暂无数据')
    expect(formatMonthCallText(0)).toBe('暂无数据')
    expect(formatMonthCallText(7)).toBe('7 次')
  })

  it('formatRankSummary：无分母不给占比，无数据写暂无数据', () => {
    const rows = [
      { rank: 1, tenantId: 't1', tenantName: '甲', callCount: 30 },
      { rank: 2, tenantId: 't2', tenantName: '乙', callCount: 10 },
    ]
    expect(formatRankSummary([], null)).toBe('暂无数据')
    expect(formatRankSummary(rows, null)).toBe('Top2 合计 40 次')
    expect(formatRankSummary(rows, 100)).toBe('Top2 合计 40 次 · 占本月 40%')
  })

  it('toTrendPolyline：空数组 ⇒ 空串；两点落在左右边界且高值在上', () => {
    expect(toTrendPolyline([])).toBe('')
    const line = toTrendPolyline([
      { date: '2026-10-01', count: 0 },
      { date: '2026-10-02', count: 10 },
    ])
    expect(line).toBe('40,129 620,18')
    // 单点落在中线（不画到边界，避免读成趋势）
    expect(toTrendPolyline([{ date: '2026-10-01', count: 5 }])).toBe('330,18')
    // 全 0 序列贴底，且不除零
    expect(
      toTrendPolyline([
        { date: '2026-10-01', count: 0 },
        { date: '2026-10-02', count: 0 },
      ])
    ).toBe('40,129 620,129')
  })

  it('resolveBlockState：错误态优先于空态（改错路径必须看得见）', () => {
    expect(resolveBlockState({ loading: true, error: 'x', hasData: false })).toBe('loading')
    expect(resolveBlockState({ loading: false, error: '加载失败', hasData: false })).toBe('error')
    expect(resolveBlockState({ loading: false, error: null, hasData: false })).toBe('empty')
    expect(resolveBlockState({ loading: false, error: null, hasData: true })).toBe('ready')
  })

  it('formatCategoryDistNote 优先用后端 unavailable.reason，缺省用兜底说明', () => {
    const stats = normalizeCallStats({
      monthCallCount: 1,
      unavailable: [{ key: 'categoryDist', reason: '公共类目树不存在（118 迁移不建表）' }],
    })
    expect(formatCategoryDistNote(stats)).toBe('本期不提供：公共类目树不存在（118 迁移不建表）')
    expect(formatCategoryDistNote(null)).toBe(CATEGORY_DIST_FALLBACK)
  })
})

describe('C6-5 · 审核流水归一化', () => {
  it('normalizeReviewLogs 映射动作中文并给出状态流转', () => {
    const rows = normalizeReviewLogs({
      logs: [
        {
          id: 2,
          action: 'APPROVE',
          fromStatus: 'PENDING',
          toStatus: 'APPROVED',
          operatorName: '陈默',
          reason: null,
          createdAt: '2026-10-03T09:30:00.000Z',
        },
        { id: 1, action: 'SUBMIT', fromStatus: null, toStatus: 'PENDING', operatorName: null },
      ],
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].actionLabel).toBe('审核通过')
    expect(rows[0].statusText).toBe('PENDING → APPROVED')
    expect(rows[0].reason).toBe('')
    expect(rows[0].createdAt).toBe('2026-10-03 09:30')
    expect(rows[1].actionLabel).toBe('提交审核')
    expect(rows[1].statusText).toBe('PENDING')
    expect(rows[1].operatorName).toBe('—')
  })

  it('normalizeReviewLogs 空集 / 异常负载 ⇒ []（空态而非假数据）', () => {
    expect(normalizeReviewLogs({ logs: [] })).toEqual([])
    expect(normalizeReviewLogs(undefined)).toEqual([])
  })
})
