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
 * **BLOCKED 登记**（卡 §三.1「每项都有权限码、BLOCKED 理由或已覆盖证据」）。
 *
 * `expenses.vue`：接线实现（`finance:create` 取自 `expense.routes.ts` 实文）已完成并被
 * mutation M1 验证有效，但该文件**整文件模板缩进为 2 空格**，而仓内 lint 规则
 * `vue/html-indent: ['warn', 4]` 期望 4 空格 ⇒ 任何新增 DOM 行都必然 +N warning，
 * 与 `check:gates` 的「warning 不劣化」冻结基线冲突。
 * 实测证据：`docs/evidence/mobile-32/raw/32-indent-debt-proof.txt`（单行实验：+1 行 ⇒ +1 warning）。
 * 处置：**回退该页**（保持文件零改动），登记为本单 BLOCKED，待「移动端模板缩进归一」立单后接线；
 * 不得为接一页而改写整文件缩进（违反「禁止顺手重构/扩大改动面」）。
 */
const BLOCKED_PAGES: Record<string, string> = {
  'src/pages-sub/finance/finance/expenses.vue':
    'BLOCKED：整文件 2 空格缩进 vs lint 期望 4 空格 ⇒ 新增行必然 +warning，与 warning 冻结基线冲突；待缩进归一单后接线',
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
      const taps = [...src.matchAll(/@tap="([^"]*)"/g)].map((m) => m[1])
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

describe('MOBILE-32 · BLOCKED 页面登记（矩阵无空缺）', () => {
  for (const [page, reason] of Object.entries(BLOCKED_PAGES)) {
    it(`${page} 已显式登记 BLOCKED 且理由可核对`, () => {
      expect(reason).toMatch(/^BLOCKED/)
      // 被登记为 BLOCKED 的页面必须**确实尚未接线**（防止"登记了但其实改了"的假账）
      const src = read(page)
      expect(src).not.toMatch(/buttonGate\(/)
    })
  }

  it('BLOCKED 页面不得与 WIRED 页面重叠（同一页不能既已接线又标 BLOCKED）', () => {
    for (const p of Object.keys(BLOCKED_PAGES)) {
      expect(Object.keys(WIRED)).not.toContain(p)
    }
  })
})
