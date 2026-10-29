/**
 * MOBILE-32 · 页面接线静态断言（mutation M1/M3 的判据来源）
 *
 * 纯函数单测覆盖不到"页面有没有真的把门绑上按钮"，故本文件**读源码**断言接线事实：
 *  1. 每个已接线页面：`buttonGate([...])` 声明的码 == 后端实证码（**逐按钮各自**）；
 *  2. 每个写按钮的 `@tap` 必须带 `gateXxx.enabled &&` 短路（否则就是"点了才 403"）；
 *  3. 同一页多个按钮**不得**共用同一 gate 常量（独立性）；
 *  4. 只读按钮（查询/筛选/加载更多/详情）**不得**被挂 disabled。
 *
 * ⚠️ 本文件不做构建、不加载 vue，只做文本断言 ⇒ 可在 node 环境秒级跑完。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/** 已接线页面 → 期望的 (gate 常量 → 码) 映射（码来自后端实证，见证据 raw/03） */
const WIRED: Record<string, Record<string, string[]>> = {
  'src/pages-sub/finance/transfer/transfer.vue': {
    gateCancel: ['store:transfer'],
    gateSubmit: ['store:transfer'],
    gateReject: ['store:transfer'],
    gateApprove: ['store:transfer'],
    gateShip: ['store:transfer'],
    gateReceive: ['store:transfer'],
  },
  'src/pages-sub/finance/receipts/receipts.vue': {
    gateReceiptVoid: ['finance:receipt:create'],
  },
  // MOBILE-32F3：费用页两按钮（缩进债已由 MOBILE-32F1 清除，本卡完成接线；从 BLOCKED_PAGES 移入）
  'src/pages-sub/finance/finance/expenses.vue': {
    gateExpenseApprove: ['finance:create'],
    gateExpenseReject: ['finance:create'],
  },
  // MOBILE-32F3：对账页确认按钮（入口门 canEntry 之外补按钮级预判）
  'src/pages-sub/finance/reconciliation/reconciliation.vue': {
    gateReconConfirm: ['report:finance'],
  },
  'src/pages-sub/finance/statements/statements.vue': {
    gateStatementConfirm: ['customer:statement'],
  },
  'src/pages/sales/create-sale.vue': {
    gateSaleHold: ['sale:create'],
    gateSaleCreate: ['sale:create'],
    gateReceiptCreate: ['sale:create'],
    gatePurchaseReturn: ['sale:return'],
    gatePurchaseIn: ['inventory:inbound'],
    gatePurchaseOrder: ['purchase:create'],
    gateGoodsCreate: ['goods:create'],
  },
  'src/pages/products/product-detail.vue': {
    gateGoodsCreate: ['goods:create'],
    gateGoodsEdit: ['goods:edit'],
    gateGoodsPrice: ['goods:price'],
    gateGoodsDelete: ['goods:delete'],
  },
}

/**
 * MOBILE-32F2 · 后端**无权限守卫**的写动作 ⇒ 前端 gateVar 必须为 null（不自绑、不伪造）。
 * 依据（逐条行号）：
 *  - payment-new.routes.ts:14 `POST /api/admin/payments-new/` 无 requirePermission（S3-223「本行不接」，
 *    属 rbac G0/G1/G2 锁定的 C 类待裁）；注册表 finance:payment 对应的是**另一条** /admin/purchase-payments。
 *  - sale-return.routes.ts:12 `POST /` 无 requirePermission（同文件 :23-26 记录本批不接的理由：
 *    接了会把 STORE_OPERATOR 打成 403）。
 * 断言：这两个变量必须声明为 null，且**不得**出现 buttonGate([...]) 形态。
 */
const BLOCKED_BACKEND_CODE: Record<string, string[]> = {
  'src/pages/sales/create-sale.vue': ['gatePaymentCreate', 'gateSaleReturn'],
}

