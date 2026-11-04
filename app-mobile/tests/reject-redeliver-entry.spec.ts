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
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRecoveryEntry, isDeliveryFailureStatus } from '../src/utils/order-recovery-entry'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

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
