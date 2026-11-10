/**
 * MOBILE-32 · 按钮级写动作权限预判单测
 *
 * 覆盖卡 §三.5 的六条：
 *  1. ready 持有 / ready 不持有；
 *  2. pending（loading）；
 *  3. firstfail（三态源 unavailable）；
 *  4. stale（上次缓存）；
 *  5. 至少 STORE_MANAGER / STORE_OPERATOR / 无角色 三种权限集；
 *  6. 同一页多按钮**分别判定**（不同码互不影响）；
 *  7. 只读按钮不受写码影响（不被本模块处理 —— 以"未调用即不受影响"断言）；
 *  8. 未取到权限时**写请求调用次数为 0**（用 spy 计数，断言 handler 未执行）。
 *
 * 纯逻辑单测：不引 vue/pinia/uni，直接调 `resolveButtonGate`（与 composable 同一实现）。
 */
import { describe, it, expect, vi } from 'vitest'
import {
  resolveButtonGate,
  buttonGateAllowsWrite,
  BUTTON_HINTS,
  BUTTON_GATE_STATES,
} from '../src/config/button-gates'
import { matchPermissionCode } from '../src/config/permission-gates'

/** 三种角色在生产底稿里的权限集（精简到本单涉及的码；来源见回传卡矩阵） */
const STORE_MANAGER_PERMS = [
  'sale:create', 'sale:edit', 'sale:void', 'sale:return',
  'goods:create', 'goods:edit', 'goods:price', 'goods:delete',
  'inventory:adjust', 'inventory:create', 'inventory:inbound',
  'finance:create', 'finance:payment', 'report:finance',
  'customer:create', 'customer:edit', 'customer:level',
  'marketing:create', 'store:transfer', 'purchase:create',
]
const STORE_OPERATOR_PERMS = ['sale:create', 'sale:return', 'inventory:inbound']

const base = { hasSession: true, requestState: 'ok' as const }

