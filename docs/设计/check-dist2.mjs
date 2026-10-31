#!/usr/bin/env node
/** 补充校验：CSS 产物内的令牌引用 + 旧值大小写不敏感全量扫描 */
import fs from 'node:fs'
import path from 'node:path'

const ASSETS = path.join('saas-admin', 'dist', 'assets')
const cssFiles = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.css'))

console.log('═══ CSS 产物令牌引用校验 ═══')
const probes = ['var(--text-inverse)', 'var(--shadow-md)', 'var(--radius-pill)', 'var(--border-normal)', 'var(--text-secondary)', 'var(--color-success)', 'var(--color-danger)', 'var(--gray-300)', 'var(--border-light)', 'var(--text-primary)', 'var(--bg-page)']
for (const p of probes) {
  const hits = []
  for (const f of cssFiles) {
    const s = fs.readFileSync(path.join(ASSETS, f), 'utf8')
    const n = (s.match(new RegExp(p.replace(/[()]/g, '\\$&'), 'g')) || []).length
    if (n) hits.push(`${f}×${n}`)
  }
  console.log(`  ${p.padEnd(24)} 共 ${hits.length ? hits.join(' , ') : '0'}`)
}

console.log('\n═══ 旧 Element 色板在全部产物（css+js）中的残留 ═══')
const all = [...cssFiles, ...fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js'))]
const legacy = ['#909399', '#606266', '#303133', '#409eff', '#e4e7ed', '#F56C6C', '#EBEEF5', '#C0C4CC', '#ff9900', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280', '#1a1a2e']
for (const c of legacy) {
  const where = []
  for (const f of all) {
    const s = fs.readFileSync(path.join(ASSETS, f), 'utf8')
    const n = (s.match(new RegExp(c, 'gi')) || []).length
    if (n) where.push(`${f}×${n}`)
  }
  console.log(`  ${c.padEnd(10)} ${where.length ? where.join(' , ') : '✅ 0'}`)
}
