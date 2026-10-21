/**
 * QODER-27 反测注入器（字节精确、单点、命中数闸门）
 * 用法：node inject.cjs inject --file <abs> --old <literal> --new <literal>
 *      node inject.cjs verify --file <abs> --has <literal> [--not-has <literal>]
 *      node inject.cjs sha --file <abs>
 * 红线：hits !== 1 ⇒ exit(2) 且**不写盘**（防止"注入没落地却跑出红"被当成有效反测）。
 * 多行 needle 用 \\n 字面量传入（调用方负责）。
 */
const fs = require('node:fs')
const crypto = require('node:crypto')

const arg = (n) => {
  const i = process.argv.indexOf('--' + n)
  return i === -1 ? null : process.argv[i + 1]
}
const mode = process.argv[2]
const FILE = arg('file')
if (!FILE) {
  console.error('缺 --file')
  process.exit(2)
}
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')

if (mode === 'sha') {
  console.log(`SHA256 ${FILE} ${sha(FILE)}`)
  process.exit(0)
}

if (mode === 'verify') {
  const text = fs.readFileSync(FILE, 'latin1')
  const has = arg('has')
  const notHas = arg('not-has')
  const hits = has === null ? 0 : text.split(has).length - 1
  const notHits = notHas === null ? 0 : text.split(notHas).length - 1
  console.log(`VERIFY ${FILE}`)
  if (has !== null) console.log(`  has(${JSON.stringify(has)}) hits=${hits}`)
  if (notHas !== null) console.log(`  not-has(${JSON.stringify(notHas)}) hits=${notHits}`)
  // 从磁盘重读后的落盘回证：注入必须"看得见"，否则整轮作废
  if (has !== null && hits !== 1) {
    console.error('  ✗ 注入后磁盘上没有恰好 1 处新串 ⇒ 注入不完整，本轮读数作废')
    process.exit(2)
  }
  if (notHas !== null && notHits !== 0) {
    console.error('  ✗ 注入后磁盘上旧串仍未消失 ⇒ 注入不完整，本轮读数作废')
    process.exit(2)
  }
  console.log('  ✓ 磁盘回证通过')
  process.exit(0)
}

if (mode !== 'inject') {
  console.error(`未知 mode=${mode}`)
  process.exit(2)
}

const OLD = (arg('old') || '').replace(/\\n/g, '\n')
const NEW = (arg('new') || '').replace(/\\n/g, '\n')
if (!OLD || !NEW) {
  console.error('缺 --old / --new')
  process.exit(2)
}

// latin1 读 + latin1 写 ⇒ 非 ASCII 字节与 CRLF/LF 形态原样保留，反测只动 needle
const text = fs.readFileSync(FILE, 'latin1')
const hits = text.split(OLD).length - 1
console.log(`INJECT ${FILE}`)
console.log(`  old=${JSON.stringify(OLD.slice(0, 60))} hits=${hits}`)
console.log(`  new=${JSON.stringify(NEW.slice(0, 60))}`)
if (hits !== 1) {
  console.error(`  ✗ 命中 ${hits} ≠ 1 ⇒ 拒写（歧义 needle 会让"红点名"失去唯一归因）`)
  process.exit(2)
}
fs.writeFileSync(FILE, text.replace(OLD, NEW), 'latin1')
console.log(`  written=true 新SHA=${sha(FILE)}`)
process.exit(0)
