#!/usr/bin/env node
/**
 * QODER-1（批次 0）· 门 2 —— app-mobile `lint`（eslint **error 0 新增** + warning 不劣化）
 *
 * 本体就是任务书 §二.2 的 `eslint src/`（eslint 8 eslintrc 形态，配置 `.eslintrc.cjs`，
 * 与 admin-web 同族）；本脚本只是给它加**冻结基线比较**（任务书 §二.5）：
 *   · error：存量 20 条全部位于**页面文件**内（no-extra-semi/no-unreachable/no-empty 等），
 *     本单红线"不得改业务逻辑与页面"⇒ 无法清零 ⇒ 按 §二.5 冻结口径执行：
 *     按 `文件::规则` 计数入基线，**新增 error ⇒ EXIT=1 并逐条点名**（新文件出现任何
 *     error 规则也直接红）；存量被修掉只打印提醒（只准降不准升，重登记需人工改基线）。
 *   · warning：按 `规则` 计数入基线，任一规则条数**超出基线 ⇒ 红**（点名规则与超出的
 *     具体位置）；同文件同规则的行号漂移不算劣化。
 * 这不是把规则关掉：规则全部保持原级别，红线代码里新加的问题照样红。
 *
 * 用法：node scripts/lint-gate.mjs
 * 反测：注入 1 个 lint error（如页面里加 `debugger` 不必要分号等）⇒ EXIT=1 且点名；
 *       复原 ⇒ EXIT=0（SHA256 一致）。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(MOBILE_ROOT, '..')
const BASELINE_FILE = join(HERE, 'gates-baseline.json')

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
const ERR_BASE = baseline.lint?.errorsByFileRule ?? {}
const WARN_BASE = baseline.lint?.warningsByRule ?? {}

// 直接以 node 调 eslint 的 JS 入口（Windows 下 spawnSync 跑 .cmd 需要 shell:true，
// 且 shell 会吞输出编码——本仓 CI 实测教训）；工具与参数与任务书 §二.2 完全一致。
const res = spawnSync(
  process.execPath,
  [join(REPO_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js'), 'src', '--ext', '.ts,.vue', '-f', 'json'],
  { cwd: MOBILE_ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
)
if (res.error || res.signal) {
  console.error('eslint 启动失败 ⇒ 保守判红：', res.error || res.signal)
  process.exit(1)
}
if (res.status !== 0 && res.status !== 1) {
  console.error(`eslint 以非常规退出码结束（EXIT=${res.status}）⇒ 判红并回显 stderr：`)
  console.error(res.stderr || '')
  process.exit(1)
}
let report
try {
  report = JSON.parse(res.stdout || '[]')
} catch {
  console.error('eslint 输出不可解析 ⇒ EXIT≠0 保守判红。')
  console.error((res.stdout || res.stderr || '').slice(0, 4000))
  process.exit(1)
}
// 假绿兜底：eslint 对**每个**被检文件都出一条记录（含零问题文件）。
// 记录数与 src 下 .ts/.vue 文件数对不上 ⇒ 说明根本没扫到东西（配置/路径坏了）⇒ 红。
import { readdirSync, statSync } from 'node:fs'
function countSrcFiles(dir) {
  let n = 0
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) n += countSrcFiles(p)
    else if (/\.(ts|vue)$/.test(e) && !e.endsWith('.d.ts')) n += 1 // .d.ts 在 ignorePatterns 内
  }
  return n
}
const srcCount = countSrcFiles(join(MOBILE_ROOT, 'src'))
if (report.length !== srcCount) {
  console.error(`✗ 假绿兜底：eslint 覆盖 ${report.length} 个文件 ≠ src 下 .ts/.vue 共 ${srcCount} 个 ⇒ 判红`)
  process.exit(1)
}

const errPairs = new Map()
const errHits = new Map()
const warnRules = new Map()
for (const f of report) {
  const rel = relative(MOBILE_ROOT, f.filePath).replace(/\\/g, '/')
  for (const m of f.messages) {
    if (m.severity === 2) {
      const key = `${rel}::${m.ruleId ?? 'parse-error'}`
      errPairs.set(key, (errPairs.get(key) ?? 0) + 1)
      if (!errHits.has(key)) errHits.set(key, [])
      errHits.get(key).push(`${rel}:${m.line}:${m.column} ${m.ruleId ?? 'parse-error'} ${m.message}`)
    } else {
      warnRules.set(m.ruleId ?? 'parse-error', (warnRules.get(m.ruleId ?? 'parse-error') ?? 0) + 1)
    }
  }
}

const newErrors = []
let errTotal = 0
for (const [key, count] of errPairs) {
  errTotal += count
  const cap = ERR_BASE[key] ?? 0
  if (count > cap) newErrors.push(...errHits.get(key).slice(cap))
}
let warnTotal = 0
const worseWarnings = []
for (const [rule, count] of warnRules) {
  warnTotal += count
  const cap = WARN_BASE[rule] ?? 0
  if (count > cap) worseWarnings.push(`${rule}: 当前 ${count} 条 > 基线 ${cap} 条`)
}

console.log('—— lint（eslint src --ext .ts,.vue，error 0 新增 / warning 不劣化）——')
console.log(
  `当前 error ${errTotal}（基线 ${Object.values(ERR_BASE).reduce((a, b) => a + b, 0)}）、` +
    `warning ${warnTotal}（基线 ${Object.values(WARN_BASE).reduce((a, b) => a + b, 0)}）`
)

let red = false
if (newErrors.length > 0) {
  red = true
  console.error(`✗ 新增 error ${newErrors.length} 条（基线之外，逐条点名）：`)
  newErrors.forEach((x) => console.error(`  ${x}`))
}
if (worseWarnings.length > 0) {
  red = true
  console.error(`✗ warning 劣化（规则计数超冻结基线）：`)
  worseWarnings.forEach((x) => console.error(`  ${x}`))
}
if (!red) {
  console.log('✓ 无新增 error、warning 未劣化 ⇒ EXIT=0')
  if (baseline.lint?.mustReachZero && errTotal > 0) {
    console.log(`⚠ error 级不许长期冻结（当前 ${errTotal} 条）：${String(baseline.lint.dueBatch ?? '到期批见 gates-baseline.json').replace(/^凌舟裁定①（2026-10-18）：/, '')}`)
  }
  if (errTotal + warnTotal < Object.values(ERR_BASE).reduce((a, b) => a + b, 0) + Object.values(WARN_BASE).reduce((a, b) => a + b, 0)) {
    console.log('ℹ 存量低于基线 ⇒ 请把 gates-baseline.json 调低（只准降不准升）。')
  }
}
process.exit(red ? 1 : 0)
