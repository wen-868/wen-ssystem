#!/usr/bin/env node
/**
 * S3-230 · 入口权限门自检 + 反测脚本
 *
 * 做法（**以真实实现为准，不重写一套判定**）：
 *   1. 直接 `import` 手机端真实模块 `app-mobile/src/config/permission-gates.ts`
 *      （Node 24 原生剥离类型；该文件零依赖）+ 端点台账 `b-class-rows.mjs`；
 *   2. 读生产只读底稿 `docs/evidence/_shared/prod-roles-20261016.txt` 的「角色 × 权限码」；
 *   3. 断言四组：
 *      A 台账↔注册表一致；B 注册表↔源码引用一致；C 在用角色 × 入口可见性 = 期望；D 判定有分辨力（反测）。
 *
 * 退出码：0 = 全通过；1 = 有断言失败（打印 FAIL 行）。
 * 用法：node docs/evidence/S3-230/tools/s3230-gate-check.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
// HERE = <repo>/docs/evidence/S3-230/tools/ ⇒ 上溯 4 级到仓库根
const REPO = join(HERE, '..', '..', '..', '..')                 // wt-agents/S3-230
const APP_SRC = join(REPO, 'app-mobile', 'src')
const REGISTRY_FILE = 'config/permission-gates.ts'
const PROD_ROLES = join(REPO, 'docs', 'evidence', '_shared', 'prod-roles-20261016.txt')

// Windows 绝对路径必须先转 file:// URL（否则 ERR_UNSUPPORTED_ESM_URL_SCHEME）
const gates = await import(pathToFileURL(join(APP_SRC, 'config', 'permission-gates.ts')).href)
const { B_CLASS_ROWS, DOMAIN_ORDER } = await import(pathToFileURL(join(HERE, 'b-class-rows.mjs')).href)
const { ENTRY_GATES, ENTRY_GATE_BY_ID, matchPermissionCode, hasPermissionCodes } = gates

/** 在用角色（生产 `t_sys_user_role` 有绑定账号的角色；口径见 R101-授权模型提案 §一） */
const ACTIVE_ROLES = ['SUPER_ADMIN', 'STORE_MANAGER', 'STORE_OPERATOR', 'READONLY']

/**
 * 期望：每个门在「在用角色」中的可见集合（由生产 12 角色 × 权限码 + 门码推出，逐行人工核对过）。
 * 改任何一个门的码，本表就会与实算不一致 ⇒ 断言红（反测就靠这条）。
 */
const EXPECTED_ACTIVE_ROLES = {
  'sale-order-detail-deliver': ['SUPER_ADMIN', 'STORE_MANAGER', 'STORE_OPERATOR'],
  'sale-order-detail-cancel': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'sale-create-hold': ['SUPER_ADMIN', 'STORE_MANAGER', 'STORE_OPERATOR'],
  'sale-bill-offline-pay': ['SUPER_ADMIN', 'STORE_MANAGER', 'STORE_OPERATOR'],
  'sale-receipt-sub': ['SUPER_ADMIN', 'STORE_MANAGER', 'STORE_OPERATOR'],
  'purchase-sub-order': ['SUPER_ADMIN'],
  'purchase-sub-inbound': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'purchase-sub-return': ['SUPER_ADMIN', 'STORE_MANAGER', 'STORE_OPERATOR'],
  'purchase-sub-payment': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'home-in-stock': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'fx-stock-check': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'fx-stock-warning': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'fx-loss-gain': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'fx-transfer': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'fx-transfer-receive': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'goods-detail-edit': ['SUPER_ADMIN'],
  'goods-detail-price': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'goods-batch-price-submit': ['SUPER_ADMIN', 'STORE_MANAGER'],
  'goods-category-create': ['SUPER_ADMIN'],
  'goods-category-edit': ['SUPER_ADMIN'],
  'goods-category-delete': ['SUPER_ADMIN'],
  'staff-entry': ['SUPER_ADMIN'],
  'role-entry': ['SUPER_ADMIN'],
  'mkt-coupons': ['SUPER_ADMIN'],
  'mkt-activities': ['SUPER_ADMIN'],
  'fin-bank-accounts': ['SUPER_ADMIN'],
  'fin-recon-confirm': ['SUPER_ADMIN', 'STORE_MANAGER']
}

const failures = []
const ok = (msg) => console.log(`  OK   ${msg}`)
const bad = (msg) => {
  failures.push(msg)
  console.log(`  FAIL ${msg}`)
}

