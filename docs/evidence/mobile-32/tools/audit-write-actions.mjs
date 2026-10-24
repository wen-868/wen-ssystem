#!/usr/bin/env node
/**
 * MOBILE-32 · 写动作权限矩阵审计器
 *
 * 目的（卡 §三.1"先审计后改"）：把移动端**所有写动作按钮**逐条登记为矩阵行，判定其
 *   现有门覆盖状态，产出可复跑、可核对的数据（不靠肉眼清点）。
 *
 * 判定口径：
 *   - 页面 `<template>` 内的写动作按钮：`@tap` / `@click` 绑定，且 handler 名或按钮文案
 *     属于写语义集合（提交/保存/创建/删除/编辑/审核/驳回/取消/作废/入库/出库/调拨/
 *     收款/退款/确认收货/发货/接单/下架…），或可见兄弟节点带 `v-if="canEntry(`；
 *   - `GATED`：同一元素或其直接父容器上有 `canEntry(...)` / `can([...])` / `v-if="canXxx"`；
 *   - `UNGATED`：无本地门 ⇒ 待修；
 *   - `READONLY`：只读语义（查询/筛选/切换 tab/跳详情/导出）⇒ 不在本单范围，且不得被误禁用。
 *
 * 用法：
 *   node docs/evidence/mobile-32/tools/audit-write-actions.mjs           # 人读矩阵
 *   node docs/evidence/mobile-32/tools/audit-write-actions.mjs --json    # 机读
 * 退出码：恒 0（审计器只报告，不做门禁阻断）
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// tools/ → mobile-32/ → evidence/ → docs/ → 工作树根 → app-mobile
const APP = join(HERE, '../../../../app-mobile')
const SRC = join(APP, 'src')

/** 写语义关键词（handler 名 + 按钮文案）——**只收录会产生写请求的动词语义** */
const WRITE_WORDS = [
  'submit', 'save', 'create', 'delete', 'remove', 'edit', 'update', 'modify',
  'approve', 'reject', 'cancel', 'void', 'revoke', 'inbound', 'outbound',
  'transfer', 'ship', 'deliver', 'receive', 'collect', 'refund', 'settle',
  'enable', 'disable', 'toggle', 'complete', 'start',
  '提交', '保存', '新增', '添加商品', '删除', '编辑', '审核', '驳回', '取消单据',
  '作废', '入库', '出库', '调拨', '收款', '退款', '发货', '收货', '接单', '下架',
  '上架', '盘点', '结算', '启用', '停用', '生成', '导入', '上传', '修改', '改价',
]

/** 只读 / 导航 / UI / 认证语义（明确排除，防止被误判为写；也不得被误禁用） */
const READONLY_WORDS = [
  'search', 'query', 'filter', 'reset', 'switch', 'tab', 'clear', 'go', 'jump',
  'detail', 'view', 'preview', 'export', 'loadmore', 'retry', 'refresh', 'close',
  'drop', 'select', 'channel', 'open', 'show', 'hide', 'reload', 'logout', 'login',
  'register', 'mfa', 'demo', 'send', 'link', 'scan', 'period', 'date',
  '搜索', '查询', '筛选', '重置', '切换', '清空', '详情', '预览', '导出', '刷新',
  '重试', '关闭', '取消编辑', '选择', '展开', '收起', '登录', '注册', '退出',
]

/**
 * 整页排除（卡 §四 红线：不得改登录注册页；且这些页面的"写"是认证动作，
 * 不属于商户业务写端点，无业务权限码可判）：
 *  · pages/login/login.vue、pages/register/register.vue —— 登录/注册/找回
 *  · pages/profile/change-password.vue —— 账号自助改密（自服务，非业务写）
 *  · components/** —— 组件库（写动作归属其宿主页面，不重复登记）
 */
const EXCLUDED_PAGE_RE = [
  /pages\/login\/login\.vue$/,
  /pages\/register\/register\.vue$/,
  /pages\/profile\/change-password\.vue$/,
  /^components\//,
]

const lower = (s) => (s || '').toLowerCase()

