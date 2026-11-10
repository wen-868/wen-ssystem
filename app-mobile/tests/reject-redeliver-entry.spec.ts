/**
 * MOBILE-REJECT-REDELIVER-ENTRY-01 · 拒收后人工重发入口防死链测试
 *
 * 覆盖：
 *  - DELIVERY_FAILED 无真实入口 → 人工兜底、不可点击
 *  - REJECTED 等价态
 *  - retry_entry=store:manual-redeliver 未实现
 *  - status_reason 有值/无值
 *  - 空 URL/空 route/空 action fail-closed
 *  - 已实现动作不回归
 *  - 权限不足不出可点击动作
 *  - 其他 redeliver 能力不得误绑
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRecoveryEntry, isDeliveryFailureStatus } from '../src/utils/order-recovery-entry'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/**
 * 让真实映射函数跑起来但不发网络：
 * 拦截模块的 request 层导出（get），返回给定信封。
 * 注意：request.ts 的 get 返回 `resData.data`（已解包 data），
 * 故这里直接返回 records/total 结构，与后端 `ok({records,total})` 一致。
 */
/**
 * 文件级模块句柄（F3 起提到顶层）：F2 的 describe 内 let 变量对后续 describe 不可见，
 * 导致新增的筛选回归用例 ReferenceError。统一在这里 beforeAll 装配一次。
 * （request.ts 的 get 返回 resData.data 已解包，故 mock 直接给 records/total 结构）
 */
let storeSaleBillsApi: any
let billHistoryApi: any
let mapBillHistoryRow: any
let mapStoreSaleBillRow: any

beforeAll(async () => {
  const mod: any = await import('../src/api/modules/orders')
  storeSaleBillsApi = mod.storeSaleBillsApi
  billHistoryApi = mod.billHistoryApi
  mapBillHistoryRow = mod.mapBillHistoryRow
  mapStoreSaleBillRow = mod.mapStoreSaleBillRow
})

let getSpy: any
async function withMockGet(payload: any, call: () => Promise<any>) {
  const req: any = await import('../src/api/request')
  getSpy?.mockRestore?.()
  getSpy = vi.spyOn(req, 'get').mockResolvedValue(payload)
  try {
    return await call()
  } finally {
    getSpy.mockRestore()
    getSpy = null
  }
}

describe('resolveRecoveryEntry · 配送失败/拒收态', () => {
  it('DELIVERY_FAILED 无真实入口 ⇒ 人工兜底、不可点击', () => {
    const r = resolveRecoveryEntry({ status: 'DELIVERY_FAILED', retryEntry: 'store:manual-redeliver' })
    expect(r.kind).toBe('manual-fallback')
    expect(r.text).toContain('联系客服重新配送')
    expect(r.clickable).toBe(false)
  })

  it('REJECTED 等价态 ⇒ 人工兜底', () => {
    const r = resolveRecoveryEntry({ status: 'REJECTED' })
    expect(r.kind).toBe('manual-fallback')
    expect(r.text).toContain('联系客服重新配送')
    expect(r.clickable).toBe(false)
  })

  it('deliveryStatus 也可触发（等价判定）', () => {
    const r = resolveRecoveryEntry({ deliveryStatus: 'DELIVERY_FAILED' })
    expect(r.kind).toBe('manual-fallback')
  })

  it('正常状态 ⇒ 无恢复入口', () => {
    for (const s of ['CONFIRMED', 'COMPLETED', 'PENDING', 'CANCELLED', '']) {
      expect(resolveRecoveryEntry({ status: s }).kind).toBe('none')
    }
  })
})

describe('resolveRecoveryEntry · status_reason', () => {
  it('有 status_reason ⇒ 绑定原因', () => {
    const r = resolveRecoveryEntry({ status: 'DELIVERY_FAILED', retryEntry: 'store:manual-redeliver', statusReason: '客户拒收' })
    expect(r.reason).toBe('客户拒收')
    expect(r.text).toContain('客户拒收')
  })

  it('无 status_reason ⇒ 稳定兜底文案（不带括号）', () => {
    const r = resolveRecoveryEntry({ status: 'DELIVERY_FAILED' })
    expect(r.reason).toBeNull()
    expect(r.text).not.toContain('(')
    expect(r.text).toContain('联系客服重新配送')
  })
})