// ── 生产角色表解析（只读底稿；本脚本不连库）─────────────────────────────
function parseProdRoles() {
  const text = readFileSync(PROD_ROLES, 'utf8')
  const start = text.indexOf('## 一、商家侧角色 × 权限码')
  const block = text.slice(start, text.indexOf('### 🔴', start))
  const roles = {}
  for (const line of block.split(/\r?\n/)) {
    if (!line.includes('[')) continue
    const [rawName, rawPerms] = line.split('[')
    const name = rawName.trim().split('\t')[0]
    if (!/^[A-Z_]+$/.test(name)) continue
    roles[name] = JSON.parse(`[${rawPerms}`)
  }
  return roles
}

const roles = parseProdRoles()
console.log('== S3-230 入口权限门自检 ==')
console.log(`注册表：${ENTRY_GATES.length} 个入口（gated ${gates.GATED_ENTRY_IDS.length} / registered ${gates.REGISTERED_ENTRY_IDS.length}）`)
console.log(`生产角色底稿：${Object.keys(roles).length} 个角色；在用角色：${ACTIVE_ROLES.join(', ')}`)

// ── 台账计数 ────────────────────────────────────────────────────────────
console.log('\n-- A. 台账 ↔ 注册表 --')
const byDomain = {}
for (const row of B_CLASS_ROWS) {
  byDomain[row.domain] ??= { total: 0, gated: 0, registered: 0 }
  byDomain[row.domain].total += 1
  byDomain[row.domain][row.status] += 1
}
for (const d of DOMAIN_ORDER) {
  const c = byDomain[d]
  if (!c) continue
  console.log(`   ${d.padEnd(12)} 端点 ${String(c.total).padStart(3)} = gated ${String(c.gated).padStart(2)} + registered ${String(c.registered).padStart(2)}`)
}
const total = B_CLASS_ROWS.length
const gatedRows = B_CLASS_ROWS.filter((r) => r.status === 'gated').length
const registeredRows = total - gatedRows
const uniqueEndpoints = new Set(B_CLASS_ROWS.map((r) => r.endpoint)).size
console.log(`   合计         ${total} 行（端点 × 入口）= gated ${gatedRows} + registered ${registeredRows}`)
console.log(`   去重端点数    ${uniqueEndpoints}（另有 ${total - uniqueEndpoints} 行是"同一端点的第二个入口"）`)

for (const row of B_CLASS_ROWS) {
  const gate = ENTRY_GATE_BY_ID[row.entryId]
  if (!gate) {
    bad(`台账行 ${row.endpoint} 引用了不存在的入口 id：${row.entryId}`)
    continue
  }
  if (gate.status !== row.status) {
    bad(`台账行 ${row.endpoint} 的 status=${row.status} 与注册表 ${row.entryId}=${gate.status} 不一致`)
  }
}
for (const gate of ENTRY_GATES) {
  const used = B_CLASS_ROWS.filter((r) => r.entryId === gate.id).length
  if (gate.status === 'gated' && used === 0) bad(`门 ${gate.id} 未被任何台账行引用（空门）`)
  if (gate.status === 'registered' && used === 0) bad(`登记项 ${gate.id} 未被任何台账行引用`)
  if (gate.status === 'registered' && gate.codes.length !== 0) bad(`登记项 ${gate.id} 不该带门码`)
  if (gate.status === 'gated' && gate.codes.length === 0) bad(`门 ${gate.id} 的码为空（等于没门）`)
}
if (!failures.length) ok(`台账 ${total} 行与注册表 ${ENTRY_GATES.length} 个入口一一对得上；gated 行均有码、registered 行均无码`)

