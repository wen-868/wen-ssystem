/**
 * QODER-2（B3-1）· 入口门 ↔ 后端接线一致性用例
 *
 * 判据（卡 2 §三）：
 *   1) 每个 `gated` 入口的每条端点，后端注册行必须挂 `requirePermission(码)` 且 **码 ∈ 门的 codes**；
 *   2) 本卡 4 条售后端点后端**未接**（S3-250 收编单承接）⇒ 命中**具名待接白名单**即放行；
 *      白名单只校验「仍归属某个 gated 入口」，**不校验后端是否已接** ⇒ 后端接线后
 *      wired 分支优先命中、用例**自动转绿**（无需再改本文件）；反之若删掉注册表里的门，
 *      白名单条目成为孤儿 ⇒ 红并点名（本卡反测挂钩）。
 *   3) `pending-code` ⇒ codes 必须恒为空数组（不许硬挂不存在的码）且后端**尚未**接线
 *      （若后端已接 ⇒ 红并点名，提示注册表转 gated 补码）。
 *   4) 三态装置：持码=显示 / 不持码=隐藏 / 未取到码=隐藏；pending-code 一律隐藏。
 *
 * ⚠️ 口径边界（如实披露，回传卡 §七同步）：
 *   · 后端"接线"判定 = `requirePermission(` 与路由注册**同行**（guard-rbac-wiring 同款行内口径）；
 *   · `requirePermission(PERM_XX)` 常量形态仅解析**同文件** `const PERM_XX = "码"`；
 *   · 端点匹配为段级：`:param` / `*` 段与任一段互配（与 check-contract.mjs 同心智）。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { ENTRY_GATES, isPendingCodeEntry, type EntryGate } from '@/config/permission-gates'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_MOBILE_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(APP_MOBILE_ROOT, '..')
const BACKEND_ROUTES = join(REPO_ROOT, 'backend', 'src', 'routes')

const VERBS = ['get', 'post', 'put', 'patch', 'delete']

/** 本卡具名待接白名单（条目 → 理由）。后端接线后本表**无需改动**即自动转绿（见文件头判据 2） */
const PENDING_WIRING: Record<string, string> = {
  'POST /api/admin/aftersales/:id/approve':
    'B3-1：门已登记（sale:return），后端 aftersale.routes.ts:49 注册行无 requirePermission ⇒ 接线属 S3-250 收编单',
  'POST /api/admin/aftersales/:id/reject':
    'B3-1：同上（aftersale.routes.ts:51），接线属 S3-250 收编单',
  'POST /api/admin/aftersales/:id/inspect':
    'B3-1：同上（aftersale.routes.ts:66），接线属 S3-250 收编单',
  'POST /api/admin/aftersales/:id/complete':
    'B3-1：同上（aftersale.routes.ts:71），接线属 S3-250 收编单'
}

// ── 三态装置的权限桩（vi.mock 会被提升到文件头，闭包到调用时才读变量）────────
let triPerms: string[] | null | undefined
vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ permissions: triPerms })
}))
const { usePermissionGate } = await import('@/composables/usePermissionGate')

// ── 后端注册/接线扫描（与 check-contract.mjs 同款 prefixByRouter 配对）────────
interface BackendEp {
  method: string
  path: string
  code: string | null
  where: string
}