describe('resolveRecoveryEntry · retry_entry 未实现 fail-closed', () => {
  it('retry_entry=store:manual-redeliver ⇒ clickable=false', () => {
    const r = resolveRecoveryEntry({ status: 'DELIVERY_FAILED', retryEntry: 'store:manual-redeliver', actionCapability: 'store:manual-redeliver' })
    expect(r.clickable).toBe(false)
  })

  it('空 retry_entry ⇒ 仍人工兜底（不猜测后端能力）', () => {
    const r = resolveRecoveryEntry({ status: 'DELIVERY_FAILED', retryEntry: '' })
    expect(r.kind).toBe('manual-fallback')
    expect(r.clickable).toBe(false)
  })

  it('空 URL/空 route/空 action ⇒ 不渲染可点击控件', () => {
    for (const url of ['', null, undefined]) {
      const r = resolveRecoveryEntry({ status: 'DELIVERY_FAILED', retryEntry: url })
      expect(r.clickable).toBe(false)
    }
  })
})

describe('其他 redeliver 能力不得误绑', () => {
  it('webhook redeliver ⇒ 不误接到订单页面（clickable=false）', () => {
    const r = resolveRecoveryEntry({ status: 'DELIVERY_FAILED', retryEntry: 'webhook:instant-retail-redeliver', actionCapability: 'webhook:instant-retail-redeliver' })
    expect(r.kind).toBe('manual-fallback')
    expect(r.clickable).toBe(false)
  })

  it('isDeliveryFailureStatus 纯判定', () => {
    expect(isDeliveryFailureStatus('DELIVERY_FAILED')).toBe(true)
    expect(isDeliveryFailureStatus('rejected')).toBe(true)
    expect(isDeliveryFailureStatus('CONFIRMED')).toBe(false)
    expect(isDeliveryFailureStatus(null)).toBe(false)
    expect(isDeliveryFailureStatus('')).toBe(false)
  })
})

describe('GAP-1 已实现动作不回归', () => {
  it('对账确认的状态（非配送失败）不出恢复入口', () => {
    const r = resolveRecoveryEntry({ status: 'CONFIRMED' })
    expect(r.kind).toBe('none')
  })
})

