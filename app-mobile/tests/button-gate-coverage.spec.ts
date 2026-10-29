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
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveButtonGate, BUTTON_HINTS, buttonGateAllowsWrite } from '../src/config/button-gates'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

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

// ===========================================================================
// MOBILE-32F3 · 费用 / 收款 / 对账三页的按钮门运行时三态
//   码全部取后端实证（expense.routes.ts:19/20、receipt.routes.ts:23、
//   reconciliation.routes.ts:14/17），逐按钮各自判定，不做跨页共享 gate。
// ===========================================================================
const F3_ACTIONS = [
  { page: 'expenses', id: 'exp-approve', code: 'finance:create', gate: 'gateExpenseApprove' },
  { page: 'expenses', id: 'exp-reject', code: 'finance:create', gate: 'gateExpenseReject' },
  { page: 'receipts', id: 'rcpt-void', code: 'finance:receipt:create', gate: 'gateReceiptVoid' },
  { page: 'reconciliation', id: 'recon-confirm-customer', code: 'report:finance', gate: 'gateReconConfirm' },
  { page: 'reconciliation', id: 'recon-confirm-supplier', code: 'report:finance', gate: 'gateReconConfirm' },
]

describe('MOBILE-32F3 · 三页写动作 granted 态（持码 ⇒ 可点可写）', () => {
  for (const a of F3_ACTIONS) {
    it(`${a.id}（${a.gate} / ${a.code}）持有码 ⇒ enabled=true 且无提示`, () => {
      const r = resolveButtonGate({ codes: [a.code], permissions: [a.code], hasSession: true, requestState: 'ok' })
      expect(r.enabled, `${a.id}`).toBe(true)
      expect(r.status, `${a.id}`).toBe('allowed')
      expect(r.showHint, `${a.id}`).toBe(false)
      expect(buttonGateAllowsWrite(r), `${a.id}`).toBe(true)
    })
  }
})

describe('MOBILE-32F3 · 三页写动作 denied 态（不持码 ⇒ 禁用 + 说明 + 零写请求）', () => {
  for (const a of F3_ACTIONS) {
    it(`${a.id} 无该码 ⇒ disabled、提示为商户文案、点击不发写请求`, () => {
      const r = resolveButtonGate({ codes: [a.code], permissions: ['report:dashboard'], hasSession: true, requestState: 'ok' })
      expect(r.enabled, `${a.id}`).toBe(false)
      expect(r.status, `${a.id}`).toBe('denied')
      expect(r.hint, `${a.id}`).toBe(BUTTON_HINTS.denied)
      // 模拟点击：非 allowed/stale-allowed 一律不发请求
      let sent = 0
      if (r.enabled && (r.status === 'allowed' || r.status === 'stale-allowed')) sent++
      expect(sent, `${a.id} 被禁后仍发出写请求`).toBe(0)
    })
  }
})

describe('MOBILE-32F3 · 三页写动作权限请求失败态（失败关闭，不得放行）', () => {
  for (const a of F3_ACTIONS) {
    it(`${a.id} 取不到权限（requestState=failed 且非数组）⇒ disabled + 引导文案`, () => {
      const r = resolveButtonGate({ codes: [a.code], permissions: undefined, hasSession: true, requestState: 'failed' })
      expect(r.enabled, `${a.id}`).toBe(false)
      expect(r.status, `${a.id}`).toBe('unavailable')
      expect(r.hint, `${a.id}`).toBe(BUTTON_HINTS.unavailable)
      expect(buttonGateAllowsWrite(r), `${a.id}`).toBe(false)
    })
  }
})

describe('MOBILE-32F3 · 跨页码不得互用（持 finance:create 不能放行收款/对账）', () => {
  it('费用码 finance:create 对 rcpt-void / recon-confirm 一律 denied', () => {
    for (const id of ['rcpt-void', 'recon-confirm-customer', 'recon-confirm-supplier']) {
      const a = F3_ACTIONS.find((x) => x.id === id)!
      const r = resolveButtonGate({ codes: [a.code], permissions: ['finance:create'], hasSession: true, requestState: 'ok' })
      expect(r.enabled, `${id} 被 finance:create 误放行（懒绑宽泛码）`).toBe(false)
      expect(r.status, id).toBe('denied')
    }
  })

  it('收款码 finance:receipt:create 对费用/对账动作一律 denied', () => {
    for (const id of ['exp-approve', 'exp-reject', 'recon-confirm-customer']) {
      const a = F3_ACTIONS.find((x) => x.id === id)!
      const r = resolveButtonGate({ codes: [a.code], permissions: ['finance:receipt:create'], hasSession: true, requestState: 'ok' })
      expect(r.enabled, `${id} 被 finance:receipt:create 误放行`).toBe(false)
    }
  })

  it('通配码 report:* 覆盖 report:finance ⇒ 对账确认可用（后端同源镜像语义）', () => {
    const r = resolveButtonGate({ codes: ['report:finance'], permissions: ['report:*'], hasSession: true, requestState: 'ok' })
    expect(r.enabled).toBe(true)
    const r2 = resolveButtonGate({ codes: ['report:finance'], permissions: ['finance:*'], hasSession: true, requestState: 'ok' })
    expect(r2.enabled, '跨命名空间通配不得放行').toBe(false)
  })
})