function prefixByRouter(src: string, receiverVars: string[]): Map<string, string> {
  const prefixes = [...src.matchAll(/prefix\s*:\s*["']([^"']*)["']/g)].map((m) => ({
    idx: m.index ?? 0,
    prefix: m[1]
  }))
  const map = new Map<string, string>()
  for (const m of src.matchAll(/router\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    let best: { d: number; prefix: string } | null = null
    for (const p of prefixes) {
      const d = Math.abs(p.idx - (m.index ?? 0))
      if (!best || d < best.d) best = { d, prefix: p.prefix }
    }
    if (best) map.set(m[1], best.prefix)
  }
  if (prefixes.length === 1) {
    for (const v of receiverVars) if (!map.has(v)) map.set(v, prefixes[0].prefix)
  }
  return map
}

function scanBackend(): BackendEp[] {
  const out: BackendEp[] = []
  for (const e of readdirSync(BACKEND_ROUTES, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.routes.ts')) continue
    const src = readFileSync(join(BACKEND_ROUTES, e.name), 'utf8')
    const callRe = new RegExp(
      `([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${VERBS.join('|')})\\s*\\(\\s*["'\`]([^"'\`\\n]*)`,
      'g'
    )
    const matches = [...src.matchAll(callRe)]
    const receiverVars = [...new Set(matches.map((m) => m[1]))]
    const prefixMap = prefixByRouter(src, receiverVars)
    const hasRouteConfig = /(^|\n)\s*(?:export\s+const\s+routeConfigs?\b)/.test(src)
    const filePrefix = hasRouteConfig ? null : `/api/${e.name.replace(/\.routes\.ts$/, '')}`
    // 同行 requirePermission 的**字符串字面量**码；常量名回落到同文件 `const PERM_X = "码"`
    const codeRe = new RegExp(
      "requirePermission\\(\\s*(?:\"([^\"]+)\"|'([^']+)'|`([^`]+)`|([A-Za-z_$][\\w$]*))"
    )
    const constMap = new Map<string, string>()
    for (const c of src.matchAll(/const\s+([A-Z][A-Z0-9_]+)\s*=\s*"([^"]+)"/g)) {
      constMap.set(c[1], c[2])
    }
    for (const m of matches) {
      const prefix = prefixMap.get(m[1]) ?? filePrefix
      if (!prefix) continue
      const start = m.index ?? 0
      const lineText = src.slice(start, src.indexOf('\n', start) + 1)
      const line = src.slice(0, start).split(/\r?\n/).length
      const cm = codeRe.exec(lineText)
      let code: string | null = null
      if (cm) code = cm[1] ?? cm[2] ?? cm[3] ?? constMap.get(cm[4]) ?? null
      out.push({
        method: m[2].toUpperCase(),
        path: normalize(prefix + m[3]),
        code,
        where: `backend/src/routes/${e.name}:${line}`
      })
    }
  }
  return out
}

function normalize(raw: string): string {
  let p = raw.replace(/\$\{[^}]*\}/g, '*').split('?')[0].trim()
  if (!p.startsWith('/')) p = '/' + p
  return p
}

/** 段级匹配：`:param` / `*` 段与任一段互配（与 check-contract.mjs 同心智，另认 `:x`） */
function segEq(a: string, b: string): boolean {
  const sa = a.split('/').filter(Boolean)
  const sb = b.split('/').filter(Boolean)
  if (sa.length !== sb.length) return false
  return sa.every((seg, i) => wildcard(seg) || wildcard(sb[i]) || seg === sb[i])
}
function wildcard(seg: string): boolean {
  return seg === '*' || seg.startsWith(':')
}

function endpointKey(ep: string): string {
  const [method, ...rest] = ep.split(/\s+/)
  return `${method.toUpperCase()} ${rest.join('')}`
}

function findBackendIn(index: BackendEp[], key: string): BackendEp | undefined {
  const sp = key.indexOf(' ')
  const method = key.slice(0, sp).toUpperCase()
  const path = normalize(key.slice(sp + 1))
  return index.find((b) => b.method === method && segEq(b.path, path))
}

const BACKEND = scanBackend()

/** 判据 1/2 的纯函数实现：gated 端点逐条裁决，返回违规点名字符串（空数组 ⇒ 全绿）。
 *  判定顺序**先看后端接线、命中即过、不再查白名单** ⇒ 后端接线后本函数自动转绿。 */
