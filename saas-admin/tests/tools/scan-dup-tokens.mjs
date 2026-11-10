#!/usr/bin/env node
/**
 * TOTAL-SAAS-UI-TOKENS-01 · baseline 端内重复定义全量扫描（复核 freeze-scan §3）
 * 口径与 _n1_scan3 一致：--name: 形式计定义，var() 引用不计；排除 --el-*（EP 覆盖属预期）
 * 用法：node <脚本> [仓库根的 saas-admin/src]
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = process.argv[2] || 'saas-admin/src'
const files = []
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|dist|\.git|unpackage/.test(e.name)) walk(p) }
    else if (/\.(vue|css|scss)$/.test(e.name)) files.push(p)
  }
}
walk(SRC)

/** 剥注释后再找定义，避免注释里的示例误计 */
function strip(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{(])(\/\/[^\n]*)/g, (_m, a, b) => a + b.replace(/./g, ' '))
}

/** defs: Map<token, Array<{file,line,value}>> */
const defs = new Map()
for (const f of files) {
  const rel = f.split(path.sep).join('/')
  const src = strip(fs.readFileSync(f, 'utf8'))
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)/g)) {
      const name = m[1]
      if (name.startsWith('--el-')) continue // EP 命名空间，覆盖属预期
      if (!defs.has(name)) defs.set(name, [])
      defs.get(name).push({ file: rel, line: i + 1, value: m[2].trim().slice(0, 60) })
    }
  })
}

const dup = []
for (const [name, list] of defs) {
  if (list.length > 1) {
    const values = new Set(list.map((x) => x.value.toLowerCase().replace(/\s+/g, '')))
    dup.push({ name, count: list.length, conflict: values.size > 1, list })
  }
}
const conflict = dup.filter((d) => d.conflict)
console.log(`扫描 ${files.length} 个文件，自有令牌定义 ${[...defs.keys()].length} 个`)
console.log(`同名多次定义: ${dup.length} 个｜其中取值不同（真冲突）: ${conflict.length} 个\n`)
console.log('═══ 真冲突明细 ═══')
for (const d of conflict) {
  console.log(`${d.name}（${d.count} 处）`)
  d.list.forEach((x) => console.log(`    ${x.file}:${x.line} = ${x.value}`))
}
console.log('\n═══ 同值重复（可安全去重）═══')
for (const d of dup.filter((x) => !x.conflict)) {
  console.log(`${d.name} ×${d.count} → ${d.list.map((x) => `${x.file}:${x.line}`).join(', ')}`)
}