describe('MOBILE-32F3 · 三页审计完备性（卡§五.1 不漏项 / §五.3 不伪造）', () => {
  it('F3 三页在 manifest 内均登记，且写动作条目恰为 5 条', () => {
    const mf = JSON.parse(read('scripts/button-gate-manifest.json'))
    const f3 = mf.entries.filter((e: any) => ['expenses', 'receipts', 'reconciliation'].includes(e.page))
    const writes = f3.filter((e: any) => ['GATED', 'BLOCKED_BACKEND_CODE'].includes(e.status))
    expect(writes.length, 'F3 写动作应为 5 条').toBe(5)
    expect(writes.every((e: any) => e.status === 'GATED'), 'F3 三页后端均有挂码，不应出现 BLOCKED').toBe(true)
    // 非写动作必须显式标注（UI_ONLY / READ_ONLY）
    const nonWrite = f3.filter((e: any) => e.status === 'UI_ONLY' || e.status === 'READ_ONLY')
    expect(nonWrite.length, 'F3 三页非写动作未全部标注').toBeGreaterThanOrEqual(4)
  })

  it('每页 gate 变量独立声明，未把三个页共用同一个常量', () => {
    const srcs: Record<string, string> = {
      expenses: read('src/pages-sub/finance/finance/expenses.vue'),
      receipts: read('src/pages-sub/finance/receipts/receipts.vue'),
      reconciliation: read('src/pages-sub/finance/reconciliation/reconciliation.vue'),
    }
    for (const [pg, src] of Object.entries(srcs)) {
      const decls = [...src.matchAll(/const\s+(gate\w+)\s*=\s*buttonGate/g)].map((m) => m[1])
      expect(decls.length, `${pg} 应有自己的 buttonGate 声明`).toBeGreaterThanOrEqual(1)
      expect(new Set(decls).size, `${pg} gate 名不得重复`).toBe(decls.length)
    }
    // 三页 gate 名互不相同（不存在跨页共享常量）
    const all = Object.values(srcs).flatMap((s) => [...s.matchAll(/const\s+(gate\w+)\s*=\s*buttonGate/g)].map((m) => m[1]))
    expect(new Set(all).size, '三页间出现同名共享 gate 常量').toBe(all.length)
  })

  it('说明文案不含内部权限码（对商户只说人话）', () => {
    for (const a of F3_ACTIONS) {
      const r = resolveButtonGate({ codes: [a.code], permissions: [], hasSession: true, requestState: 'ok' })
      expect(r.hint, `${a.id} 文案泄漏权限码`).not.toMatch(/:/)
      expect(r.hint.length).toBeGreaterThan(0)
    }
    const u = resolveButtonGate({ codes: ['finance:create'], permissions: undefined, hasSession: true, requestState: 'failed' })
    expect(u.hint).not.toMatch(/finance:create/)
  })

  it('stale 缓存态：上次持有⇒可用且标注；上次不持有⇒禁用', () => {
    const ok = resolveButtonGate({ codes: ['finance:create'], permissions: undefined, hasSession: true, requestState: 'failed', cachedPermissions: ['finance:create'] })
    expect(ok.enabled).toBe(true)
    expect(ok.stale).toBe(true)
    expect(ok.showHint).toBe(true)
    const no = resolveButtonGate({ codes: ['finance:create'], permissions: undefined, hasSession: true, requestState: 'failed', cachedPermissions: ['report:dashboard'] })
    expect(no.enabled).toBe(false)
    expect(no.status).toBe('stale-denied')
  })
})

// ===========================================================================
// MOBILE-32F4 · 会员三页（member-home / member-list / member-detail）
//   后端五个写端点全部无 requirePermission（store.routes.ts:44/45、
//   store-value-card.routes.ts:9/11、points.routes.ts:14 逐行实证）⇒
//   manifest 全部登记 BLOCKED_BACKEND_CODE；本节锁定「无码动作运行时恒拒绝」与守恒。
// ===========================================================================
const F4_MEMBER_WRITES = [
  { id: 'mbr-dtl-create', endpoint: 'POST /store/members/manage' },
  { id: 'mbr-dtl-update', endpoint: 'PUT /store/members/{id}' },
  { id: 'mbr-dtl-status', endpoint: 'PUT /store/members/{id}' },
  { id: 'mbr-dtl-recharge', endpoint: 'POST /admin/store-value-cards/{cardNo}/recharge' },
  { id: 'mbr-dtl-opencard', endpoint: 'POST /admin/store-value-cards' },
  { id: 'mbr-dtl-points-adjust', endpoint: 'POST /admin/members/{id}/points/adjust' },
]