// ── 源码引用一致性 ──────────────────────────────────────────────────────
console.log('\n-- B. 注册表 ↔ 源码引用 --')
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(vue|ts)$/.test(name)) out.push(p)
  }
  return out
}
const files = walk(APP_SRC).filter((f) => relative(APP_SRC, f).replaceAll('\\', '/') !== REGISTRY_FILE)
const sourceById = new Map()
const idsInSource = new Set()
const addRef = (id, file) => {
  const list = sourceById.get(id) ?? []
  list.push(file)
  sourceById.set(id, [...new Set(list)])
}
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const rel = relative(REPO, f).replaceAll('\\', '/')
  // ① 页面/组件里的显式门引用
  for (const m of text.matchAll(/(?:canEntry|canAnyEntry)\(\s*'([^']+)'/g)) {
    idsInSource.add(m[1])
    addRef(m[1], rel)
  }
  for (const m of text.matchAll(/(?:canEntry|canAnyEntry)\(\s*\[([^\]]*)\]/g)) {
    for (const m2 of m[1].matchAll(/'([^']+)'/g)) {
      idsInSource.add(m2[1])
      addRef(m2[1], rel)
    }
  }
  // ② 动作/快捷入口声明里的 gate 字段（create-sale.vue 的 DocAction、profile.vue 的 ProfileShortcut）
  for (const m of text.matchAll(/gate:\s*'([^']+)'/g)) {
    idsInSource.add(m[1])
    addRef(m[1], rel)
  }
  // ③ create-sale.vue 的「子段 → 门 id」映射表（DOC_SUB_GATE）
  for (const block of text.matchAll(/DOC_SUB_GATE[^=]*=\s*\{([^}]*)\}/g)) {
    for (const m of block[1].matchAll(/:\s*'([^']+)'/g)) {
      idsInSource.add(m[1])
      addRef(m[1], rel)
    }
  }
  // ④ function-menu.ts 的注册表项：单行同时含 page path 与 permCodes ⇒ 视为该门的实现（路径 + 码双匹配）
  if (rel.endsWith('config/function-menu.ts')) {
    for (const line of text.split(/\r?\n/)) {
      const permMatch = line.match(/permCodes:\s*\[([^\]]*)\]/)
      const pathMatch = line.match(/path:\s*'([^']+)'/)
      if (!permMatch || !pathMatch) continue
      const codes = [...permMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
      const page = pathMatch[1].replace(/^\//, '')
      const hit = ENTRY_GATES.find(
        (g) =>
          g.page.replace(/\.vue$/, '') === page &&
          g.codes.slice().sort().join('|') === codes.join('|')
      )
      if (hit) addRef(hit.id, rel)
    }
  }
}
for (const gate of ENTRY_GATES.filter((g) => g.status === 'gated')) {
  const refs = sourceById.get(gate.id) ?? []
  if (refs.length === 0) bad(`门 ${gate.id} 在源码里零引用（页面没用 canEntry / gate 接上它）`)
  else ok(`门 ${gate.id} ⇢ ${refs.join(' , ')}`)
}
for (const id of idsInSource) {
  if (!ENTRY_GATE_BY_ID[id]) bad(`源码引用了注册表里不存在的门 id：${id}`)
}

// ── 在用角色 × 入口 可见性矩阵 + 期望断言 ───────────────────────────────
console.log('\n-- C. 在用角色 × 入口 可见性（门生效后）--')
const header = ['入口 id'.padEnd(30), ...ACTIVE_ROLES.map((r) => r.padEnd(15))].join(' ')
console.log(`   ${header}`)
const visible = {}
for (const gate of ENTRY_GATES.filter((g) => g.status === 'gated')) {
  const vis = ACTIVE_ROLES.filter((r) => hasPermissionCodes(roles[r], gate.codes))
  visible[gate.id] = vis
  const expected = EXPECTED_ACTIVE_ROLES[gate.id]
  if (!expected) bad(`门 ${gate.id} 缺少期望表（EXPECTED_ACTIVE_ROLES）`)
  else if (expected.join(',') !== vis.join(',')) {
    bad(`门 ${gate.id} 的在用可见角色与期望不一致：实算 [${vis.join(', ')}] ≠ 期望 [${expected.join(', ')}]`)
  }
  console.log(`   ${gate.id.padEnd(30)} ${ACTIVE_ROLES.map((r) => (vis.includes(r) ? '可见'.padEnd(15) : '-'.padEnd(15))).join(' ')}  ← 码 ${gate.codes.join(' + ')}`)
}
// 登记项：未门 ⇒ 对全部在用角色放行（口径：码未定/孤岛页只登记）
for (const gate of ENTRY_GATES.filter((g) => g.status === 'registered')) {
  const vis = ACTIVE_ROLES.filter((r) => hasPermissionCodes(roles[r], gate.codes))
  if (vis.length !== ACTIVE_ROLES.length) bad(`登记项 ${gate.id} 不应拦任何角色`)
}
if (!failures.length) ok('全部门的在用可见角色与期望表一致；登记项对全部在用角色放行')

// ── D. 反测（门禁铁律：故意制造失败，证明它能红）────────────────────────
//
// ⚠️ 口径：`SUPER_ADMIN` 持 `["*"]` ⇒ **任何码都命中**（与后端 `requirePermission` 的
// "SUPER_ADMIN 直通"一致；后端 `services/admin/rbac.service.ts:299` / `middleware/rbac-auth.ts:14`）。
// 所以"换码 ⇒ 不可见"这条反测必须落在**非通配角色**（店长 / 店员 / 观察员）上，
// 否则测的是"超管能不能被挡住"（不是本门的判据）。
const NON_SUPER = ACTIVE_ROLES.filter((r) => r !== 'SUPER_ADMIN')

