// 从迁移 DDL 提取缺列类型，生成 ALTER TABLE ADD COLUMN SQL
// 用法: node scripts/extract-alter-columns.mjs <缺列清单.txt(每行: 表名 列名)> <输出.sql>
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const repo = process.cwd()
const [,, listFile, outFile] = process.argv
if (!listFile || !outFile) {
  console.log('用法: node scripts/extract-alter-columns.mjs <缺列清单.txt> <输出.sql>')
  process.exit(1)
}

const wanted = readFileSync(listFile, 'utf8')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0)
  .map((s) => {
    const [table, col] = s.split(/\s+/)
    return { table: table.toLowerCase(), col: col.toLowerCase() }
  })

const files = []
const initFile = join(repo, 'docs', 'init_database.sql')
if (existsSync(initFile)) files.push(initFile)
for (const f of readdirSync(join(repo, 'docs/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  files.push(join(repo, 'docs/migrations', f))
}

const defs = new Map() // "table.col" -> 列定义片段
for (const f of files) {
  const sql = readFileSync(f, 'utf8')
  // CREATE TABLE 块内列定义
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\(([\s\S]*?)\)\s*ENGINE\s*=/gi
  let m
  while ((m = createRe.exec(sql))) {
    const table = m[1].toLowerCase()
    const body = m[2]
    const colRe = /`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\([^)]*\))?(?:[^,]*?)(?=,|\n)/g
    let cm
    while ((cm = colRe.exec(body))) {
      const col = cm[1].toLowerCase()
      if (['primary', 'unique', 'index', 'key', 'constraint', 'fulltext', 'foreign'].includes(col)) continue
      const key = `${table}.${col}`
      if (!defs.has(key)) defs.set(key, cm[0].trim())
    }
  }
  // ALTER TABLE ADD COLUMN
  const alterRe = /ALTER\s+TABLE\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s+ADD\s+COLUMN\s+([^;]+?)(?:,|;)/gi
  while ((m = alterRe.exec(sql))) {
    const table = m[1].toLowerCase()
    const colDef = m[2].trim()
    const colM = colDef.match(/`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
    if (!colM) continue
    const col = colM[1].toLowerCase()
    const key = `${table}.${col}`
    if (!defs.has(key)) defs.set(key, colDef)
  }
}

const output = ['-- 缺列补建 SQL（' + new Date().toISOString() + '）', 'SET NAMES utf8mb4;']
const missing = []
for (const { table, col } of wanted) {
  const def = defs.get(`${table}.${col}`)
  if (def) {
    output.push(`ALTER TABLE ${table} ADD COLUMN ${def.replace(/\s+/g, ' ').replace(/,\s*$/, '')};`)
  } else {
    missing.push(`${table}.${col}`)
  }
}
writeFileSync(outFile, output.join('\n'), 'utf8')
console.log('已生成: ' + outFile + '（' + (output.length - 2) + ' 条 ALTER）')
console.log('未找到类型定义: ' + (missing.join(', ') || '无'))