/**
 * **历史 BLOCKED 登记（MOBILE-32F3 已解除）**
 *
 * `expenses.vue` 曾因「整文件 2 空格模板缩进 vs lint `vue/html-indent: ['warn', 4]`」被登记为 BLOCKED
 * （缩进债由 MOBILE-32F1 清除；F1 回传读数确认 warning 基线未变）。本卡完成该页接线，
 * 故从 BLOCKED_PAGES 移入 WIRED。
 *
 * ⚠️ 保留本节作为血统记录，并新增一条断言：**该页现已接线，不得再回落 BLOCKED**
 *    （防止有人把它从 WIRED 删掉后又不接线，形成"既不在已接线、也不在待办"的黑洞）。
 */
const UNBLOCKED_PAGES: Record<string, string> = {
  'src/pages-sub/finance/finance/expenses.vue':
    'UNBLOCKED（MOBILE-32F3）：缩进债已由 MOBILE-32F1 清除，本卡接 gateExpenseApprove/gateExpenseReject',
}

describe('MOBILE-32 · 页面接线：每个按钮绑自己的码', () => {
  for (const [page, gates] of Object.entries(WIRED)) {
    it(`${page} 的 ${Object.keys(gates).length} 个 gate 均按后端实证码声明`, () => {
      const src = read(page)
      for (const [name, codes] of Object.entries(gates)) {
        const re = new RegExp(`const\\s+${name}\\s*=\\s*buttonGate\\(\\[([^\\]]*)\\]\\)`)
        const m = src.match(re)
        expect(m, `${page} 缺少 ${name} 声明`).toBeTruthy()
        const got = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
        expect(got, `${name} 的码应为 ${codes.join(',')}`).toEqual(codes)
      }
    })

    it(`${page} 的每个写按钮 @tap 都带 gate 短路（不得"点了才 403"）`, () => {
      const src = read(page)
      // @tap 可带修饰符（@tap.stop / @tap.capture 等），形态与无修饰符等价，一律纳入判定
      const taps = [...src.matchAll(/@tap(?:\.\w+)?="([^"]*)"/g)].map((m) => m[1])
      // 新页采用 dispatcher 模式：@tap="onActionTap(act)"/"onMainAction"，gate 检查在 handler 内
      const isDispatcher = page.includes('create-sale.vue') || page.includes('product-detail.vue')
      if (isDispatcher) {
        // dispatcher 形态：每个 gate 常量都必须被绑定为某动作的 writeGate（或直接在 handler 首行检查），
        // 且 dispatcher/handler 内存在 .value.enabled 短路
        for (const gateName of Object.keys(gates)) {
          const bound =
            new RegExp(`writeGate:\\s*${gateName}\\b`).test(src) ||
            new RegExp(`${gateName}\\.value\\.enabled`).test(src) ||
            new RegExp(`gateOrHint\\(\\s*${gateName}\\s*\\)`).test(src)
          expect(bound, `${page} 的 ${gateName} 既未绑定 writeGate，也未在 handler / gateOrHint 内检查`).toBe(true)
        }
        expect(src).toMatch(/\.value\.enabled/)
        return
      }
      const gatedTaps = taps.filter((t) => /gate\w+\.enabled\s*&&/.test(t))
      expect(gatedTaps.length, `${page} 带 gate 短路的 @tap 数为 ${gatedTaps.length}`).toBeGreaterThanOrEqual(1)
      const bareWrite = taps.filter((t) => /^(handleCancel|handleSubmit|handleReject|handleApprove|handleShip|handleReceive|goCreate|confirmReject|voidReceipt|confirmStatement)\(/.test(t.trim()))
      expect(bareWrite, `发现未预判的写按钮调用: ${bareWrite.join(' | ')}`).toEqual([])
    })
  }
})

describe('MOBILE-32F2 · BLOCKED_BACKEND_CODE 防伪造（后端没守卫就不许前端自称已门控）', () => {
  for (const [page, vars] of Object.entries(BLOCKED_BACKEND_CODE)) {
    it(`${page} 的 ${vars.join(' / ')} 必须声明为 null 且不得出现 buttonGate 绑定`, () => {
      const src = read(page)
      for (const v of vars) {
        expect(src, `${v} 应为 null（不自绑、不伪造）`).toMatch(new RegExp(`const\\s+${v}\\s*=\\s*null\\b`))
        expect(src, `${v} 不得被 buttonGate([…]) 赋码（后端该端点无 requirePermission）`).not.toMatch(new RegExp(`const\\s+${v}\\s*=\\s*buttonGate\\(`))
      }
    })

    it(`${page} 的 manifest 中这些动作必须是 BLOCKED_BACKEND_CODE 且 permissionCodes 为空`, () => {
      const mf = JSON.parse(read('scripts/button-gate-manifest.json'))
      const pid = page.includes('create-sale') ? 'create-sale' : 'product-detail'
      for (const v of vars) {
        const e = mf.entries.find((x: any) => x.page === pid && x.gateVar === v)
        expect(e, `manifest 缺少 ${v} 对应动作条目`).toBeTruthy()
        expect(e!.status, `${v} 应为 BLOCKED_BACKEND_CODE`).toBe('BLOCKED_BACKEND_CODE')
        expect(e!.permissionCodes, `${v} 不得带权限码`).toEqual([])
        expect(e!.codeProof, `${v} 必须给出后端无守卫的行号依据`).toMatch(/routes\.ts:\d+/)
      }
    })
  }
})

describe('MOBILE-32 · 多按钮独立性（不得一把大锁）', () => {
  it('transfer.vue 六个 gate 各自独立声明（不是同一个常量复用别名）', () => {
    const src = read('src/pages-sub/finance/transfer/transfer.vue')
    const decls = [...src.matchAll(/const\s+(gate\w+)\s*=\s*buttonGate/g)].map((m) => m[1])
    expect(new Set(decls).size).toBe(decls.length)
    expect(decls.length).toBeGreaterThanOrEqual(6)
  })

  it('同一页不同按钮的码不得被绑成一个宽泛码集合以外的错码', () => {
    const src = read('src/pages-sub/finance/transfer/transfer.vue')
    // 六个 gate 都必须是本域真实码 store:transfer，不得出现 goods:/sale: 等跨域码
    const codes = [...src.matchAll(/buttonGate\(\[([^\]]*)\]\)/g)].map((m) => m[1])
    expect(codes.length).toBeGreaterThanOrEqual(6)
    for (const c of codes) {
      expect(c).toMatch(/store:transfer/)
      expect(c).not.toMatch(/goods:|sale:create|inventory:/)
    }
  })
})

