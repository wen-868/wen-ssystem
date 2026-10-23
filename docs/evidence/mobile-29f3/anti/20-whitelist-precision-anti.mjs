#!/usr/bin/env node
/**
 * MOBILE-29F3 · pageerror 精确白名单反测装置（**离线、不起浏览器**）
 *
 * 直接 import 冒烟编排里**同一份**判据（`createPageErrorJudge` / `isKnownPlaywrightErrorShell`），
 * 证明收紧后的白名单：
 *   A. 29F2 现场留档的已知空壳（精确 signature）⇒ 第 1 条豁免；
 *   B. **第 2 条同类空壳 ⇒ 判红**（凌舟裁定 3：次数上限 0 或 1）；
 *   C. 凌舟的构造反例 `{name:'',message:'unknown-object-marker',log:[]}` ⇒ **判红**
 *      （29F2 宽泛判据把它洗成已知 ⇒ 本用例即驳回点的复现与修复证明）；
 *   D. 普通 `new Error('anti-29f3')` 的字段形态 ⇒ **判红**；
 *   E~H. 逐字段扰动（额外键 / 非空 stack / 非空 log / message 不同）⇒ 全部 **判红**；
 *   I.   hideTabBar 具名噪声 ⇒ 仍豁免（未弱化，保持 29F2 口径）。
 *
 * 退出码：0 = 全部用例符合预期；1 = 任一用例不符合预期（装置本身必须能红）。
 */
import { createPageErrorJudge, isKnownPlaywrightErrorShell, KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE }
  from '../../mobile-29f2/smoke/run-smoke.mjs'
import { inspect } from 'node:util'

// 29F2 现场留档的已知空壳全字段（逐字取自 docs/evidence/mobile-29f2/smoke/results.json，
// 提取记录见 docs/evidence/mobile-29f3/00-signature-forensics-from-29f2-tracked-results.md）
const KNOWN_SHELL_PARTS = {
  name: '', message: 'Object', ctor: 'PlaywrightError', logLen: 0,
  keys: ['log', 'name'], inspect: '[Object] { log: [] }', stack: ''
}
const hayOf = (p) => [p.name, p.message, p.ctor, p.inspect, p.stack].filter(Boolean).join('\n')

const results = []
const check = (id, expected, actual, note) => results.push({ id, expected, actual, pass: expected === actual, note })

// ── A + B：已知空壳第 1 条豁免、第 2 条判红（同一 judge 闭包内计数）
{
  const judge = createPageErrorJudge()
  const first = judge(hayOf(KNOWN_SHELL_PARTS), { ...KNOWN_SHELL_PARTS })
  const second = judge(hayOf(KNOWN_SHELL_PARTS), { ...KNOWN_SHELL_PARTS })
  check('A 已知空壳第 1 条 ⇒ 豁免', true, !!first.known, `known=${JSON.stringify(first.known?.id ?? null)} overLimit=${first.overLimit}`)
  check('B 已知空壳第 2 条 ⇒ 判红', false, !!second.known, `overLimit=${second.overLimit}（上限=${KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.maxOccurrences}）`)
}

// ── C：凌舟构造反例（29F2 曾把它洗白）
{
  const judge = createPageErrorJudge()
  // 现场 Playwright 收到页面抛出的普通对象时：ctor=Object、keys 含 message
  const antiParts = {
    name: '', message: 'unknown-object-marker', ctor: 'Object', logLen: 0,
    keys: ['name', 'message', 'log'], inspect: "Object { name: '', message: 'unknown-object-marker', log: [] }", stack: undefined
  }
  const v = judge(hayOf(antiParts), antiParts)
  check('C 结构化未知对象（凌舟反例）⇒ 判红', false, !!v.known, `known=${JSON.stringify(v.known?.id ?? null)}`)
  // 极端：攻击者伪造 ctor='PlaywrightError'，但 message 与 keys 不精确 ⇒ 仍判红
  const forged = { ...KNOWN_SHELL_PARTS, message: 'unknown-object-marker', keys: ['log', 'name', 'message'] }
  check('C2 伪造 ctor=PlaywrightError 但 message/keys 不符 ⇒ 判红', false, isKnownPlaywrightErrorShell(forged))
}

// ── D：普通 Error 形态
{
  const judge = createPageErrorJudge()
  const e = new Error('anti-29f3-normal-error')
  const parts = {
    name: e.name, message: e.message, ctor: e.constructor.name,
    keys: Object.keys(e).slice(0, 20), logLen: undefined,
    inspect: inspect(e, { depth: 2, breakLength: 200 }), stack: e.stack
  }
  check('D 普通 new Error ⇒ 判红', false, !!judge(hayOf(parts), parts).known, `message=${parts.message} ctor=${parts.ctor}`)
}

// ── E~H：逐字段扰动（任何一处偏离 signature 都不得豁免）
const perturb = [
  ['E 额外一个自有键', { ...KNOWN_SHELL_PARTS, keys: ['log', 'name', 'extra'] }],
  ['F stack 非空', { ...KNOWN_SHELL_PARTS, stack: 'PlaywrightError: at foo' }],
  ['G log 非空数组', { ...KNOWN_SHELL_PARTS, logLen: 1 }],
  ['H message 非 "Object"', { ...KNOWN_SHELL_PARTS, message: 'TypeError' }]
]
for (const [id, p] of perturb) check(`${id} ⇒ 判红`, false, isKnownPlaywrightErrorShell(p))

// ── I：hideTabBar 具名噪声仍豁免（不弱化既有口径）
{
  const judge = createPageErrorJudge()
  const p = { name: 'Error', message: 'hideTabBar:fail not TabBar page', ctor: 'Error', keys: [], inspect: '', stack: '' }
  check('I hideTabBar 具名噪声 ⇒ 仍豁免', true, !!judge(hayOf(p), p).known)
}

// ── 汇总
let failed = 0
console.log('MOBILE-29F3 反测装置（离线判据单测）')
console.log('='.repeat(72))
for (const r of results) {
  console.log(`${r.pass ? '✓' : '✗'} ${r.id}  [expected=${r.expected} actual=${r.actual}] ${r.note ? '— ' + r.note : ''}`)
  if (!r.pass) failed++
}
console.log('='.repeat(72))
console.log(`用例 ${results.length} 条 / 失败 ${failed} 条`)
if (failed === 0) console.log('WHITELIST_PRECISION_PASS')
else console.log('WHITELIST_PRECISION_FAIL')
process.exit(failed === 0 ? 0 : 1)
