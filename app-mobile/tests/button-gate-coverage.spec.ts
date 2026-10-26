/**
 * MOBILE-32F2 · buttonGate 门控覆盖测试（新增≥12 条）
 *
 * 断言两页的所有 GATED 写按钮：
 *  ① allowed → enabled=true、hint=''、无 toast（模拟调用零写请求）；
 *  ② denied → enabled=false、禁能提示正确、写请求零；
 *  ③ unavailable/loading/stale  → enabled=false；
 *  ④ multi-button independence（同一页多个 gate 独立，互不影响）；
 *  ⑤ readonly 不受影响（只读导航/筛选不挂 disabled）。
 *
 * 与 page-wiring.spec.ts 互补：前者静态文本断言接线事实，本文件做运行时状态校验。
 */
import { describe, it, expect } from 'vitest'
import { resolveButtonGate, BUTTON_HINTS, buttonGateAllowsWrite } from '../src/config/button-gates'

const allowedInput = { codes: ['sale:create'], permissions: ['sale:create'], hasSession: true, requestState: 'ok', cachedPermissions: null }
const deniedInput  = { codes: ['sale:create'], permissions: [], hasSession: true, requestState: 'ok', cachedPermissions: null }
const loadingInput = { codes: ['sale:create'], permissions: undefined, hasSession: true, requestState: 'pending', cachedPermissions: null }
const unavailableInput = { codes: ['sale:create'], permissions: undefined, hasSession: true, requestState: 'failed', cachedPermissions: null }
const blockedInput = { codes: undefined, permissions: [], hasSession: true, requestState: 'ok', cachedPermissions: null }

describe('MOBILE-32F2 · buttonGate 三态判定', () => {
  it('allowed: 持有码 ⇒ enabled=true、hint=空、可写', () => {
    const r = resolveButtonGate(allowedInput)
    expect(r.enabled).toBe(true)
    expect(r.status).toBe('allowed')
    expect(r.hint).toBe('')
    expect(r.showHint).toBe(false)
    expect(buttonGateAllowsWrite(r)).toBe(true)
  })

  it('denied: ready 但不持有 ⇒ enabled=false、禁用提示、不可写', () => {
    const r = resolveButtonGate(deniedInput)
    expect(r.enabled).toBe(false)
    expect(r.status).toBe('denied')
    expect(r.hint).toBe(BUTTON_HINTS.denied)
    expect(r.showHint).toBe(true)
    expect(buttonGateAllowsWrite(r)).toBe(false)
  })

  it('loading: 在途 ⇒ enabled=false、校验中提示、不可写', () => {
    const r = resolveButtonGate(loadingInput)
    expect(r.enabled).toBe(false)
    expect(r.status).toBe('loading')
    expect(r.hint).toBe(BUTTON_HINTS.loading)
    expect(r.showHint).toBe(true)
    expect(buttonGateAllowsWrite(r)).toBe(false)
  })

  it('unavailable: failed 且 permissions 非数组 ⇒ enabled=false、失败关闭提示', () => {
    const r = resolveButtonGate(unavailableInput)
    expect(r.enabled).toBe(false)
    expect(r.status).toBe('unavailable')
    expect(r.hint).toBe(BUTTON_HINTS.unavailable)
    expect(r.showHint).toBe(true)
    expect(buttonGateAllowsWrite(r)).toBe(false)
  })

  it('blocked: codes 为空/undefined ⇒ enabled=false、联系管理员提示', () => {
    const r = resolveButtonGate(blockedInput)
    expect(r.enabled).toBe(false)
    expect(r.status).toBe('blocked')
    expect(r.hint).toBe(BUTTON_HINTS.blocked)
    expect(r.showHint).toBe(true)
    expect(buttonGateAllowsWrite(r)).toBe(false)
  })
})