function checkGatedConsistency(gates: EntryGate[], index: BackendEp[]): string[] {
  const violations: string[] = []
  for (const g of gates) {
    for (const ep of g.endpoints) {
      const key = endpointKey(ep)
      const b = findBackendIn(index, key)
      if (b && b.code !== null) {
        if (!g.codes.includes(b.code)) {
          violations.push(`${g.id}｜${key}｜后端已挂 ${b.code} ∉ 门 codes ${JSON.stringify(g.codes)}（${b.where}）`)
        }
        continue
      }
      if (!PENDING_WIRING[key]) {
        violations.push(
          `${g.id}｜${key}｜后端${b ? '注册行未挂 requirePermission' : '无此注册'}，且不在具名待接白名单`
        )
      }
    }
  }
  return violations
}

describe('B3-1 注册表自洽（status/codes 不变量 + 本卡 5 条登记逐条）', () => {
  it('gated ⇒ codes 非空；registered / pending-code ⇒ codes 恒空（不许硬挂不存在的码）', () => {
    const bad = ENTRY_GATES.filter(
      (g) =>
        (g.status === 'gated' && g.codes.length === 0) ||
        (g.status !== 'gated' && g.codes.length > 0)
    ).map((g) => `${g.id}（status=${g.status}, codes=${JSON.stringify(g.codes)}）`)
    expect(bad, `状态与码数组矛盾：\n${bad.join('\n')}`).toEqual([])
  })

  it('本卡登记：售后门 = gated + sale:return（4 条端点逐条在册）', () => {
    const g = ENTRY_GATES.find((x) => x.id === 'island-aftersale')
    expect(g).toBeDefined()
    expect(g!.status).toBe('gated')
    expect(g!.codes).toEqual(['sale:return'])
    expect(g!.page).toBe('pages-sub/order/order-aftersale/aftersale.vue')
    expect(g!.endpoints).toEqual([
      'POST /api/admin/aftersales/:id/approve',
      'POST /api/admin/aftersales/:id/reject',
      'POST /api/admin/aftersales/:id/inspect',
      'POST /api/admin/aftersales/:id/complete'
    ])
    expect(g!.note).toContain('S3-250')
  })

  it('本卡登记：积分调整门 = pending-code + codes 空 + 未开通口径在册', () => {
    const g = ENTRY_GATES.find((x) => x.id === 'mkt-points-adjust')
    expect(g).toBeDefined()
    expect(g!.status).toBe('pending-code')
    expect(g!.codes).toEqual([])
    expect(g!.endpoints).toEqual(['POST /api/admin/members/:id/points/adjust'])
    expect(g!.page).toBe('pages-sub/marketing/member/member-detail.vue')
    expect(g!.note).toContain('未开通')
    expect(isPendingCodeEntry(g!.id)).toBe(true)
  })
})

describe('B3-1 入口门 ↔ 后端接线一致性', () => {
  const gated = ENTRY_GATES.filter((x) => x.status === 'gated')

  it('gated 端点：后端已接且码 ∈ codes，或命中具名待接白名单；违反逐条点名', () => {
    const violations = checkGatedConsistency(gated, BACKEND)
    expect(violations, `一致性违规：\n${violations.join('\n')}`).toEqual([])
  })

  it('自动转绿机检（合成后端，不碰 backend 文件）：4 条售后端点挂上 sale:return ⇒ 零违规且无需改白名单', () => {
    const wired = BACKEND.map((b) =>
      PENDING_WIRING[`${b.method} ${b.path}`] ? { ...b, code: 'sale:return' } : b
    )
    expect(checkGatedConsistency(gated, wired)).toEqual([])
    // 防假绿：合成索引里必须真的命中了这 4 条未接注册，否则本用例什么都没测
    const hit = BACKEND.filter((b) => PENDING_WIRING[`${b.method} ${b.path}`])
    expect(hit.map((b) => `${b.method} ${b.path}`).sort()).toEqual(
      Object.keys(PENDING_WIRING).sort()
    )
  })

  it('反例自检：后端若挂了 ∉ 门 codes 的码 ⇒ 逐条点名违规（不许静默放行）', () => {
    const wrong = BACKEND.map((b) =>
      PENDING_WIRING[`${b.method} ${b.path}`] ? { ...b, code: 'sale:whatever' } : b
    )
    const violations = checkGatedConsistency(gated, wrong)
    expect(violations).toHaveLength(4)
    for (const key of Object.keys(PENDING_WIRING)) {
      expect(violations.some((v) => v.includes(key) && v.includes('sale:whatever'))).toBe(true)
    }
  })

  it('待接白名单条目必须仍归属某个 gated 入口（删登记 ⇒ 红并点名；本卡反测挂钩）', () => {
    const gatedKeys = new Set(
      ENTRY_GATES.filter((g) => g.status === 'gated').flatMap((g) => g.endpoints.map(endpointKey))
    )
    const orphans = Object.keys(PENDING_WIRING).filter((k) => !gatedKeys.has(k))
    expect(
      orphans,
      `白名单条目失去对应的 gated 登记（门被删/降级？另：后端接线后请顺带清理本表条目）：\n${orphans.join('\n')}`
    ).toEqual([])
  })

  it('pending-code 端点：后端必须尚未接线（已接 ⇒ 红并点名，提示注册表转 gated 补码）', () => {
    const violations: string[] = []
    for (const g of ENTRY_GATES.filter((x) => x.status === 'pending-code')) {
      for (const ep of g.endpoints) {
        const key = endpointKey(ep)
        const b = findBackendIn(BACKEND, key)
        if (b && b.code !== null) {
          violations.push(`${g.id}｜${key}｜后端已挂 ${b.code} ⇒ 应把该门转 gated 并补码（立码已定？）`)
        }
      }
    }
    expect(violations, `pending-code 矛盾：\n${violations.join('\n')}`).toEqual([])
  })
})

