// QODER-27：核验四来源 tests.note 是否都以共同基线 bc1087ee 的 note 为前缀（决定"逐段保留"能否机械成立）
const { execSync } = require('node:child_process')
const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const P = 'app-mobile/scripts/gates-baseline.json'

function bl (rev) {
  const raw = execSync(`git -C "${TREE}" show ${rev}:${P}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(raw)
}

const base = bl('bc1087ee')
const srcs = { '23F1': '71b248c8', '24': 'dd44e321', '25F1': '317e421d', '26': '1b6da083' }
console.log(`BASE bc1087ee tests=${base.tests.testFiles}/${base.tests.testCount} noteLen=${base.tests.note.length}`)
for (const [name, rev] of Object.entries(srcs)) {
  const j = bl(rev)
  const starts = j.tests.note.startsWith(base.tests.note)
  console.log(
    `${name} ${rev.slice(0, 8)} tests=${j.tests.testFiles}/${j.tests.testCount} noteLen=${j.tests.note.length}` +
    ` startsWithBase=${starts} segLen=${starts ? j.tests.note.length - base.tests.note.length : 'N/A'}`
  )
}
const main = bl('main')
console.log(`main ${main.tests.testFiles}/${main.tests.testCount} noteLen=${main.tests.note.length} mainNoteIsPrefixOfBase=${base.tests.note.startsWith(main.tests.note)}`)