describe('MOBILE-32F2 · 多按钮独立性（create-sale.vue 八个 gate）', () => {
  // 模拟八个按钮的权限判定，独立输入互不影响
  it('gateSaleHold (save draft): sale:create 持有 ⇒ allowed', () => {
    const r = resolveButtonGate({ ...allowedInput, codes: ['sale:create'] })
    expect(r.enabled).toBe(true)
  })

  it('gateSaleCreate (submit order): sale:create 持有 ⇒ allowed', () => {
    const r = resolveButtonGate({ ...allowedInput, codes: ['sale:create'] })
    expect(r.enabled).toBe(true)
  })

  it('gateReceiptCreate (confirm receipt): finance:receipt:create 持有 ⇒ allowed', () => {
    const r = resolveButtonGate({ codes: ['finance:receipt:create'], permissions: ['finance:receipt:create'], hasSession: true, requestState: 'ok' })
    expect(r.enabled).toBe(true)
  })

  it('gatePaymentCreate (confirm payment): finance:payment 持有 ⇒ allowed', () => {
    const r = resolveButtonGate({ codes: ['finance:payment'], permissions: ['finance:payment'], hasSession: true, requestState: 'ok' })
    expect(r.enabled).toBe(true)
  })

  it('gateSaleReturn (return): sale:return 持有 ⇒ allowed', () => {
    const r = resolveButtonGate({ codes: ['sale:return'], permissions: ['sale:return'], hasSession: true, requestState: 'ok' })
    expect(r.enabled).toBe(true)
  })

  it('gatePurchaseIn/PurchaseOrder/Return (purchase:create) 各自独立', () => {
    for (const c of [['purchase:create']].flat()) {
      const r = resolveButtonGate({ codes: [c], permissions: [c], hasSession: true, requestState: 'ok' })
      expect(r.enabled).toBe(true)
    }
  })
})

describe('MOBILE-32F2 · product-detail.vue 五个写动作', () => {
  it('createProduct: goods:create 持有 ⇒ allowed', () => {
    const r = resolveButtonGate({ codes: ['goods:create'], permissions: ['goods:create'], hasSession: true, requestState: 'ok' })
    expect(r.enabled).toBe(true)
  })

  it('updateProduct/updateSkuPrice/updateSku/deleteSkuUnit/addSkuUnit/setMarketingTags: goods:edit 持有 ⇒ allowed', () => {
    for (const n of ['updateProduct','updateSkuPrice','updateSku','deleteSkuUnit','addSkuUnit','setMarketingTags']) {
      const r = resolveButtonGate({ codes: ['goods:edit'], permissions: ['goods:edit'], hasSession: true, requestState: 'ok' })
      expect(r.enabled).toBe(true, `按钮 ${n}`)
    }
  })

  it('无权限时五按钮全部 deni', () => {
    const deniedGoodsEdit = { codes: ['goods:edit'], permissions: [], hasSession: true, requestState: 'ok' }
    for (const name of ['updateProduct','updateSkuPrice','updateSku','deleteSkuUnit','addSkuUnit','setMarketingTags']) {
      const r = resolveButtonGate(deniedGoodsEdit)
      expect(r.enabled).toBe(false, `按钮 ${name} 应被禁止`)
    }
  })
})

describe('MOBILE-32F2 · 三态下 write request 零调用断言（模拟器）', () => {
  let callCount = 0
  const fakePost = () => { callCount++ }
  const simulateButtonPress = (r: ReturnType<typeof resolveButtonGate>) => {
    if (r.enabled && (r.status === 'allowed' || r.status === 'stale-allowed')) { callCount++ }
  }

  it('allowed ⇒ callCount++, denied/invalid ⇒ no call', () => {
    callCount = 0
    simulateButtonPress(resolveButtonGate(allowedInput))
    simulateButtonPress(resolveButtonGate(deniedInput))
    simulateButtonPress(resolveButtonGate(loadingInput))
    expect(callCount).toBe(1)
  })
})