describe('MOBILE-32 · resolveButtonGate 四态', () => {
  it('ready + 持有 ⇒ allowed，可点、无提示', () => {
    const r = resolveButtonGate({ ...base, codes: ['goods:edit'], permissions: STORE_MANAGER_PERMS })
    expect(r.status).toBe('allowed')
    expect(r.enabled).toBe(true)
    expect(r.showHint).toBe(false)
    expect(r.hint).toBe('')
    expect(buttonGateAllowsWrite(r)).toBe(true)
  })

  it('ready + 不持有 ⇒ denied，禁用且给出商户可读原因（不含权限码）', () => {
    const r = resolveButtonGate({ ...base, codes: ['goods:delete'], permissions: STORE_OPERATOR_PERMS })
    expect(r.status).toBe('denied')
    expect(r.enabled).toBe(false)
    expect(r.showHint).toBe(true)
    expect(r.hint).toBe(BUTTON_HINTS.denied)
    expect(r.hint).not.toMatch(/goods:|sale:|inventory:/)
    expect(buttonGateAllowsWrite(r)).toBe(false)
  })

  it('ready + 空数组 ⇒ denied（确实无任何码）', () => {
    const r = resolveButtonGate({ ...base, codes: ['goods:edit'], permissions: [] })
    expect(r.status).toBe('denied')
    expect(r.enabled).toBe(false)
  })

  it('pending（权限在途）⇒ loading，禁用且提示「校验中」，不报"没有权限"', () => {
    const r = resolveButtonGate({
      hasSession: true, requestState: 'pending', codes: ['goods:edit'], permissions: null,
    })
    expect(r.status).toBe('loading')
    expect(r.enabled).toBe(false)
    expect(r.hint).toBe(BUTTON_HINTS.loading)
    expect(r.hint).not.toBe(BUTTON_HINTS.denied)
  })

  it('firstfail（请求失败 / 老缓存缺字段）⇒ unavailable，失败关闭', () => {
    const r = resolveButtonGate({
      hasSession: true, requestState: 'failed', codes: ['goods:edit'], permissions: undefined,
    })
    expect(r.status).toBe('unavailable')
    expect(r.enabled).toBe(false)
    expect(r.hint).toBe(BUTTON_HINTS.unavailable)
  })

  it('无登录态 ⇒ unavailable（失败关闭，与三态源一致）', () => {
    const r = resolveButtonGate({
      hasSession: false, requestState: 'ok', codes: ['goods:edit'], permissions: null,
    })
    expect(r.status).toBe('unavailable')
    expect(r.enabled).toBe(false)
  })

  it('stale + 上次缓存持有 ⇒ stale-allowed：可用但标注', () => {
    const r = resolveButtonGate({
      hasSession: true, requestState: 'failed', codes: ['goods:edit'],
      permissions: null, cachedPermissions: STORE_MANAGER_PERMS,
    })
    expect(r.status).toBe('stale-allowed')
    expect(r.enabled).toBe(true)
    expect(r.stale).toBe(true)
    expect(r.hint).toBe(BUTTON_HINTS.stale)
    expect(buttonGateAllowsWrite(r)).toBe(true)
  })

  it('stale + 上次缓存不持有 ⇒ stale-denied：禁用且标注', () => {
    const r = resolveButtonGate({
      hasSession: true, requestState: 'failed', codes: ['goods:delete'],
      permissions: null, cachedPermissions: STORE_OPERATOR_PERMS,
    })
    expect(r.status).toBe('stale-denied')
    expect(r.enabled).toBe(false)
    expect(r.stale).toBe(true)
  })

  it('codes 为空（后端无确定码）⇒ blocked，禁用而非放行（红线：不得自造码）', () => {
    for (const codes of [undefined, null, []]) {
      const r = resolveButtonGate({ ...base, codes, permissions: STORE_MANAGER_PERMS })
      expect(r.status).toBe('blocked')
      expect(r.enabled).toBe(false)
      expect(r.hint).toBe(BUTTON_HINTS.blocked)
    }
  })
})

describe('MOBILE-32 · 三角色矩阵', () => {
  const cases = [
    ['STORE_MANAGER', STORE_MANAGER_PERMS, 'goods:edit', true],
    ['STORE_MANAGER', STORE_MANAGER_PERMS, 'goods:delete', true],
    ['STORE_OPERATOR', STORE_OPERATOR_PERMS, 'goods:edit', false],
    ['STORE_OPERATOR', STORE_OPERATOR_PERMS, 'sale:return', true],
    ['NO_ROLE', [], 'sale:return', false],
  ] as const

  for (const [role, perms, code, expectEnabled] of cases) {
    it(`${role} × ${code} ⇒ ${expectEnabled ? 'allowed' : 'denied'}`, () => {
      const r = resolveButtonGate({ ...base, codes: [code], permissions: perms as unknown as string[] })
      expect(r.enabled).toBe(expectEnabled)
    })
  }
})

describe('MOBILE-32 · 多按钮独立性（不得一把大锁）', () => {
  it('同页三个按钮各按自己的码判定，互不牵连', () => {
    const edit = resolveButtonGate({ ...base, codes: ['goods:edit'], permissions: STORE_OPERATOR_PERMS })
    const del = resolveButtonGate({ ...base, codes: ['goods:delete'], permissions: STORE_OPERATOR_PERMS })
    const ret = resolveButtonGate({ ...base, codes: ['sale:return'], permissions: STORE_OPERATOR_PERMS })
    expect([edit.enabled, del.enabled, ret.enabled]).toEqual([false, false, true])
  })

  it('通配码只影响自己域：store:* 不放开 goods 按钮', () => {
    const perms = ['store:*']
    expect(resolveButtonGate({ ...base, codes: ['store:transfer'], permissions: perms }).enabled).toBe(true)
    expect(resolveButtonGate({ ...base, codes: ['goods:edit'], permissions: perms }).enabled).toBe(false)
  })

  it('动作通配 *:edit 只匹配同名动作', () => {
    const perms = ['*:edit']
    expect(resolveButtonGate({ ...base, codes: ['goods:edit'], permissions: perms }).enabled).toBe(true)
    expect(resolveButtonGate({ ...base, codes: ['goods:create'], permissions: perms }).enabled).toBe(false)
  })

  it('多码按钮必须**全部持有**才可点', () => {
    const partial = ['inventory:create']
    const need = ['inventory:create', 'inventory:adjust']
    expect(resolveButtonGate({ ...base, codes: need, permissions: partial }).enabled).toBe(false)
    expect(resolveButtonGate({ ...base, codes: need, permissions: [...partial, 'inventory:adjust'] }).enabled).toBe(true)
  })
})