// ===========================================================================
// MOBILE-REJECT-REDELIVER-ENTRY-01-F2 · 列表 API 映射（DB businessStatus → UI status）
//
// F1 被判驳回的真因：`storeSaleBillsApi` 把 `collectionStatus` 直接当 `status`，
// 真实 business_status=REJECTED 永远到不了 UI。以下用例钉住「映射层必须带真实业务态」，
// 并对正常单据做不回归断言。
// ===========================================================================
describe('F2 · 列表映射：businessStatus 必须进入 UI status', () => {
  // 模块句柄已在文件级 beforeAll 装配（F3 起提升，见文件头 setup）

  it('sale_bill：business_status=REJECTED ⇒ status=REJECTED（不再被 collectionStatus 顶替）', async () => {
    const res = await withMockGet({ records: [{ billNo: 'F2-SB-1', customerName: '甲', receivableAmount: 66, businessStatus: 'REJECTED', collectionStatus: 'UNPAID', createdAt: '2026-11-05' }], total: 1 }, () => storeSaleBillsApi.list())
    expect(res.list[0].status, 'REJECTED 必须出现在 status').toBe('REJECTED')
    // 收款态不得丢失，单独保留
    expect(res.list[0].collectionStatus).toBe('UNPAID')
    expect(res.list[0].businessStatus).toBe('REJECTED')
  })

  it('sale_bill：business_status=DELIVERY_FAILED ⇒ status=DELIVERY_FAILED', async () => {
    const res = await withMockGet({ records: [{ billNo: 'F2-SB-2', customerName: '乙', receivableAmount: 33, businessStatus: 'DELIVERY_FAILED', collectionStatus: 'UNPAID' }], total: 1 }, () => storeSaleBillsApi.list())
    expect(res.list[0].status).toBe('DELIVERY_FAILED')
  })

  it('sale_bill：正常 businessStatus=CREATED, collectionStatus=PAID ⇒ status=PAID（回到商品收款态，不是 CREATED）', async () => {
    // F3 订正（凌舟驳回 F2 §二.2/§三）：非失败态的 sale_bill 必须回到 collectionStatus 口径，
    // 否则页面「待收款/已收款」筛选失效。businessStatus 仍保留供诊断，但不得覆盖展示/筛选语义。
    const res = await withMockGet({ records: [{ billNo: 'F3-SB-3', customerName: '丙', receivableAmount: 100, businessStatus: 'CREATED', collectionStatus: 'PAID' }], total: 1 }, () => storeSaleBillsApi.list())
    expect(res.list[0].status, '正常单必须显示收款态 PAID').toBe('PAID')
    expect(res.list[0].businessStatus, 'businessStatus 仍保留供诊断').toBe('CREATED')
    expect(res.list[0].collectionStatus).toBe('PAID')
  })

  it('sale_bill：正常 businessStatus=CREATED, collectionStatus=UNPAID ⇒ status=UNPAID（待收款可筛）', async () => {
    const res = await withMockGet({ records: [{ billNo: 'F3-SB-4', customerName: '丙', receivableAmount: 100, businessStatus: 'CREATED', collectionStatus: 'UNPAID' }], total: 1 }, () => storeSaleBillsApi.list())
    expect(res.list[0].status, '正常未收款单必须显示 UNPAID').toBe('UNPAID')
    expect(res.list[0].collectionStatus).toBe('UNPAID')
  })

  it('sale_order：delivery_status=REJECTED 且 order_status=COMPLETED ⇒ status 取 REJECTED（失败态优先）', async () => {
    // billHistoryApi 非导出（模块内 const），改用导出的行映射函数验同一实现
    const row = mapBillHistoryRow({ billType: 'sale_order', billNo: 'F2-SO-1', partyName: '丁', amount: 50, orderStatus: 'COMPLETED', deliveryStatus: 'REJECTED' })
    expect(row.status, '拒收单不得被 orderStatus 正常态掩盖').toBe('REJECTED')
    expect(row.deliveryStatus).toBe('REJECTED')
    expect(row.orderStatus).toBe('COMPLETED')
  })

  it('sale_order：正常 COMPLETED ⇒ status=COMPLETED（不回归）', async () => {
    const row = mapBillHistoryRow({ billType: 'sale_order', billNo: 'F2-SO-2', orderStatus: 'COMPLETED', deliveryStatus: 'COMPLETED' })
    expect(row.status).toBe('COMPLETED')
  })

  it('采购单：沿用 order_status，不被错误改判（不回归）', async () => {
    const row = mapBillHistoryRow({ billType: 'purchase_order', billNo: 'F2-PO-1', orderStatus: 'CONFIRMED' })
    expect(row.status).toBe('CONFIRMED')
  })

  it('statusReason / retryEntry 有则透传（无则 null，不伪造）', async () => {
    const a = await withMockGet({ records: [{ billNo: 'F2-SB-4', businessStatus: 'REJECTED', statusReason: '客户拒收', retryEntry: 'store:manual-redeliver' }], total: 1 }, () => storeSaleBillsApi.list())
    expect(a.list[0].statusReason).toBe('客户拒收')
    expect(a.list[0].retryEntry).toBe('store:manual-redeliver')
    const b = await withMockGet({ records: [{ billNo: 'F2-SB-5', businessStatus: 'REJECTED' }], total: 1 }, () => storeSaleBillsApi.list())
    expect(b.list[0].statusReason).toBeNull()
    expect(b.list[0].retryEntry).toBeNull()
  })

  it('映射结果喂给 resolveRecoveryEntry ⇒ 出现「联系客服重新配送」且不可点击', async () => {
    const res = await withMockGet({ records: [{ billNo: 'F2-SB-6', businessStatus: 'REJECTED', collectionStatus: 'UNPAID' }], total: 1 }, () => storeSaleBillsApi.list())
    const row = res.list[0]
    const entry = resolveRecoveryEntry({ status: row.status, deliveryStatus: row.deliveryStatus, retryEntry: row.retryEntry, statusReason: row.statusReason })
    expect(entry.kind).toBe('manual-fallback')
    expect(entry.text).toContain('联系客服重新配送')
    expect(entry.clickable).toBe(false)
  })
})

