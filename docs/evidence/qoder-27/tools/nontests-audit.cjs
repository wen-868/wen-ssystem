// QODER-27 收尾复算：gates-baseline.json 非 tests 段在 main / bc1087ee / 四个 merge 点上的逐字段对照
// 为什么要复算：raw/50 §5 记了「非tests段 vs bc1087ee 相等=true，vs 7dda80b8 相等=false」，
// 而 raw/01（main 上的门读数）是「error 20（基线 20）」、raw/21（HEAD）是「error 0（基线 0）」——
// 两条读数必须落到同一个文件版本上才能定性，故此处直接从 git blob 重取。
const { execSync } = require('node:child_process')
const crypto = require('node:crypto')
const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const REL = 'app-mobile/scripts/gates-baseline.json'
const G = (c) => execSync(`git -C "${TREE}" ${c}`, { encoding: 'utf8', maxBuffer: 1 << 26 })

const revs = {
  bc1087ee: 'bc1087ee',
  main: '7dda80b8',
  t23f1: '71b248c8',
  t24: 'dd44e321',
  t25f1: '317e421d',
  t26: '1b6da083',
  M1: '18cb89b0',
  M2: '57ccbfe9',
  M3: '8835d11c',
  M4_head: '167979aa',
}
const sec = {}
for (const [k, r] of Object.entries(revs)) {
  const o = JSON.parse(G(`show ${r}:${REL}`))
  const nt = {}
  for (const key of Object.keys(o)) if (key !== 'tests') nt[key] = o[key]
  sec[k] = { nt, ntHash: crypto.createHash('sha256').update(JSON.stringify(nt)).digest('hex').slice(0, 16), tests: `${o.tests.testFiles}/${o.tests.testCount}` }
  console.log(`${k.padEnd(8)} tests=${sec[k].tests.padEnd(9)} nonTestsHash=${sec[k].ntHash} lint=${JSON.stringify(o.lint)} typeCheck=${JSON.stringify(o.typeCheck)} checkContract=${JSON.stringify(o.checkContract)} contractDrift=${JSON.stringify(o.contractDrift)}`)
}
console.log('--- 两两相等判定（非 tests 段）---')
const keys = Object.keys(revs)
for (let i = 1; i < keys.length; i++) {
  const a = keys[0], b = keys[i]
  console.log(`${b.padEnd(8)} vs ${a} : ${sec[a].ntHash === sec[b].ntHash ? 'EQUAL' : 'DIFF'}`)
}
console.log('--- main 与 M1..M4 的差异明细 ---')
const diffKeys = (a, b) => {
  const ka = new Set([...Object.keys(sec[a].nt), ...Object.keys(sec[b].nt)])
  const out = []
  for (const k of ka) if (JSON.stringify(sec[a].nt[k]) !== JSON.stringify(sec[b].nt[k])) out.push(k)
  return out
}
for (const b of ['M1', 'M2', 'M3', 'M4_head']) console.log(`main vs ${b} 差异字段: ${JSON.stringify(diffKeys('main', b))}`)
for (const b of ['main', 'M1', 'M4_head']) console.log(`bc1087ee vs ${b} 差异字段: ${JSON.stringify(diffKeys('bc1087ee', b))}`)
console.log('NONTESTS_SECTION_AUDIT=DONE')
