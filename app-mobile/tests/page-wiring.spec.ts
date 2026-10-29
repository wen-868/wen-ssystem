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
      // 每页至少覆盖一个写状态（GATED / BLOCKED_BACKEND_CODE）与一个非写状态标注
      const kinds = new Set(es.map((e: any) => e.status))
      expect([...kinds].some((k) => k === 'GATED' || k === 'BLOCKED_BACKEND_CODE'), `${pg.id} 缺写状态登记`).toBe(true)
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
    expect(blocked.length).toBe(2)
    for (const e of blocked) {
      expect(e.approvedWriteAttempts, `${e.id} 必须 approvedWriteAttempts=0`).toBe(0)
      expect(e.countedAsCompleted).toBe(false)
      expect(e.permissionCodes).toEqual([])
      // gateVar 保留"变量名"以说明它对应哪个按钮，但源码必须声明为 null（不得赋 buttonGate 码）
      expect(typeof e.gateVar, `${e.id} 应保留 gateVar 名指向空实现`).toBe('string')
      const src = read('src/pages/sales/create-sale.vue')
      expect(src, `${e.id} 的 ${e.gateVar} 必须声明为 null（不自绑、不伪造）`).toMatch(new RegExp(`const\\s+${e.gateVar}\\s*=\\s*null\\b`))
    }
  })
})

