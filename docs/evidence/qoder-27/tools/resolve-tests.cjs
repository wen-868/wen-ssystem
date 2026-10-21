/**
 * QODER-27 收敛：gates-baseline.json 的 tests 段解算器（文本级重写，保 CRLF、保缩进、保非 tests 段逐字节不变）
 * 用法：node resolve-tests.cjs --files 12 --count 232 --segs dd44e321[,317e421d] [--extra "负责人收敛台账段文本"]
 * 规则：note = 现 note + 每个来源 tip 的"自有追加段"原文（该段 := 来源 note 去掉共同基线 bc1087ee note 前缀），一段不删、不改写、不合并成一段。
 */
const fs = require('node:fs')
const { execSync } = require('node:child_process')

const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const REL = 'app-mobile/scripts/gates-baseline.json'
const FILE = TREE + '/' + REL
const BASE_REV = 'bc1087ee'

function arg (name) {
  const i = process.argv.indexOf('--' + name)
  if (i === -1) return null
  return process.argv[i + 1]
}

function blobJson (rev) {
  const out = execSync(`git -C "${TREE}" show ${rev}:${REL}`, { encoding: 'utf8', maxBuffer: 1 << 26 })
  return JSON.parse(out)
}

const files = Number(arg('files'))
const count = Number(arg('count'))
const segs = (arg('segs') || '').split(',').filter(Boolean)
// --extra-file：从仓外文件读台账段（CJK 长串走 argv 有编码风险），去掉尾部换行避免给 JSON 注水 \n
const extraFile = arg('extra-file')
const extra = extraFile
  ? fs.readFileSync(extraFile, 'utf8').replace(/(?:\r\n|\n|\r)$/, '')
  : arg('extra')
if (!Number.isFinite(files) || !Number.isFinite(count) || segs.length === 0) {
  console.error('参数不全：--files/--count/--segs')
  process.exit(2)
}

const raw = fs.readFileSync(FILE, 'utf8')
const obj = JSON.parse(raw)
const baseNote = blobJson(BASE_REV).tests.note
const oldNote = obj.tests.note
const before = { testFiles: obj.tests.testFiles, testCount: obj.tests.testCount, noteLen: oldNote.length }

// 非 tests 段的改前快照（用于逐字节回证）
const nonTestsBefore = Object.keys(obj)
  .filter((k) => k !== 'tests')
  .map((k) => k + '=' + JSON.stringify(obj[k]))
  .join('\n')

if (!oldNote.startsWith(baseNote)) {
  console.error(`✗ 现 note 不以共同基线 note 为前缀（无法证明"只追加"）⇒ 拒写`)
  process.exit(2)
}

let note = oldNote
for (const rev of segs) {
  const srcNote = blobJson(rev).tests.note
  if (!srcNote.startsWith(baseNote)) {
    console.error(`✗ ${rev} 的 note 不以 ${BASE_REV} note 为前缀 ⇒ 无法逐段抽取，拒写`)
    process.exit(2)
  }
  const seg = srcNote.slice(baseNote.length)
  if (seg.length === 0) {
    console.error(`✗ ${rev} 无自有追加段 ⇒ 拒写`)
    process.exit(2)
  }
  if (note.includes(seg)) {
    console.error(`✗ ${rev} 的段已在册（重复并入？）⇒ 拒写`)
    process.exit(2)
  }
  note = note + seg
  console.log(`SEG ${rev.slice(0, 8)} segLen=${seg.length} 头=${JSON.stringify(seg.slice(0, 24))}`)
}
if (extra) note = note + extra

obj.tests.testFiles = files
obj.tests.testCount = count
obj.tests.note = note

const outText = JSON.stringify(obj, null, 2).replace(/\n/g, '\r\n') + '\r\n'
fs.writeFileSync(FILE, outText, 'utf8')

// ---- 回读校验（全部从磁盘重读，不信内存态）----
const after = fs.readFileSync(FILE, 'utf8')
const re = JSON.parse(after)
const nonTestsAfter = Object.keys(re)
  .filter((k) => k !== 'tests')
  .map((k) => k + '=' + JSON.stringify(re[k]))
  .join('\n')
console.log(`READBACK testFiles=${re.tests.testFiles} testCount=${re.tests.testCount} noteLen=${re.tests.note.length}`)
console.log(`READBACK before=${before.testFiles}/${before.testCount} noteLen=${before.noteLen}`)
console.log(`READBACK noteStartsWithOld=${re.tests.note.startsWith(oldNote)} (只准追加)`)
console.log(`READBACK noteStartsWithBase=${re.tests.note.startsWith(baseNote)}`)
console.log(`READBACK nonTestsByteIdentical=${nonTestsBefore === nonTestsAfter}`)
console.log(`READBACK eolCrlfOnly=${(after.match(/\r\n/g) || []).length} bareLf=${(after.match(/(?<!\r)\n/g) || []).length}`)
console.log(`READBACK keysOrder=${Object.keys(re).join(',')}`)