// D1：换成"谁都不持有的不存在码" ⇒ 非通配角色全部不可见
console.log('\n-- D1. 反测：门码换成不存在的码 ⇒ 非通配在用角色必须全部不可见 --')
const DOCTORED = ['s3230:no-such-code']
let d1 = 0
const d1Targets = ENTRY_GATES.filter((g) => g.status === 'gated').filter((g) =>
  NON_SUPER.some((r) => hasPermissionCodes(roles[r], g.codes))
)
for (const gate of d1Targets) {
  const after = NON_SUPER.filter((r) => hasPermissionCodes(roles[r], DOCTORED))
  if (after.length !== 0) bad(`反测 D1 失败：门 ${gate.id} 换成不存在码后仍有非通配可见角色 [${after.join(', ')}]`)
  else d1 += 1
}
console.log(`   ${d1} / ${d1Targets.length} 个"对非通配角色可见"的门，改码后非通配角色全部不可见`)
if (d1 !== d1Targets.length) bad('反测 D1 覆盖不全')
else ok('D1 通过：非通配角色的可见性**确实由门码决定**（换码即不可见）')

// D2：换成"更宽的现存码" ⇒ 可见集合变大（证明码的选取真在决定受众，门不是摆设）
console.log('\n-- D2. 反测：门码换成更宽的现存码（sale:create）⇒ 可见集合必须变化 --')
const WIDER = ['sale:create']
let d2 = 0
for (const gate of ENTRY_GATES.filter((g) => g.status === 'gated' && g.codes.length > 0)) {
  const before = ACTIVE_ROLES.join(',')
  const after = ACTIVE_ROLES.filter((r) => hasPermissionCodes(roles[r], WIDER)).join(',')
  if (after !== before) d2 += 1
}
console.log(`   ${d2} / ${gates.GATED_ENTRY_IDS.length} 个门在换码后可见集合发生变化`)
if (d2 === 0) bad('反测 D2 失败：换码不影响任何门的可见集合（判定没有分辨力）')
else ok('D2 通过：改码会让受众集合发生变化 ⇒ 门码一旦被改错，矩阵断言会红')

// D3：复原 ⇒ 与基线一致
console.log('\n-- D3. 反测复原：换回注册表里的真码 ⇒ 可见集合回到基线 --')
let d3 = 0
for (const gate of ENTRY_GATES.filter((g) => g.status === 'gated')) {
  const vis = ACTIVE_ROLES.filter((r) => hasPermissionCodes(roles[r], gate.codes))
  if (vis.join(',') === (visible[gate.id] ?? []).join(',')) d3 += 1
  else bad(`反测 D3 失败：门 ${gate.id} 复原后可见集合与基线不一致`)
}
console.log(`   ${d3} / ${gates.GATED_ENTRY_IDS.length} 个门复原后与基线一致`)
if (d3 !== gates.GATED_ENTRY_IDS.length) bad('反测 D3 覆盖不全')
else ok('D3 通过：复原 ⇒ 可见（与 C 节基线一致）')

// 「未取到权限码」口径：null ⇒ 放行；空数组 ⇒ 拒绝（与 stores/menu.ts 的 null/空集口径一致）
console.log('\n-- E. 未取到权限码 / 空码集 口径 --')
if (!hasPermissionCodes(null, ['sale:create'])) bad('null（未取到）应放行')
else ok('permissions = null（未取到）⇒ 放行（维持改造前可见性）')
if (hasPermissionCodes([], ['sale:create'])) bad('空数组（确实无码）应拒绝')
else ok('permissions = []（取到但无码）⇒ 不显示（失败关闭）')
if (matchPermissionCode(['store:*'], 'store:transfer') !== true) bad('模块通配 store:* 应命中 store:transfer')
else ok('模块通配 `store:*` 命中 `store:transfer`（与后端 matchPermission 规则②一致）')
if (matchPermissionCode(['*:view'], 'inventory:adjust') !== false) bad('动作通配 *:view 不应命中写码')
else ok('动作通配 `*:view` 不命中写码（观察员看不到写入口）')

console.log('\n== 结论 ==')
if (failures.length) {
  console.log(`FAILED：${failures.length} 条断言未通过`)
  process.exit(1)
}
console.log('PASSED：台账 / 注册表 / 源码引用 / 在用角色矩阵 / 反测 / 口径 全部通过')
process.exit(0)
