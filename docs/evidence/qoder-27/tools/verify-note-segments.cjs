/**
 * QODER-27 收敛后逐段回证：四树来源 note 的"自有追加段"必须逐字在册、顺序在册、共同基线段仍在头。
 * 用法：node verify-note-segments.cjs
 */
const fs = require('node:fs')
const { execSync } = require('node:child_process')

const TREE = 'D:/Users/ZXQL/wt-agents/QODER-27'
const REL = 'app-mobile/scripts/gates-baseline.json'
const BASE_REV = 'bc1087ee'
const SOURCES = [
  ['23F1', '71b248c80cbc7e82b1b5ed78efd7097e6a1bc573'],
  ['24', 'dd44e32114141ebaaca94c3487eb1343d50c0ab1'],
  ['25F1', '317e421d9b35e06014c8c6b5530bf69204252005'],
  ['26', '1b6da0830a24ed7da09b6fc30b5d0dca6dcd8b1e'],
]

const blob = (rev) =>
  JSON.parse(execSync(`git -C "${TREE}" show ${rev}:${REL}`, { encoding: 'utf8', maxBuffer: 1 << 26 }))

const baseNote = blob(BASE_REV).tests.note
const finalNote = JSON.parse(fs.readFileSync(TREE + '/' + REL, 'utf8')).tests.note

let ok = true
console.log(`BASE ${BASE_REV} noteLen=${baseNote.length}`)
console.log(`FINAL noteLen=${finalNote.length}`)
console.log(`FINAL headIsBasePrefix=${finalNote.startsWith(baseNote)}`)
if (!finalNote.startsWith(baseNote)) ok = false

let prevIdx = baseNote.length
for (const [tag, rev] of SOURCES) {
  const src = blob(rev).tests.note
  const seg = src.slice(baseNote.length)
  const idx = finalNote.indexOf(seg)
  const count = finalNote.split(seg).length - 1
  const orderOk = idx >= prevIdx
  console.log(
    `SEG ${tag.padEnd(5)} ${rev.slice(0, 8)} segLen=${String(seg.length).padStart(4)} ` +
      `foundAt=${idx} occurrences=${count} afterPrevSeg=${orderOk} ` +
      `verbatimInSource=${src.endsWith(seg)} head=${JSON.stringify(seg.slice(0, 18))}`
  )
  if (idx === -1 || count !== 1 || !orderOk || !src.endsWith(seg)) ok = false
  if (idx !== -1) prevIdx = idx + seg.length
}

const ledger = finalNote.slice(prevIdx)
console.log(`LEDGER tailLen=${ledger.length} head=${JSON.stringify(ledger.slice(0, 30))}`)
console.log(`ORDER ${SOURCES.map((s) => s[0]).join(' → ')} 逐段在册且互不重叠`)
console.log(`VERIFY_NOTE_SEGMENTS=${ok ? 'PASS' : 'FAIL'}`)
process.exit(ok ? 0 : 1)
