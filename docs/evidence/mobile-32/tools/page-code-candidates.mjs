import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const AM = 'D:/Users/ZXQL/wt-agents/MOBILE-32/app-mobile'
const BK = 'D:/Users/ZXQL/wt-agents/MOBILE-32/backend/src/routes'

/** 页面 → 其后端路由文件（用于取真实码；映射依据 = API 模块名与路由文件名同族） */
const PAGE_ROUTE = {
  'pages-sub/finance/transfer/transfer.vue': ['transfer.routes.ts'],
  'pages-sub/finance/transfer/create.vue': ['transfer.routes.ts'],
  'pages-sub/finance/finance/expenses.vue': ['expense.routes.ts'],
  'pages-sub/finance/finance/expense-create.vue': ['expense.routes.ts'],
  'pages-sub/finance/finance/expense-detail.vue': ['expense.routes.ts'],
  'pages-sub/finance/receipts/receipts.vue': ['receipt.routes.ts'],
  'pages-sub/finance/statements/statements.vue': ['customer-statement.routes.ts'],
  'pages-sub/finance/reconciliation/reconciliation.vue': ['reconciliation.routes.ts'],
  'pages-sub/marketing/member-levels/member-levels.vue': ['member-level.routes.ts', 'customer-level.routes.ts'],
  'pages-sub/marketing/member-levels/level-config.vue': ['member-level.routes.ts', 'customer-level.routes.ts'],
  'pages-sub/marketing/marketing/activities.vue': ['admin-marketing-full-reduction.routes.ts'],
  'pages-sub/marketing/marketing/coupons.vue': ['admin-marketing-coupon.routes.ts'],
  'pages-sub/marketing/marketing/create-coupon.vue': ['admin-marketing-coupon.routes.ts'],
  'pages-sub/product/batch-price/batch-price.vue': ['admin-product.routes.ts'],
  'pages-products-placeholder': [],
}

function codesOfRouteFiles(names) {
  const out = new Map() // 码 → 出现次数
  for (const n of names) {
    const p = join(BK, n)
    let txt = ''
    try { txt = readFileSync(p, 'utf8') } catch { continue }
    for (const m of txt.matchAll(/requirePermission\(\s*['"]([a-z][a-z:*]+)['"]/g)) {
      out.set(m[1], (out.get(m[1]) || 0) + 1)
    }
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ code: c, n }))
}

const report = []
for (const [page, routes] of Object.entries(PAGE_ROUTE)) {
  if (!routes.length) continue
  report.push({ page, routes, codes: codesOfRouteFiles(routes) })
}

const lines = []
for (const r of report) {
  lines.push(`### ${r.page}`)
  lines.push(`路由文件：${r.routes.join(', ')}`)
  lines.push(`候选码：${r.codes.map((c) => `${c.code}(${c.n})`).join('  ') || '（该路由文件无 requirePermission ⇒ BLOCKED）'}`)
  lines.push('')
}
writeFileSync('D:/Users/ZXQL/wt-agents/MOBILE-32/docs/evidence/mobile-32/raw/03-page-code-candidates.txt', lines.join('\n'), 'utf8')
console.log(lines.join('\n'))
