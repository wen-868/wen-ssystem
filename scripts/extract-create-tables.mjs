// 从 docs/migrations 提取指定表的 CREATE TABLE 语句，生成补建 SQL（跳过 DROP/ALTER，只取 CREATE）
// 用法: node scripts/extract-create-tables.mjs <缺表清单文件> <输出SQL>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const repo = process.cwd()
const [,, listFile, outFile] = process.argv
if (!listFile || !outFile) {
  console.log('用法: node scripts/extract-create-tables.mjs <缺表清单.txt> <输出.sql>')
  process.exit(1)
}

const wanted = readFileSync(listFile, 'utf8')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter((s) => s.startsWith('t_'))

const migrationsDir = join(repo, 'docs/migrations')
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

const found = new Map()
for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8')
  const stmts = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const stmt of stmts) {
    const m = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*\(/i)
    if (m && wanted.includes(m[1].toLowerCase())) {
      if (!found.has(m[1])) {
        // 移除外键约束（与项目建表风格一致：无 FK，避免建表顺序/类型依赖导致失败）
        let clean = stmt.replace(/,?\s*CONSTRAINT\s+`?[a-zA-Z0-9_]+`?\s+FOREIGN\s+KEY\s*\([^)]*\)\s*REFERENCES[^,)]*/gi, '')
        clean = clean.replace(/,?\s*FOREIGN\s+KEY\s*\([^)]*\)\s*REFERENCES[^,)]*/gi, '')
        // 幂等：CREATE TABLE → CREATE TABLE IF NOT EXISTS
        clean = clean.replace(/CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ')
        found.set(m[1], clean)
      }
    }
  }
}

const missing = wanted.filter((t) => !found.has(t))
const output = []
output.push('-- 自动生成的缺表补建 SQL（' + new Date().toISOString() + '）')
output.push('-- 共找到 ' + found.size + ' 张缺表的 CREATE TABLE，未找到 ' + missing.length + ' 张：' + missing.join(', '))
output.push('SET NAMES utf8mb4;')
for (const [, stmt] of found) {
  output.push('\n' + stmt + ';')
}
writeFileSync(outFile, output.join('\n'), 'utf8')
console.log('已生成: ' + outFile)
console.log('找到 ' + found.size + ' 张，未找到: ' + (missing.join(', ') || '无'))
