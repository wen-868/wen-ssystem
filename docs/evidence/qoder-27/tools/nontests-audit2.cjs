// QODER-27 收尾复算 2：非 tests 段逐字段对照 + main 侧真实落后度
// 触发原因：raw/01（main 门读数）= 「error 20（基线 20）／5 文件 56 用例」，raw/21（HEAD）= 「error 0（基线 0）／15 文件 303 用例」。
// 必须回答：非 tests 段从 20→0 是本卡手工改的，还是四树带进来的？⇒ 从 git blob 逐版本重取，只看结构不抄 note 长文。
const { execSync } = require('node:child_process')
const crypto = require('node:crypto')
const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const REL = 'app-mobile/scripts/gates-baseline.json'
const G = (c) => execSync(`git -C "${TREE}" ${c}`, { encoding: 'utf8', maxBuffer: 1 << 26 })

const revs = [
  ['21b465e5', 'origin/main（= main 与四树的 merge-base）'],
  ['7dda80b8', 'main（本卡基座）'],
  ['bc1087ee', '四树共同基线'],
  ['71b248c8', 'QODER-23F1 tip'],
  ['dd44e321', 'QODER-24 tip'],
  ['317e421d', 'QODER-25F1 tip'],
  ['1b6da083', 'QODER-26 tip'],
  ['18cb89b0', 'M1 = main+23F1'],
  ['57ccbfe9', 'M2 = M1+24'],
  ['8835d11c', 'M3 = M2+25F1'],
  ['167979aa', 'M4 = M3+26 = HEAD'],
]

console.log('| 版本 | 说明 | lint.errorBaseline | lint.warningsByRule 合计 | typeCheck | checkContract | contractDrift | tests | 非tests段 SHA256[:16] |')
console.log('|---|---|---|---|---|---|---|---|---|')
const store = {}
for (const [r, desc] of revs) {
  let o
  try { o = JSON.parse(G(`show ${r}:${REL}`)) } catch (e) { console.log(`| ${r} | ${desc} | (无此文件) | | | | | | |`); continue }
  const nt = {}
  for (const k of Object.keys(o)) if (k !== 'tests') nt[k] = o[k]
  const hash = crypto.createHash('sha256').update(JSON.stringify(nt)).digest('hex').slice(0, 16)
  store[r] = { nt, hash }
  const warnSum = Object.values(o.lint?.warningsByRule ?? {}).reduce((a, b) => a + Number(b), 0)
  console.log(`| ${r} | ${desc} | ${o.lint?.errorBaseline} | ${warnSum} | ${JSON.stringify(o.typeCheck?.errorBaseline ?? o.typeCheck?.baseline ?? o.typeCheck)} | ${typeof o.checkContract === 'object' ? JSON.stringify(o.checkContract).slice(0, 40) + '…' : JSON.stringify(o.checkContract)} | ${typeof o.contractDrift === 'object' ? JSON.stringify(o.contractDrift).slice(0, 40) + '…' : JSON.stringify(o.contractDrift)} | ${o.tests.testFiles}/${o.tests.testCount} | ${hash} |`)
}

console.log('\n## 逐字段差异：main(7dda80b8) → HEAD(167979aa)')
const a = store['7dda80b8'].nt, b = store['167979aa'].nt
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  const same = JSON.stringify(a[k]) === JSON.stringify(b[k])
  console.log(`- ${k}: ${same ? 'SAME' : 'DIFF'}`)
}

console.log('\n## 关键问题：非 tests 段的 20→0 是谁带的？')
console.log(`main 的 errorBaseline=${a.lint.errorBaseline}，bc1087ee（四树共同基线）的=${store.bc1087ee.nt.lint.errorBaseline}`)
console.log(`HEAD 非tests段 == bc1087ee 非tests段 ? ${store['167979aa'].hash === store.bc1087ee.hash}`)
console.log(`HEAD 非tests段 == M1 非tests段 ? ${store['167979aa'].hash === store['18cb89b0'].hash}`)
console.log(`M1..M4 四步非tests段是否全程未变 ? ${['18cb89b0', '57ccbfe9', '8835d11c', '167979aa'].every((r) => store[r].hash === store['18cb89b0'].hash)}`)

console.log('\n## main 侧落后度（只读实测）')
console.log(`$ git merge-base --is-ancestor 21b465e5 bc1087ee : ${G('merge-base --is-ancestor 21b465e5 bc1087ee; echo $?').trim()}  (0=是)` )
console.log(`$ git merge-base --is-ancestor bc1087ee 7dda80b8 : ${G('merge-base --is-ancestor bc1087ee 7dda80b8; echo $?').trim()}  (0=是)` )
console.log(`$ git ls-tree -r --name-only 7dda80b8 app-mobile/tests | wc -l : ${G('ls-tree -r --name-only 7dda80b8 app-mobile/tests').trim().split('\n').length}`)
console.log(`$ git ls-tree -r --name-only 167979aa app-mobile/tests | wc -l : ${G('ls-tree -r --name-only 167979aa app-mobile/tests').trim().split('\n').length}`)
console.log(`$ git diff --numstat 21b465e5..7dda80b8 -- app-mobile | wc -l : ${G('diff --numstat 21b465e5..7dda80b8 -- app-mobile').trim() === '' ? 0 : G('diff --numstat 21b465e5..7dda80b8 -- app-mobile').trim().split('\n').length}  (main 自带 app-mobile 改动面)`)
console.log(`$ git diff --numstat bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json : ${G('diff --numstat bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json').trim()}`)
console.log(`$ git diff --numstat 7dda80b8..HEAD -- app-mobile/scripts/gates-baseline.json : ${G('diff --numstat 7dda80b8..HEAD -- app-mobile/scripts/gates-baseline.json').trim()}`)
console.log('\nMAIN_STATE_AND_NONTESTS_AUDIT=DONE')