describe('MOBILE-32 · 只读按钮不被误禁用', () => {
  const READONLY_PAGES = [
    'src/pages-sub/finance/transfer/transfer.vue',
    'src/pages-sub/finance/finance/expenses.vue',
    'src/pages-sub/finance/receipts/receipts.vue',
    'src/pages-sub/finance/statements/statements.vue',
  ]
  for (const page of READONLY_PAGES) {
    it(`${page} 的只读 @tap（查询/筛选/加载更多/详情/tab）不带 disabled`, () => {
      const src = read(page)
      const taps = [...src.matchAll(/<[^>]*@tap="([^"]*)"[^>]*>/g)].map((m) => m[0])
      const readOnly = taps.filter((tag) => /(search|query|filter|switchTab|switchStatus|loadMore|detail|Detail|tab|clearSearch|reset)/i.test(tag))
      for (const tag of readOnly) {
        expect(tag, `只读控件被挂了 disabled：${tag.slice(0, 80)}`).not.toMatch(/:disabled/)
      }
      expect(readOnly.length).toBeGreaterThanOrEqual(0)
    })
  }
})

describe('MOBILE-32 · 403 只保留兜底', () => {
  it('request.ts 的统一 403 处理仍在（不得删掉兜底）', () => {
    const src = read('src/api/request.ts')
    expect(src).toMatch(/statusCode === 403/)
    expect(src).toMatch(/权限不足/)
  })
})

