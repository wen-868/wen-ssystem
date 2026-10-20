#!/usr/bin/env node
/**
 * QODER-1（批次 0）· 门 1 —— app-mobile `type-check`（vue-tsc **0 新增**口径）
 *
 * 与 S3-245（PR #363）的关系：**不是第二套类型门**。
 *   · 类型检查本体仍是 S3-245 的那一条命令形态：`npx --no-install vue-tsc --noEmit`
 *     （working-directory: app-mobile），本脚本只是它的**基线比较包装**；
 *   · 凌舟裁定② 已落地：#363 已进 main（3fa138e7）、本分支已 rebase 其上、
 *     原 12 条 crypto.ts TS2323/TS2393 随根治归零 ⇒ `gates-baseline.json` 的 typeCheck.errors = {}，
 *     门判据即 **error===0**（空基线下本脚本逐条点名任何新错误）；
 *   · CI 侧唯一类型门 = ci.yml 里的 S3-245 步骤；本地 `npm run type-check` 走本脚本，语义一致。
 * 基线存 `gates-baseline.json` 的 `typeCheck.errors`（`文件::TS码 -> 条数`，现为空）。
 *
 * 用法：node scripts/type-check-gate.mjs
 * 反测：注入 1 个类型错误 ⇒ EXIT=1 且点名该文件行；复原 ⇒ EXIT=0（SHA256 一致）。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(MOBILE_ROOT, '..')
const BASELINE_FILE = join(HERE, 'gates-baseline.json')

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
const allowed = baseline.typeCheck?.errors ?? {}

// 直接以 node 调 vue-tsc 的 JS 入口（与 `npx --no-install vue-tsc --noEmit` 同一工具同一参数；
// Windows 下 spawnSync 跑 .cmd 需要 shell:true 且吞编码，本仓 CI 实测教训）。
const res = spawnSync(
  process.execPath,
  [join(REPO_ROOT, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js'), '--noEmit'],
  { cwd: MOBILE_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
)
if (res.error || res.signal) {
  console.error('vue-tsc 启动失败 ⇒ 保守判红：', res.error || res.signal)
  process.exit(1)
}
if (res.status !== 0 && res.status !== 1 && res.status !== 2) {
  console.error(`vue-tsc 以非常规退出码结束（EXIT=${res.status}）⇒ 判红并回显输出尾部：`)
  console.error(`${res.stdout ?? ''}${res.stderr ?? ''}`.slice(-4000))
  process.exit(1)
}
const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
const lines = out.split(/\r?\n/)

/** vue-tsc 行形态：`src/utils/crypto.ts(825,17): error TS2323: ...` */
const ERR_RE = /^(\S+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):/
const seen = new Map()
const found = []
for (const line of lines) {
  const m = line.match(ERR_RE)
  if (!m) continue
  const key = `${m[1]}::${m[4]}`
  seen.set(key, (seen.get(key) ?? 0) + 1)
  found.push({ file: m[1], line: Number(m[2]), col: Number(m[3]), code: m[4], key, raw: line.trim() })
}

const fresh = []
let currentTotal = 0
for (const [key, count] of seen) {
  currentTotal += count
  const cap = allowed[key] ?? 0
  if (count > cap) {
    // 逐条点名超出基线的那几条（按出现顺序），新文件/新码则全部点名
    fresh.push(...found.filter((f) => f.key === key).slice(cap))
  }
}

console.log(`—— type-check（vue-tsc --noEmit，0 新增口径）——`)
console.log(`vue-tsc EXIT=${res.status}，当前错误 ${currentTotal} 条，基线 ${Object.values(allowed).reduce((a, b) => a + b, 0)} 条`)
if (fresh.length > 0) {
  console.error(`✗ 新增类型错误 ${fresh.length} 条（基线之外，逐条点名）：`)
  fresh.forEach((f) => console.error(`  ${f.raw}`))
  console.error('⇒ 修掉新增错误，或（仅当确属误报口径问题）回报凌舟调整基线 —— 本脚本无 --update 逃生口。')
  process.exit(1)
}
if (currentTotal < Object.values(allowed).reduce((a, b) => a + b, 0)) {
  console.log('ℹ 存量错误少于基线（如 S3-245 合并后）⇒ 请同步把 gates-baseline.json 的 typeCheck 调低（只准降不准升）。')
}
console.log('✓ 无新增类型错误 ⇒ EXIT=0')
