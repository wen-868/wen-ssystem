import { readFileSync, writeFileSync } from 'node:fs'

const AM = 'D:/Users/ZXQL/wt-agents/MOBILE-32/app-mobile'

/**
 * MOBILE-32 · 页面按钮级门批量接线（**只做机械插入，码来自后端实证**）
 *
 * 每条的 `code` 均取自对应后端路由文件的 `requirePermission(...)` 实文（见 raw/03 + 手工查证更正）：
 *  · expenses / expense-create / expense-detail ⇒ expense.routes.ts 的 finance:create
 *  · receipts ⇒ receipt.routes.ts 的 finance:receipt:create（作废动作）
 *  · statements ⇒ customer-statement.routes.ts 的 customer:statement（确认动作）
 *  · activities ⇒ admin-marketing-full-reduction.routes.ts 的 marketing:create
 *  · member-levels ⇒ points.routes.ts 的 customer:level（S3-231 F1 裁定；非 member-level.routes.ts）
 *
 * 只插入：① import buttonGate 解构；② gateXxx 常量；③ 模板按钮 :disabled + 短路调用。
 * **不改**任何 handler 内部逻辑、不改只读按钮、不改业务字段。
 */
const TASKS = [
  {
    page: 'src/pages-sub/finance/finance/expenses.vue',
    code: 'finance:create',
    edits: [
      {
        from: '<text class="load-more-text" v-else @tap="loadMore">点击加载更多</text>',
        to: '<text class="load-more-text" v-else @tap="loadMore">点击加载更多</text>\n    <!-- MOBILE-32：只读（加载更多）不受写码影响，保持可点 -->',
      },
    ],
    gateName: 'gateExpenseCreate',
    anchorDecl: 'const searchForm',
  },
  {
    page: 'src/pages-sub/finance/receipts/receipts.vue',
    code: 'finance:receipt:create',
    gateName: 'gateReceiptVoid',
    anchorDecl: 'const searchForm',
    buttonFrom: '<button class="action-btn void-btn" @tap="voidReceipt(item)">作废</button>',
    buttonTo: '<button class="action-btn void-btn" :disabled="!gateReceiptVoid.enabled" @tap="gateReceiptVoid.enabled && voidReceipt(item)">作废</button>',
  },
  {
    page: 'src/pages-sub/finance/statements/statements.vue',
    code: 'customer:statement',
    gateName: 'gateStatementConfirm',
    anchorDecl: 'const searchForm',
    buttonFrom: '<button class="action-btn confirm-btn" @tap="confirmStatement(item)">确认</button>',
    buttonTo: '<button class="action-btn confirm-btn" :disabled="!gateStatementConfirm.enabled" @tap="gateStatementConfirm.enabled && confirmStatement(item)">确认</button>',
  },
]

const IMPORT_LINE = "import { usePermissionGate } from '@/composables/usePermissionGate'"

const results = []
for (const t of TASKS) {
  const p = `${AM}/${t.page}`
  let src = readFileSync(p, 'utf8')
  const before = src
  const log = []

  // 1) import（插到 <script setup> 后第一处 import 之前；已有则跳过）
  if (!src.includes(IMPORT_LINE)) {
    const idx = src.indexOf('<script setup')
    const insertAt = src.indexOf('import ', idx)
    if (insertAt < 0) { results.push({ page: t.page, ok: false, why: 'no import anchor' }); continue }
    src = src.slice(0, insertAt) + `// MOBILE-32：按钮级权限预判（码来源见回传卡矩阵）\n${IMPORT_LINE}\n` + src.slice(insertAt)
    log.push('import+')
  }

  // 2) gate 声明（插到 anchorDecl 所在行的下一个空行前）
  if (!src.includes(`const ${t.gateName}`)) {
    const anchor = src.indexOf(t.anchorDecl)
    if (anchor < 0) { results.push({ page: t.page, ok: false, why: `no decl anchor ${t.anchorDecl}` }); continue }
    const lineEnd = src.indexOf('\n', anchor)
    const decl = `\n// MOBILE-32：该页写动作的按钮级门（码=${t.code}，逐按钮各自判定）\nconst { buttonGate } = usePermissionGate()\nconst ${t.gateName} = buttonGate(['${t.code}'])\n`
    src = src.slice(0, lineEnd + 1) + decl + src.slice(lineEnd + 1)
    log.push('gateDecl+')
  }

  // 3) 按钮绑定
  if (t.buttonFrom && src.includes(t.buttonFrom) && !src.includes(t.buttonTo)) {
    src = src.replace(t.buttonFrom, t.buttonTo)
    log.push('button+')
  }

  // 4) 额外文本改动（可选）
  for (const e of t.edits || []) {
    if (src.includes(e.from) && !src.includes(e.to)) { src = src.replace(e.from, e.to); log.push('text+') }
  }

  if (src !== before) writeFileSync(p, src, 'utf8')
  results.push({ page: t.page, ok: src !== before, changes: log })
}

for (const r of results) console.log(`${r.ok ? '✓' : '·'} ${r.page}  ${(r.changes || []).join(' ') || r.why || '（无需改动）'}`)