describe('B3-1 三态装置（持码=显示 / 不持码=0 / 未取到=0；pending-code 恒 0）', () => {
  const gate = (p: string[] | null | undefined, id: string): boolean => {
    triPerms = p
    return usePermissionGate().canEntry(id)
  }

  it('售后门（gated sale:return）：持码/通配=显示；不持/空数组/未取到=隐藏', () => {
    expect(gate(['sale:return'], 'island-aftersale')).toBe(true)
    expect(gate(['*'], 'island-aftersale')).toBe(true)
    expect(gate(['sale:create'], 'island-aftersale')).toBe(false)
    expect(gate([], 'island-aftersale')).toBe(false)
    expect(gate(null, 'island-aftersale')).toBe(false)
    expect(gate(undefined, 'island-aftersale')).toBe(false)
  })

  it('积分调整门（pending-code）：任何权限形态一律隐藏（含持通配码）', () => {
    expect(gate(['*'], 'mkt-points-adjust')).toBe(false)
    expect(gate(['sale:return'], 'mkt-points-adjust')).toBe(false)
    expect(gate([], 'mkt-points-adjust')).toBe(false)
    expect(gate(null, 'mkt-points-adjust')).toBe(false)
    expect(gate(undefined, 'mkt-points-adjust')).toBe(false)
  })
})

describe('B3-1 页面挂载点（门只从注册表取码，页面按 canEntry 引用门 id）', () => {
  it('售后页：PENDING 动作按钮块已挂本门，且不再存在未门控的同一 v-if', () => {
    const src = readFileSync(
      join(APP_MOBILE_ROOT, 'src/pages-sub/order/order-aftersale/aftersale.vue'),
      'utf8'
    )
    expect(src).toContain(`v-if="item.status === 'PENDING' && canEntry('island-aftersale')"`)
    expect(src).not.toContain(`v-if="item.status === 'PENDING'">`)
    expect(src).toContain(`import { usePermissionGate } from '@/composables/usePermissionGate'`)
  })

  it('会员详情页：调整积分按钮已挂本门（pending-code ⇒ 恒隐藏，按未开通处理）', () => {
    const src = readFileSync(
      join(APP_MOBILE_ROOT, 'src/pages-sub/marketing/member/member-detail.vue'),
      'utf8'
    )
    expect(src).toContain(`v-if="canEntry('mkt-points-adjust')" @tap="openDlg('points')"`)
    expect(src).toContain(`import { usePermissionGate } from '@/composables/usePermissionGate'`)
  })
})