function classify(handler, text) {
  const h = lower(handler)
  const t = String(text || '')
  const isRead = READONLY_WORDS.some((w) => h.includes(lower(w)) || t.includes(w))
  const isWrite = WRITE_WORDS.some((w) => h.includes(lower(w)) || t.includes(w))
  if (isRead && !isWrite) return 'READONLY'
  if (isWrite) return 'WRITE'
  return 'OTHER'
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (p.endsWith('.vue')) out.push(p)
  }
  return out
}

/** 取 <template> 区段（含起止行号），后续行号以此为基准 */
function templateOf(raw) {
  const start = raw.indexOf('<template>')
  const end = raw.lastIndexOf('</template>')
  if (start < 0 || end < 0) return null
  const before = raw.slice(0, start)
  const startLine = before.split(/\r?\n/).length
  return { text: raw.slice(start + '<template>'.length, end), startLine }
}

const TAG_RE = /<(button|view|text|image|uni-button)\b([^>]*)>/g

export function audit() {
  const rows = []
  for (const file of walk(SRC)) {
    const raw = readFileSync(file, 'utf8')
    const tpl = templateOf(raw)
    if (!tpl) continue
    const rel = relative(SRC, file).replace(/\\/g, '/')

    // 整页排除（登录/注册/自助改密/组件库；见 EXCLUDED_PAGE_RE 注释）
    if (EXCLUDED_PAGE_RE.some((re) => re.test(rel))) continue

    // 整页级：是否存在 canEntry / can( 引用
    const pageHasGate = /canEntry\(|can\(\[|can\(['"]/.test(raw)
    const gateIds = [...raw.matchAll(/canEntry\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
    const canCodes = [...raw.matchAll(/can\(\s*\[\s*([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]))

    let m
    while ((m = TAG_RE.exec(tpl.text))) {
      const attrs = m[2] || ''
      const tap = attrs.match(/@(tap|click)="\s*([^"]*)"/)
      if (!tap) continue
      const handler = tap[2].split(/[;(]/)[0].trim()
      // 忽略纯赋值 / 内联表达式
      if (!handler || handler.includes('=') || handler.startsWith('$')) continue

      // 只取紧跟在标签后的文本作为按钮文案
      const tail = tpl.text.slice(m.index + m[0].length, m.index + m[0].length + 80)
      const text = (tail.match(/^([^<]{1,40})/) || [, ''])[1].trim()

      const kind = classify(handler, text)
      if (kind !== 'WRITE') continue

      // 取该元素自身 attrs + 向上 600 字符窗口（覆盖 v-for 兄弟容器上的门）
      const lineNo = tpl.startLine + tpl.text.slice(0, m.index).split(/\r?\n/).length - 1
      const windowStart = Math.max(0, m.index - 600)
      const window = tpl.text.slice(windowStart, m.index + m[0].length)
      const selfGate = /canEntry\(|can\(\[|can\(['"]/.test(attrs)
      const windowGate = /canEntry\(|can\(\[|can\(['"]/.test(window)
      const guarded = selfGate || windowGate

      rows.push({
        page: rel,
        line: lineNo,
        element: m[1],
        handler,
        text: text.slice(0, 40),
        guarded,
        pageHasGate,
        gateIds,
        canCodes: canCodes.length ? canCodes : undefined,
      })
    }
  }
  return rows
}

function main() {
  const rows = audit()
  const write = rows
  const unguarded = write.filter((r) => !r.guarded)
  const pages = [...new Set(write.map((r) => r.page))]
  const unguardedPages = [...new Set(unguarded.map((r) => r.page))]

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ total: write.length, unguarded: unguarded.length, rows: write }, null, 2))
    return
  }

  console.log(`写动作按钮总计 = ${write.length}（分布 ${pages.length} 个页面）`)
  console.log(`已覆盖（GATED）   = ${write.length - unguarded.length}`)
  console.log(`待修（UNGATED）   = ${unguarded.length}（分布 ${unguardedPages.length} 个页面）`)
  console.log('')
  console.log('--- 待修页面清单（按未门控数量降序）---')
  const byPage = new Map()
  for (const r of unguarded) byPage.set(r.page, (byPage.get(r.page) || 0) + 1)
  for (const [p, n] of [...byPage.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(2)}  ${p}`)
  }
}

const selfPath = resolve(fileURLToPath(import.meta.url))
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === selfPath) main()
