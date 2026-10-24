import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const BK = 'D:/Users/ZXQL/wt-agents/MOBILE-32/backend/src/routes'

function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (p.endsWith('.ts') && !p.includes('__tests__')) out.push(p)
  }
  return out
}

// 逐路由文件抽取 requirePermission 码 + 该文件挂载路径前缀线索
const rows = []
for (const f of walk(BK)) {
  const txt = readFileSync(f, 'utf8')
  const base = f.split(/[\\/]/).pop()
  const codes = [...txt.matchAll(/requirePermission\(\s*['"]([a-z][a-z:*]+)['"]/g)].map((m) => m[1])
  if (!codes.length) continue
  // 抓 router 变量名与挂载前缀（常见形态：xxxRouter 或 routeConfig.pathPrefix）
  const prefixes = [...txt.matchAll(/['"](\/[a-z0-9\-/:._]+)['"]/g)].map((m) => m[1])
  rows.push({ file: base, codes: [...new Set(codes)], prefixes: [...new Set(prefixes)].slice(0, 6) })
}

console.log('=== 有权限码的路由文件（' + rows.length + '）===')
for (const r of rows.sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`${r.file.padEnd(42)} ${r.codes.join(',')}`)
}

console.log('')
console.log('=== 码 → 文件 反查（供矩阵取码用）===')
const byCode = new Map()
for (const r of rows) for (const c of r.codes) {
  if (!byCode.has(c)) byCode.set(c, [])
  byCode.get(c).push(r.file)
}
for (const [c, files] of [...byCode.entries()].sort()) {
  console.log(`${c.padEnd(24)} ${files.length} 文件: ${files.join(', ')}`)
}