describe('MOBILE-32F3 · 历史 BLOCKED 页面已解除（矩阵无空缺，且不得回落黑洞）', () => {
  for (const [page, note] of Object.entries(UNBLOCKED_PAGES)) {
    it(`${page} 已从 BLOCKED 转为已接线（理由可核对）`, () => {
      expect(note).toMatch(/^UNBLOCKED（MOBILE-32F3）/)
      // 解除登记的前提：该页**确实已接线**（防"从 WIRED 删掉又不接线"的黑洞）
      const src = read(page)
      expect(src, `${page} 应含 buttonGate 声明`).toMatch(/const\s+gate\w+\s*=\s*buttonGate\(/)
      expect(Object.keys(WIRED), `${page} 必须在 WIRED 名单内`).toContain(page)
    })
  }

  it('已解除登记的页面不得同时留在任何 BLOCKED 名单里（防止双账）', () => {
    // 本文件已无 BLOCKED_PAGES 名单（expenses 由 MOBILE-32F3 解除）⇒ 断言名单不存在且各页在 WIRED
    for (const p of Object.keys(UNBLOCKED_PAGES)) expect(Object.keys(WIRED), `${p} 应已在 WIRED`).toContain(p)
  })

  it('manifest 每个 page 域都有审计条目（卡§五.1 不得漏项）', () => {
    const mf = JSON.parse(read('scripts/button-gate-manifest.json'))
    for (const pg of mf.pages) {
      const es = mf.entries.filter((e: any) => e.page === pg.id)
      expect(es.length, `${pg.id} 无任何审计条目`).toBeGreaterThan(0)
      // 每页至少覆盖一个写状态（GATED / BLOCKED_BACKEND_CODE），或（纯读页）UI_ONLY 与 READ_ONLY 双标注。
      // MOBILE-32F4：member-home / member-list 无服务端写调用 ⇒ 走后一分支（两态齐备才允许无写条目）。
      const kinds = new Set(es.map((e: any) => e.status))
      const hasWrite = [...kinds].some((k) => k === 'GATED' || k === 'BLOCKED_BACKEND_CODE')
      const fullyMarkedReadonly = [...kinds].some((k) => k === 'UI_ONLY') && [...kinds].some((k) => k === 'READ_ONLY')
      expect(hasWrite || fullyMarkedReadonly, `${pg.id} 既无写状态登记也未把非写动作标全（卡§五.1）`).toBe(true)
      expect([...kinds].some((k) => k === 'UI_ONLY' || k === 'READ_ONLY'), `${pg.id} 未标注非写动作（卡§五.1）`).toBe(true)
    }
  })
})

describe('MOBILE-32F3 · 后端实证码机检（codeProof 行号必须与后端实文一致）', () => {
  const mf = JSON.parse(read('scripts/button-gate-manifest.json'))
  const GATED = mf.entries.filter((e: any) => e.status === 'GATED')

  it('每条 GATED 都带 codeProof，且内含 routes.ts:行 与码字面量', () => {
    expect(GATED.length).toBeGreaterThanOrEqual(22)
    for (const e of GATED) {
      expect(e.codeProof, `${e.id} 缺 codeProof`).toBeTruthy()
      expect(String(e.codeProof)).toMatch(/[\w.-]+\.routes\.ts:\d+/)
      for (const c of e.permissionCodes || []) {
        const ok = String(e.codeProof).includes(`requirePermission("${c}")`) || String(e.codeProof).includes(c)
        expect(ok, `${e.id} codeProof 未体现其码 ${c}`).toBe(true)
      }
    }
  })

  it('F3 三页每条 GATED 的码为该端点自己的后端实证码（禁止懒绑/跨页错绑）', () => {
    const byPage: Record<string, string[]> = {
      expenses: ['finance:create'],            // expense.routes.ts:19/20
      receipts: ['finance:receipt:create'],    // receipt.routes.ts:23
      reconciliation: ['report:finance'],      // reconciliation.routes.ts:14/17
    }
    const foreign = ['sale:create', 'goods:create', 'goods:edit', 'finance:payment', 'inventory:inbound', 'store:transfer']
    for (const [pg, own] of Object.entries(byPage)) {
      const es = GATED.filter((e: any) => e.page === pg)
      expect(es.length, `${pg} 应至少 1 条 GATED`).toBeGreaterThan(0)
      for (const e of es) {
        expect(e.permissionCodes.length, `${e.id} 应恰好一条实证码`).toBe(1)
        expect(own, `${e.id} 的码 ${e.permissionCodes[0]} 不属 ${pg} 的后端实证集`).toContain(e.permissionCodes[0])
        // 卡§五.2 反测：不得把本页动作绑到其它域/其它页的宽泛码上
        for (const f of foreign) expect(e.permissionCodes, `${e.id} 懒绑了跨域码 ${f}`).not.toContain(f)
        for (const other of Object.entries(byPage).filter(([k]) => k !== pg)) {
          for (const c of other[1]) expect(e.permissionCodes, `${e.id} 错绑了 ${other[0]} 页的码 ${c}`).not.toContain(c)
        }
      }
    }
  })

  it('BLOCKED_BACKEND_CODE 必须零已批准写尝试且不携带任何码', () => {
    const blocked = mf.entries.filter((e: any) => e.status === 'BLOCKED_BACKEND_CODE')
    // MOBILE-32F4：F2 的 2 条（create-sale）之外新增会员三页 6 条（member-detail）
    expect(blocked.length).toBe(8)
    for (const e of blocked) {
      expect(e.approvedWriteAttempts, `${e.id} 必须 approvedWriteAttempts=0`).toBe(0)
      expect(e.countedAsCompleted).toBe(false)
      expect(e.permissionCodes).toEqual([])
      // gateVar 保留"变量名"以说明它对应哪个按钮；F2 两动作源码声明为 null（不得赋 buttonGate 码）
      expect(typeof e.gateVar, `${e.id} 应保留 gateVar 名指向空实现`).toBe('string')
      if (e.page === 'create-sale') {
        const src = read('src/pages/sales/create-sale.vue')
        expect(src, `${e.id} 的 ${e.gateVar} 必须声明为 null（不自绑、不伪造）`).toMatch(new RegExp(`const\\s+${e.gateVar}\\s*=\\s*null\\b`))
      }
    }
  })
})

describe('MOBILE-32F4 · 会员三页（后端全无码 ⇒ 全 BLOCKED，如实登记不伪造）', () => {
  const mf = JSON.parse(read('scripts/button-gate-manifest.json'))
  const PAGES = ['member-home', 'member-list', 'member-detail']

  it('三页均在 manifest 登记，写条目恰 6 条且全部 BLOCKED_BACKEND_CODE（后端无码禁止标 GATED）', () => {
    for (const pid of PAGES) expect(mf.pages.find((p: any) => p.id === pid), `${pid} 缺 page 域`).toBeTruthy()
    const writes = mf.entries.filter((e: any) => e.page === 'member-detail' && ['GATED', 'BLOCKED_BACKEND_CODE'].includes(e.status))
    expect(writes.length, 'member-detail 写条目应为 6（6 调用点 / 5 端点，PUT 由保存与状态开关共享）').toBe(6)
    for (const e of writes) expect(e.status, `${e.id} 后端无实证码，不得标 GATED`).toBe('BLOCKED_BACKEND_CODE')
  })

  it('写条目端点集合 == 源码真实写端点集合（5 个去重端点，双向覆盖）', () => {
    const src = read('src/pages-sub/marketing/member/member-detail.vue')
    // 源码 6 个写调用点：POST×4 + PUT×2（直接 import { put, post } from '@/api/request'）
    expect(src.match(/await post\(/g)?.length, 'POST 调用点应为 4').toBe(4)
    expect(src.match(/await put\(/g)?.length, 'PUT 调用点应为 2').toBe(2)
    const endpoints = [
      '/store/members/manage',
      '/store/members/${memberId.value}',
      '/admin/store-value-cards/${card.cardNo}/recharge',
      '/admin/store-value-cards',
      '/admin/members/${memberId.value}/points/adjust',
    ]
    for (const ep of endpoints) expect(src, `源码缺写调用 ${ep}`).toContain(ep)
    const man = mf.entries
      .filter((e: any) => e.page === 'member-detail' && ['GATED', 'BLOCKED_BACKEND_CODE'].includes(e.status))
      .map((e: any) => `${e.method} ${e.endpoint}`.replace(/\{[^}]*\}/g, '*'))
    expect(new Set(man).size, 'manifest 去重端点应为 5').toBe(5)
    for (const ep of ['/store/members/*', '/admin/store-value-cards/*/recharge', '/admin/store-value-cards', '/admin/members/*/points/adjust']) {
      expect(man.some((x: string) => x === ep || x.split(' ')[1] === ep), `manifest 缺端点 ${ep}`).toBe(true)
    }
  })

  it('6 条 BLOCKED 条目逐条 countedAsCompleted=false + approvedWriteAttempts=0 + codeProof 带行号', () => {
    const writes = mf.entries.filter((e: any) => e.page === 'member-detail' && e.status === 'BLOCKED_BACKEND_CODE')
    for (const e of writes) {
      expect(e.countedAsCompleted, `${e.id} 不得计入完成`).toBe(false)
      expect(e.approvedWriteAttempts, `${e.id} 零已批准写尝试`).toBe(0)
      expect(e.permissionCodes, `${e.id} 禁止伪造码`).toEqual([])
      expect(String(e.codeProof), `${e.id} 须带 routes.ts:行`).toMatch(/[\w.-]+\.routes\.ts:\d+/)
    }
  })

  it('codeProof 行号与后端实文一致：所指行确为该端点注册行且无 requirePermission', () => {
    const beProof: Array<[string, number, string]> = [
      ['../backend/src/routes/store.routes.ts', 44, 'storeMemberRouter.post("/manage"'],
      ['../backend/src/routes/store.routes.ts', 45, 'storeMemberRouter.put("/:id'],
      ['../backend/src/routes/store-value-card.routes.ts', 9, 'storeValueCardRouter.post("/"'],
      ['../backend/src/routes/store-value-card.routes.ts', 11, 'storeValueCardRouter.post("/:cardNo/recharge"'],
      ['../backend/src/routes/points.routes.ts', 14, 'pointsRouter.post("/:id/points/adjust"'],
    ]
    for (const [file, ln, frag] of beProof) {
      const row = read(file).split(/\r?\n/)[ln - 1] ?? ''
      expect(row, `${file}:${ln} 应为 ${frag} 的注册行`).toContain(frag)
      expect(row, `${file}:${ln} 不得出现 requirePermission（后端未立码）`).not.toContain('requirePermission')
    }
  })

  it('会员中心 / 会员列表两页无服务端写调用（不引 put/post/del/patch）', () => {
    for (const f of ['src/pages-sub/marketing/member/member.vue', 'src/pages-sub/marketing/member/member-list.vue']) {
      const src = read(f)
      expect(src, `${f} 不得从请求层引入写动词`).not.toMatch(/import\s*\{[^}]*(put|post|del|patch)[^}]*}\s*from\s*'@\/api\/request'/)
      expect(src, `${f} 不得出现非 GET 模块调用`).not.toMatch(/(put|del|patch)\s*\(\s*[`'"]\//)
    }
    const mfList = JSON.parse(read('scripts/button-gate-manifest.json'))
    for (const pid of ['member-home', 'member-list']) {
      const es = mfList.entries.filter((e: any) => e.page === pid)
      expect(es.length, `${pid} 应有审计条目`).toBeGreaterThanOrEqual(2)
      for (const e of es) {
        if (e.method) expect(e.method, `${e.id} 非写页只允许 GET 或无 method`).toBe('GET')
      }
    }
  })

  it('列表「新增」为导航（openNew → member-detail?new=1），写动作归属详情页 saveEdit', () => {
    const list = read('src/pages-sub/marketing/member/member-list.vue')
    expect(list).toContain(`/pages-sub/marketing/member/member-detail?new=1`)
    const detail = read('src/pages-sub/marketing/member/member-detail.vue')
    expect(detail).toMatch(/async function saveEdit\(\)/)
    expect(detail).toContain(`post('/store/members/manage'`)
    // 调整积分按钮保持 B3-1 入口门原文（pending-code ⇒ 恒隐藏），不得改为放行
    expect(detail).toContain(`v-if="canEntry(`)
  })

  it('会员三页不得出现假按钮门（无码页面禁止 const gateXxx = buttonGate(...)）', () => {
    for (const f of ['member.vue', 'member-list.vue', 'member-detail.vue']) {
      const src = read(`src/pages-sub/marketing/member/${f}`)
      expect(src, `${f} 出现 buttonGate 绑定（后端无码 ⇒ 伪造门）`).not.toMatch(/const\s+gate\w+\s*=\s*buttonGate\(/)
    }
  })
})