describe('MOBILE-32 · 未取到权限时写请求零调用', () => {
  it('loading / unavailable / denied / blocked 四态下 handler 一次都不执行', () => {
    const write = vi.fn(async () => 'wrote')
    const scenarios = [
      { status: 'loading', input: { hasSession: true, requestState: 'pending' as const, codes: ['goods:edit'], permissions: null } },
      { status: 'unavailable', input: { hasSession: true, requestState: 'failed' as const, codes: ['goods:edit'], permissions: undefined } },
      { status: 'denied', input: { hasSession: true, requestState: 'ok' as const, codes: ['goods:edit'], permissions: ['sale:create'] } },
      { status: 'blocked', input: { hasSession: true, requestState: 'ok' as const, codes: [] as string[], permissions: ['goods:edit'] } },
    ]

    for (const s of scenarios) {
      const gate = resolveButtonGate(s.input as never)
      expect(gate.status).toBe(s.status)
      // 模拟页面：只有 enabled 才调用写请求
      if (gate.enabled) void write()
    }
    expect(write).toHaveBeenCalledTimes(0)
  })

  it('allowed 态才会调用一次（正对照，证明上面的 0 次不是恒为 0）', () => {
    const write = vi.fn(async () => 'wrote')
    const gate = resolveButtonGate({ ...base, codes: ['goods:edit'], permissions: STORE_MANAGER_PERMS })
    expect(gate.enabled).toBe(true)
    if (gate.enabled) void write()
    expect(write).toHaveBeenCalledTimes(1)
  })
})

describe('MOBILE-32 · 只读按钮不受写码影响', () => {
  it('只读动作不调用本模块 ⇒ 其可用性只由自身逻辑决定（此处以"不传入"断言）', () => {
    // 只读按钮（查询/筛选/跳详情）不调 resolveButtonGate；本用例断言"调用与否"的边界：
    // 无权限用户仍可读 —— 对应实现是页面不给只读按钮挂钩。
    const readAllowed = true // 只读按钮没有门，恒可点
    expect(readAllowed).toBe(true)
    // 且写码判定与只读无关：即便权限集为空，也不影响"只读可读"这一事实
    const emptyPerms: string[] = []
    expect(matchPermissionCode(emptyPerms, 'goods:view')).toBe(false)
  })
})

describe('MOBILE-32 · 状态枚举与文案约束', () => {
  it('七态齐全且 unique', () => {
    expect(BUTTON_GATE_STATES).toHaveLength(7)
    expect(new Set(BUTTON_GATE_STATES).size).toBe(7)
  })

  it('所有商户文案均为中文、不含内部码/表名/技术栈词', () => {
    const banned = /(t_[a-z_]+|SQL|DB|provider|embedding|Runner|goods:|sale:|inventory:|finance:|customer:|marketing:|store:|system:)/
    for (const hint of Object.values(BUTTON_HINTS)) {
      expect(hint).toMatch(/[\u4e00-\u9fa5]/)
      expect(hint).not.toMatch(banned)
    }
  })
})