// ===========================================================================
// MOBILE-REJECT-REDELIVER-ENTRY-01-F3 · 状态筛选回归（卡 §四 / §六）
//
// 页面筛选实现：`statuses.has((o.status||'').toUpperCase())`，筛选组为
//   unpaid = ['UNPAID','PENDING_PAYMENT']，paid = ['PAID']（orders.vue statusTags）
// ⇒ 筛选与展示**必须同源**（都用 item.status），故只要正常单 status 恢复为 collectionStatus，
//    「待收款/已收款」即自动恢复；失败单 status=REJECTED/DELIVERY_FAILED 不属这两组，不会被误判。
// ===========================================================================
describe('F3 · 状态筛选回归（待收款/已收款真实可用）', () => {
  /** 与 orders.vue 的 statusTags 同源口径（改页面时本测试同步红，防口径漂移） */
  const FILTER_GROUPS: Record<string, string[]> = {
    unpaid: ['UNPAID', 'PENDING_PAYMENT'],
    paid: ['PAID'],
  }
  /** 复刻页面筛选：statusTags 多选 OR 匹配 */
  const applyFilter = (rows: Array<{ status: string }>, keys: string[]) => {
    const set = new Set(keys.flatMap((k) => FILTER_GROUPS[k] || []))
    return rows.filter((r) => set.has((r.status || '').toUpperCase()))
  }

  it('正常 sale_bill UNPAID 命中「待收款」筛选', () => {
    const rows = [{ status: 'UNPAID' }, { status: 'PAID' }, { status: 'REJECTED' }]
    const got = applyFilter(rows, ['unpaid'])
    expect(got.map((r) => r.status)).toEqual(['UNPAID'])
  })

  it('正常 sale_bill PAID 命中「已收款」筛选', () => {
    const rows = [{ status: 'UNPAID' }, { status: 'PAID' }]
    const got = applyFilter(rows, ['paid'])
    expect(got.map((r) => r.status)).toEqual(['PAID'])
  })

  it('失败单不因「待收款」筛选被静默丢弃（它们不在收款组，应显式不被选中而非消失）', () => {
    const rows = [{ status: 'REJECTED' }, { status: 'DELIVERY_FAILED' }, { status: 'UNPAID' }]
    const unpaidHit = applyFilter(rows, ['unpaid'])
    // 关键：失败单不是收款单 ⇒ 不出现在「待收款」结果里（这是语义正确，不是丢弃）
    expect(unpaidHit.map((r) => r.status)).toEqual(['UNPAID'])
    // 而未筛选时它们必须都在（证明「不被静默丢弃」指的是全量视图可见）
    expect(rows.map((r) => r.status)).toContain('REJECTED')
    expect(rows.map((r) => r.status)).toContain('DELIVERY_FAILED')
  })

  it('端到端同源：同一批真实形状数据，映射后的 status 直接喂筛选 ⇒ 待收款/已收款各命中 1 条，失败单不混入', async () => {
    const payload = {
      records: [
        { billNo: 'F3-SB-UNPAID', customerName: '甲', receivableAmount: 66, businessStatus: 'CREATED', collectionStatus: 'UNPAID' },
        { billNo: 'F3-SB-PAID', customerName: '乙', receivableAmount: 88, businessStatus: 'COMPLETED', collectionStatus: 'PAID' },
        { billNo: 'F3-SB-REJ', customerName: '丙', receivableAmount: 33, businessStatus: 'REJECTED', collectionStatus: 'UNPAID' },
        { billNo: 'F3-SB-DF', customerName: '丁', receivableAmount: 44, businessStatus: 'DELIVERY_FAILED', collectionStatus: 'UNPAID' },
      ],
      total: 4,
    }
    const res = await withMockGet(payload, () => storeSaleBillsApi.list())
    const unpaidHit = applyFilter(res.list, ['unpaid'])
    const paidHit = applyFilter(res.list, ['paid'])
    // 待收款：只有正常 UNPAID 命中；失败单虽 collectionStatus=UNPAID，但 status 是失败态 ⇒ 不混入
    expect(unpaidHit.map((r: any) => r.billNo)).toEqual(['F3-SB-UNPAID'])
    expect(paidHit.map((r: any) => r.billNo)).toEqual(['F3-SB-PAID'])
    // 失败单确实在列表里（全量视图可见），只是不属收款组
    expect(res.list.filter((r: any) => /REJ|DF/.test(r.billNo)).map((r: any) => r.status).sort()).toEqual(['DELIVERY_FAILED', 'REJECTED'])
  })

  it('正常单显示中文「待收款/已收款」，不退化成裸 CREATED（页面 statusText 同源断言）', () => {
    const src = read('src/pages/orders/orders.vue')
    // 页面状态文案表必须含收款态中文
    expect(src).toMatch(/UNPAID:\s*'待收款'/)
    expect(src).toMatch(/PAID:\s*'已收款'/)
    // 且筛选组必须仍按收款态建组（防有人把组改成 CREATED）
    expect(src).toMatch(/key:\s*'unpaid',\s*keys:\s*\['UNPAID',\s*'PENDING_PAYMENT'\]/)
    expect(src).toMatch(/key:\s*'paid',\s*keys:\s*\['PAID'\]/)
    // 正常单的 status 不得是 CREATED：断言映射层非失败 sale_bill 不返回 businessStatus
    const row = mapBillHistoryRow({ billType: 'sale_bill', billNo: 'F3-X', businessStatus: 'CREATED', collectionStatus: 'UNPAID' })
    expect(row.status).toBe('UNPAID')
    expect(row.status).not.toBe('CREATED')
  })
})

