#!/usr/bin/env node
/**
 * QODER-1（批次 0）· 门 3 —— app-mobile `test`（vitest run + **用例数不劣化**）
 *
 * 本体就是任务书 §二.3 的 vitest（≥3 条：①权限码通配 ②存储加解密往返 ③API 基址/环境变量）。
 * 为什么还要包装一层：`vitest run` 只保证"跑的都过"，**删掉一条测试它照样绿**——
 * 这正是门禁铁律里"恒绿摆设"的形态之一。故按 `gates-baseline.json` 的 `tests`
 * 冻结**测试文件数与用例总数**：低于基线 ⇒ EXIT=1 并点名差了多少；
 * 任一用例失败/报错 ⇒ vitest 自身的非零退出直接红。
 * （方向与 lint/type 相反：用例数只准升；升了请把基线同步调高。）
 *
 * 用法：node scripts/test-gate.mjs
 * 反测：删掉 1 条测试 ⇒ EXIT=1 且点名"14 < 基线 15"；复原 ⇒ EXIT=0（SHA256 一致）。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(MOBILE_ROOT, '..')

const baseline = JSON.parse(readFileSync(join(HERE, 'gates-baseline.json'), 'utf8')).tests ?? {}
const capFiles = baseline.testFiles ?? 0
const capTests = baseline.testCount ?? 0

const res = spawnSync(
  process.execPath,
  [join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run'],
  { cwd: MOBILE_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
)
const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
// vitest 汇总行带 ANSI 色码（非 TTY 下也有），先剥掉再匹配
const plain = out.replace(/\x1b\[[0-9;]*m/g, '')
process.stdout.write(out)

if (res.status !== 0) {
  console.error(`✗ vitest 本体失败（EXIT=${res.status}）⇒ 门 3 红（用例失败/配置坏）`)
  process.exit(res.status ?? 1)
}

const tm = plain.match(/Test Files\s+\d+\s+\w+\s+\((\d+)\)/)
const ts = plain.match(/Tests\s+[\d\s\w:]+\((\d+)\)/)
if (!tm || !ts) {
  console.error('✗ 解析不到 vitest 汇总行（Test Files/Tests）⇒ 保守判红（假绿兜底）')
  process.exit(1)
}
const gotFiles = Number(tm[1])
const gotTests = Number(ts[1])
console.log(`—— test 门（用例数冻结）：当前 ${gotFiles} 文件 / ${gotTests} 用例，基线 ${capFiles} / ${capTests} ——`)
if (gotFiles < capFiles || gotTests < capTests) {
  console.error(
    `✗ 用例数劣化：${gotFiles} 文件 / ${gotTests} 用例 < 基线 ${capFiles} / ${capTests}` +
      `（少了 ${capFiles - gotFiles} 文件 / ${capTests - gotTests} 用例）⇒ 点名要求恢复或说明`
  )
  process.exit(1)
}
if (gotFiles > capFiles || gotTests > capTests) {
  console.log('ℹ 用例数高于基线 ⇒ 请把 gates-baseline.json 的 tests 同步调高（保持"实测即基线"）。')
}
console.log('✓ vitest 全过且用例数不劣化 ⇒ EXIT=0')
