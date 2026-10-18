#!/usr/bin/env node
/**
 * QODER-6（S3-242）· 跨层漂移定性机 —— 只跑本单 16+1 清单，不做全量对账。
 * 清单 A：permission-gates.ts 注册表 island-instant-retail-admin 的 27 条 endpoints（12 运营 + 15 平台）。
 * 清单 B：admin-web/src/api/system.ts 的 5 个 /admin/system/employees* wrapper（+1）。
 *   —— S3-242 收口（QODER-7）后 wrapper 已下线：sites=0 ⇒ 仍报 D4 作"已删除"说明（任务书 §二.1 口径）。
 * 判定：OK / D1 真漂移 / D2 端点不存在 / D3 等价 / D4 误报（匹配口径未覆盖真实调用关系）。
 * debt = D1 + D2，对照 gates-baseline.json 的 contractDrift.debt（只准降；超或缺段 ⇒ 红）。
 * 抽取逻辑与 check-contract.mjs 同一套但**逐字复制**：该脚本 import 即执行 main() 并 process.exit，不可复用 import。
 * 用法：node scripts/check-contract-drift.mjs [--json]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(MOBILE_ROOT, '..')
const GATES_FILE = join(MOBILE_ROOT, 'src', 'config', 'permission-gates.ts')
const BACKEND_ROUTES = join(REPO_ROOT, 'backend', 'src', 'routes')
const ADMIN_WEB_SRC = join(REPO_ROOT, 'admin-web', 'src')
const ADMIN_WEB_SYSTEM_TS = join(ADMIN_WEB_SRC, 'api', 'system.ts')
const BASELINE_FILE = join(HERE, 'gates-baseline.json')

const VERBS = ['get', 'post', 'put', 'patch', 'delete']
const COMMENT_RE = /^\s*(?:\/\/|\*|\/\*|import\b)/
const GATE_LINE_RE = /^\s*'(GET|POST|PUT|PATCH|DELETE) (\/api\/admin\/instant-retail\/[^']+)'\s*,?\s*$/
const EMP_WRAPPERS = ['fetchEmployees', 'fetchEmployeeDetail', 'createEmployee', 'updateEmployee', 'toggleEmployeeStatus']

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'unpackage') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|vue)$/.test(e.name)) out.push(p)
  }
  return out
}

function normalizePath(raw) {
  let p = raw.replace(/\$\{[^}]*\}/g, '*').split('?')[0].trim()
  return p.startsWith('/') ? p : '/' + p
}

function toPattern(p) {
  return p.split('/').map((s) => (s.startsWith(':') ? '*' : s)).join('/')
}

function patternEquals(a, b) {
  const sa = a.split('/').filter(Boolean)
  const sb = b.split('/').filter(Boolean)
  if (sa.length !== sb.length) return false
  return sa.every((seg, i) => seg === '*' || sb[i] === '*' || seg === sb[i])
}

function prefixByRouter(src, receiverVars) {
  const prefixes = [...src.matchAll(/prefix\s*:\s*["']([^"']*)["']/g)].map((m) => ({ idx: m.index, prefix: m[1] }))
  const map = new Map()
  for (const m of src.matchAll(/router\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    let best = null
    for (const p of prefixes) {
      const d = Math.abs(p.idx - m.index)
      if (!best || d < best.d) best = { d, prefix: p.prefix }
    }
    if (best) map.set(m[1], best.prefix)
  }
  if (prefixes.length === 1) for (const v of receiverVars) if (!map.has(v)) map.set(v, prefixes[0].prefix)
  return map
}

function scanBackend() {
  const routes = []
  for (const e of readdirSync(BACKEND_ROUTES, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.routes.ts')) continue
    const src = readFileSync(join(BACKEND_ROUTES, e.name), 'utf8')
    const callRe = new RegExp(`([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${VERBS.join('|')})\\s*\\(\\s*["'\`]([^"'\`\\n]*)`, 'g')
    const receivers = [...new Set([...src.matchAll(callRe)].map((m) => m[1]))]
    const prefixMap = prefixByRouter(src, receivers)
    const filePrefix = /(^|\n)\s*(?:export\s+const\s+routeConfigs?\b)/.test(src) ? null : `/api/${e.name.replace(/\.routes\.ts$/, '')}`
    for (const m of src.matchAll(callRe)) {
      const prefix = prefixMap.get(m[1]) ?? filePrefix
      if (!prefix) continue
      routes.push({ file: `backend/src/routes/${e.name}`, line: src.slice(0, m.index).split(/\r?\n/).length, method: m[2].toUpperCase(), path: normalizePath(prefix + m[3]) })
    }
  }
  const serverFile = join(REPO_ROOT, 'backend', 'src', 'server.ts')
  if (existsSync(serverFile)) {
    const src = readFileSync(serverFile, 'utf8')
    const appRe = new RegExp(`\\bapp\\s*\\.\\s*(${VERBS.join('|')})\\s*\\(\\s*["'\`]/api/([^"'\`\\n]*)`, 'g')
    for (const m of src.matchAll(appRe))
      routes.push({ file: 'backend/src/server.ts', line: src.slice(0, m.index).split(/\r?\n/).length, method: m[1].toUpperCase(), path: normalizePath('/api/' + m[2]) })
  }
  return routes
}

function scanGateEndpoints() {
  const rows = []
  readFileSync(GATES_FILE, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const m = GATE_LINE_RE.exec(line)
    if (m) rows.push({ at: `app-mobile/src/config/permission-gates.ts:${i + 1}`, method: m[1], path: normalizePath(m[2]) })
  })
  return rows
}

function classifyGate(e, backend) {
  const pattern = toPattern(e.path)
  const exact = backend.find((r) => r.method === e.method && patternEquals(toPattern(r.path), pattern))
  if (exact) return { cls: 'OK', hit: `${exact.file}:${exact.line}` }
  const stripped = toPattern(e.path.replace('/platform/', '/'))
  const afterStrip = backend.find((r) => r.method === e.method && patternEquals(toPattern(r.path), stripped))
  if (afterStrip)
    return { cls: 'D1', kind: '前缀误写（注册表多写 /platform 段，后端无该段）', hit: `${afterStrip.file}:${afterStrip.line}`, fix: `${afterStrip.method} ${afterStrip.path}` }
  const diffVerb = backend.find((r) => patternEquals(toPattern(r.path), pattern))
  if (diffVerb)
    return { cls: 'D1', kind: `方法漂移（注册表 ${e.method}，后端实为 ${diffVerb.method}）`, hit: `${diffVerb.file}:${diffVerb.line}`, fix: `${diffVerb.method} ${diffVerb.path}` }
  return { cls: 'D2', kind: '后端 0 注册，调用必 404', hit: '不存在' }
}

function countEmpCallers() {
  let callers = 0
  const self = relative(REPO_ROOT, ADMIN_WEB_SYSTEM_TS).replace(/\\/g, '/')
  for (const f of walk(ADMIN_WEB_SRC)) {
    if (relative(REPO_ROOT, f).replace(/\\/g, '/') === self) continue
    const body = readFileSync(f, 'utf8')
    callers += [...body.matchAll(new RegExp(`\\b(${EMP_WRAPPERS.join('|')})\\s*\\(`, 'g'))].length
  }
  return callers
}

function main() {
  const jsonMode = process.argv.includes('--json')
  if (!existsSync(BACKEND_ROUTES) || !existsSync(GATES_FILE) || !existsSync(ADMIN_WEB_SYSTEM_TS)) {
    console.error('缺少对账所需文件（backend routes / permission-gates.ts / admin-web system.ts）')
    process.exit(1)
  }
  const backend = scanBackend()
  const rows = scanGateEndpoints().map((e) => ({ ...e, ...classifyGate(e, backend) }))
  const counts = { OK: 0, D1: 0, D2: 0 }
  for (const r of rows) counts[r.cls] += 1

  const empSites = []
  readFileSync(ADMIN_WEB_SYSTEM_TS, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (COMMENT_RE.test(line)) return
    const m = /['"`](\/admin\/system\/employees[^'"`\s]*)['"`]/.exec(line)
    if (m) empSites.push({ at: `admin-web/src/api/system.ts:${i + 1}`, path: normalizePath('/api' + m[1]) })
  })
  const empBackendMiss = empSites.filter((s) => !backend.some((r) => patternEquals(toPattern(r.path), toPattern(s.path))))
  const empCallers = countEmpCallers()
  const staffEq = backend.filter((r) => r.path.startsWith('/api/admin/staff')).slice(0, 3).map((r) => `${r.method} ${r.path}@${r.file}:${r.line}`)
  let empCls = 'D3'
  let empNote = '后端存在注册'
  if (empSites.length === 0) {
    empCls = 'D4'
    empNote = 'employees wrapper 已随 S3-242 收口（QODER-7）下线，system.ts 中无 /admin/system/employees 字面量 ⇒ D4 定性对象已消亡，本行保留作说明；员工能力请用 /api/admin/staff*（D3 映射）'
  } else if (empBackendMiss.length > 0 && empCallers === 0) {
    empCls = 'D4'
    empNote = `后端 ${empBackendMiss.length} 路径 0 注册属实，但 ${EMP_WRAPPERS.length} 个 wrapper 在 admin-web/src（除 api/system.ts）调用点 = 0 ⇒「前端在调」前提不成立 = 清单口径误报（只按字符串存在性判在调、无 caller 闭包）。D3 等价映射备用：${staffEq.join(' | ')}`
  } else if (empBackendMiss.length > 0) {
    empCls = 'D2'
    empNote = `后端 0 注册且有 ${empCallers} 个调用点 ⇒ 调用必 404，建议下线`
  }
  const debt = counts.D1 + counts.D2 + (empCls === 'D2' ? empBackendMiss.length : 0)
  const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).contractDrift : undefined
  const red = !baseline || typeof baseline.debt !== 'number' || debt > baseline.debt

  if (jsonMode) {
    console.log(JSON.stringify({ total: rows.length, ...counts, employees: { cls: empCls, sites: empSites.length, miss: empBackendMiss.length, callers: empCallers }, debt, baselineDebt: baseline?.debt ?? null, rows, empSites }, null, 2))
  } else {
    console.log('—— S3-242 跨层漂移定性机（只跑本单 16+1 清单）——')
    console.log(`注册表抽取 ${rows.length} 行：OK ${counts.OK} / D1 ${counts.D1} / D2 ${counts.D2}`)
    for (const r of rows) {
      if (r.cls === 'OK') continue
      console.log(`[${r.cls}] ${r.at}  ${r.method} ${r.path}`)
      console.log(`      → 后端实际 ${r.hit}${r.fix ? `（正确：${r.fix}）` : ''}${r.kind ? ` ⇒ ${r.kind}` : ''}`)
    }
    console.log(`employees（+1）：定义 ${empSites.length} 行，后端 0 注册 ${empBackendMiss.length}，caller ${empCallers} ⇒ ${empCls}`)
    console.log(`      ${empNote}`)
    console.log(`debt（D1+D2）= ${debt}，基线 contractDrift.debt = ${baseline?.debt ?? '缺失'}`)
  }
  if (red) {
    console.error(`✗ debt=${debt} 超基线（只准降）或未立基线 ⇒ EXIT=1`)
    process.exit(1)
  }
  if (!jsonMode && baseline && debt < baseline.debt)
    console.log(`ℹ debt ${debt} < 基线 ${baseline.debt} ⇒ 请回来调低 gates-baseline.json（修复进度信号）`)
  if (!jsonMode) console.log('✓ 通过 ⇒ EXIT=0')
  process.exit(0)
}

main()
