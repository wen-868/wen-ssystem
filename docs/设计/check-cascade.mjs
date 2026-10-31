#!/usr/bin/env node
/**
 * ① 验证 :root:root 覆盖块在产物中的层叠顺序（须晚于 element-plus 原定义才生效）
 * ② 量化「Element Plus 状态色」与「总后台设计令牌」的跨体系漂移
 */
import fs from 'node:fs'
import path from 'node:path'

const A = path.join('saas-admin', 'dist', 'assets')
const g = fs.readdirSync(A).find((x) => x.startsWith('index-') && x.endsWith('.css'))
const s = fs.readFileSync(path.join(A, g), 'utf8')

console.log('═══ ① 层叠顺序验证 ═══')
const checks = [
  ['--el-color-primary', '#409eff', 'var(--color-primary)'],
  ['--el-text-color-secondary', '#909399', 'var(--text-muted)'],
  ['--el-text-color-placeholder', '#c0c4cc', 'var(--text-placeholder)'],
]
for (const [name, origin, override] of checks) {
  const re = new RegExp('--' + name.slice(2) + '\\s*:')
  let at = -1, oi = -1, vi = -1
  let m
  const reAll = new RegExp('--' + name.slice(2) + '\\s*:\\s*([^;}]+)', 'g')
  const positions = []
  while ((m = reAll.exec(s))) positions.push({ at: m.index, val: m[1].trim() })
  const last = positions[positions.length - 1]
  console.log(`  ${name}`)
  positions.forEach((p) => console.log(`      位置 ${String(p.at).padStart(7)} → ${p.val}`))
  console.log(`      最终生效（最后出现）: ${last ? last.val : '无'}  ${last && /var\(/.test(last.val) ? '✅ 已被设计令牌覆盖' : '⚠️ 仍是 Element 原值'}`)
}

console.log('\n═══ ② Element Plus 状态色 vs 总后台令牌（跨体系漂移）═══')
const pairs = [
  ['成功 success', '--el-color-success', '--color-success'],
  ['警告 warning', '--el-color-warning', '--color-warning'],
  ['危险 danger', '--el-color-danger', '--color-danger'],
  ['信息 info', '--el-color-info', '--color-info'],
  ['主文本', '--el-text-color-primary', '--text-primary'],
  ['常规文本', '--el-text-color-regular', '--text-secondary'],
  ['边框', '--el-border-color', '--border-normal'],
  ['圆角 base', '--el-border-radius-base', '--radius-md'],
]
function val(tok) {
  const re = new RegExp('--' + tok.slice(2).replace(/[-]/g, '\\-') + '\\s*:\\s*([^;}]+)')
  const m = s.match(re)
  return m ? m[1].trim() : '（未定义）'
}
for (const [label, elTok, dsTok] of pairs) {
  const a = val(elTok), b = val(dsTok)
  const same = a.replace(/\s/g, '') === b.replace(/\s/g, '')
  console.log(`  ${label.padEnd(12)} ${elTok.padEnd(26)} = ${a.padEnd(22)} │ 令牌 ${dsTok.padEnd(20)} = ${b.padEnd(10)} ${same ? '一致' : '⚠️ 漂移'}`)
}
