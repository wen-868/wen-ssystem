#!/usr/bin/env node
/** 诊断 C1/D1 失败详情（一次性，结果将回填契约测试的豁免/修正） */
const fs = require('node:fs')
const path = require('node:path')
const SRC = path.resolve('saas-admin/src')

function strip(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{(])(\/\/[^\n]*)/g, (_m, a, b) => a + b.replace(/./g, ' '))
}
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|dist/.test(e.name)) walk(p, out) }
    else if (/\.(vue|css|scss|ts)$/.test(e.name)) out.push(p)
  }
  return out
}
const rel = (p) => path.relative(SRC, p).split(path.sep).join('/')
const files = walk(SRC)

// 预计算：每文件 defs + 注入
const fileDefs = new Map()
const fileInjected = new Map()
for (const f of files) {
  const defs = new Map()
  strip(fs.readFileSync(f, 'utf8')).split('\n').forEach((line) => {
    for (const m of line.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)/g)) {
      if (!defs.has(m[1])) defs.set(m[1], [])
      defs.get(m[1]).push(m[2].trim())
    }
  })
  fileDefs.set(f, defs)
  const inj = new Set()
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"](--[A-Za-z0-9_-]+)['"]\s*:|setProperty\(\s*['"](--[A-Za-z0-9_-]+)['"]/g)) inj.add(m[1] || m[2])
  fileInjected.set(f, inj)
}
const tokensFile = path.join(SRC, 'styles', 'tokens.css')
const tokenNames = [...fileDefs.get(tokensFile).keys()]

console.log('═══ C1 violations（tokens.css 中每个自有令牌的定义次数）═══')
for (const name of tokenNames) {
  if (name.startsWith('--el-')) continue
  const sites = []
  for (const [f, defs] of fileDefs) {
    if (defs.has(name)) for (const v of defs.get(name)) sites.push(`${rel(f)} = ${v}`)
  }
  if (sites.length !== 1) console.log(`${name} ×${sites.length}\n    ${sites.join('\n    ')}`)
}

console.log('\n═══ D1 missing（var() 引用无定义）═══')
const defined = new Set(tokenNames)
for (const [, defs] of fileDefs) for (const n of defs.keys()) defined.add(n)
const missing = new Set()
for (const [f, inj] of fileInjected) for (const n of inj) defined.add(n)
for (const f of files) {
  const src = strip(fs.readFileSync(f, 'utf8'))
  for (const m of src.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
    if (!defined.has(m[1])) missing.add(`${m[1]} @ ${rel(f)}`)
  }
}
for (const m of missing) console.log('  ' + m)
if (!missing.size) console.log('  （无）')
