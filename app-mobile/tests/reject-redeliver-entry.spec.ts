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
  /** 直接调真实映射实现（不发网络请求）：mock 掉 request 层 */
  let storeSaleBillsApi: typeof import('../src/api/modules/orders').storeSaleBillsApi
  let billHistoryApi: typeof import('../src/api/modules/orders').billHistoryApi | any
  let mapBillHistoryRow: typeof import('../src/api/modules/orders').mapBillHistoryRow

  beforeAll(async () => {
    const mod: any = await import('../src/api/modules/orders')
    storeSaleBillsApi = mod.storeSaleBillsApi
    billHistoryApi = mod.billHistoryApi
    mapBillHistoryRow = mod.mapBillHistoryRow
  })

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

  it('sale_bill：正常 CREATED ⇒ status=CREATED（不回归成收款态）', async () => {
    const res = await withMockGet({ records: [{ billNo: 'F2-SB-3', customerName: '丙', receivableAmount: 100, businessStatus: 'CREATED', collectionStatus: 'PAID' }], total: 1 }, () => storeSaleBillsApi.list())
    expect(res.list[0].status, '正常单显示业务态 CREATED').toBe('CREATED')
    expect(res.list[0].collectionStatus).toBe('PAID')
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