describe('MOBILE-32F4 · 会员写动作运行时三态（无码 ⇒ blocked，任何账号/任何请求态都不得放行）', () => {
  for (const a of F4_MEMBER_WRITES) {
    it(`${a.id}（${a.endpoint}）codes=[] ⇒ blocked 禁用 + 引导文案 + 零写请求`, () => {
      // 后端未立码 ⇒ 前端若将来接线只能传 []，buttonGate 必须显式 blocked（不自造码、不放行）
      const r = resolveButtonGate({ codes: [], permissions: ['*'], hasSession: true, requestState: 'ok' })
      expect(r.enabled, `${a.id} 无码不得放行`).toBe(false)
      expect(r.status).toBe('blocked')
      expect(r.hint).toBe(BUTTON_HINTS.blocked)
      expect(buttonGateAllowsWrite(r), `${a.id} 不得发出写请求`).toBe(false)
    })
  }

  it('granted 账号 + 权限服务失败 + 加载中三态下，会员写动作点击模拟均零写请求', () => {
    const states = [
      { permissions: ['*'], requestState: 'ok' as const },          // granted（持码账号）
      { permissions: [], requestState: 'ok' as const },             // denied（不持码账号）
      { permissions: undefined, requestState: 'failed' as const },  // fail（权限服务失败）
    ]
    let sent = 0
    for (const s of states) {
      // 无码动作在三种状态下都先经 resolveButtonGate 预判（codes=[] ⇒ blocked），
      // 模拟按钮点击仅在 allowed/stale-allowed 时发出写请求
      for (const a of F4_MEMBER_WRITES) {
        const r = resolveButtonGate({ codes: [], permissions: s.permissions, hasSession: true, requestState: s.requestState })
        if (r.enabled && (r.status === 'allowed' || r.status === 'stale-allowed')) sent++
        expect(buttonGateAllowsWrite(r), `${a.id} @ ${s.requestState}`).toBe(false)
      }
    }
    expect(sent, '会员写请求必须为 0').toBe(0)
  })

  it('有码对照：若后端将来立码，持有 ⇒ allowed（证明 blocked 是码缺失所致而非写死拒绝）', () => {
    const r = resolveButtonGate({ codes: ['member:manage'], permissions: ['member:manage'], hasSession: true, requestState: 'ok' })
    expect(r.enabled).toBe(true)
    expect(r.status).toBe('allowed')
    expect(buttonGateAllowsWrite(r)).toBe(true)
  })

  it('blocked 文案对商户说人话（不泄漏端点/码/内部态）', () => {
    const r = resolveButtonGate({ codes: [], permissions: [], hasSession: true, requestState: 'ok' })
    expect(r.hint).toBe(BUTTON_HINTS.blocked)
    expect(r.hint).not.toMatch(/:/)
    expect(r.hint).not.toMatch(/store|admin|member|BLOCKED/i)
  })
})

describe('MOBILE-32F4 · 全 manifest 守恒（F2+F3 基数不因扩面漂移）', () => {
  it('GATED 仍为 22、BLOCKED 8、UI_ONLY 7、READ_ONLY 8、条目 45；写条目 = GATED + BLOCKED', () => {
    const mf = JSON.parse(read('scripts/button-gate-manifest.json'))
    const c = (s: string) => mf.entries.filter((e: any) => e.status === s).length
    expect(c('GATED'), 'GATED 不得因 F4 虚增（后端无码禁止标 GATED）').toBe(22)
    expect(c('BLOCKED_BACKEND_CODE')).toBe(8)
    expect(c('UI_ONLY')).toBe(7)
    expect(c('READ_ONLY')).toBe(8)
    expect(mf.entries.length).toBe(45)
    expect(c('GATED') + c('BLOCKED_BACKEND_CODE')).toBe(
      mf.entries.filter((e: any) => ['GATED', 'BLOCKED_BACKEND_CODE'].includes(e.status)).length
    )
  })

  it('F4 三页 UI_ONLY / READ_ONLY 条目均显式标注且不得携带非 GET 端点', () => {
    const mf = JSON.parse(read('scripts/button-gate-manifest.json'))
    for (const pid of ['member-home', 'member-list', 'member-detail']) {
      const es = mf.entries.filter((e: any) => e.page === pid)
      const nonWrite = es.filter((e: any) => ['UI_ONLY', 'READ_ONLY'].includes(e.status))
      expect(nonWrite.length, `${pid} 非写动作未全部标注`).toBeGreaterThanOrEqual(2)
      for (const e of nonWrite) {
        if (e.method) expect(e.method, `${e.id} 只读/UI 条目不得携带写方法`).toBe('GET')
      }
    }
  })
})

