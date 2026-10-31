#!/usr/bin/env node
/** 校验构建产物：旧值残留定位 + 新令牌是否被正确引用 */
import fs from 'node:fs'
import path from 'node:path'

const ASSETS = path.join('saas-admin', 'dist', 'assets')
const cssFiles = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.css'))
const jsFiles = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js'))

console.log('═══ 构建产物校验（TOTAL-SAAS-UI-TOKENS-01）═══')

// 1) 全局 CSS 里旧值残留定位
const global = cssFiles.find((f) => f.startsWith('index-'))
const g = fs.readFileSync(path.join(ASSETS, global), 'utf8')
for (const c of ['#1a1a2e', '#6b7280', '#f5f7fa']) {
  const idxs = []
  let i = -1
  while ((i = g.indexOf(c, i + 1)) !== -1) idxs.push(i)
  console.log(`\n旧值 ${c} 在 ${global} 出现 ${idxs.length} 次`)
  for (const p of idxs) {
    console.log('   上下文：…' + g.slice(Math.max(0, p - 110), p + 40).replace(/\s+/g, ' ') + '…')
  }
}

// 2) 新增令牌是否被引用（JS 产物里应出现 var(--color-star)）
const starJs = jsFiles.filter((f) => fs.readFileSync(path.join(ASSETS, f), 'utf8').includes('--color-star'))
console.log(`\n引用 --color-star 的 JS chunk：${starJs.length ? starJs.join(', ') : '（无）'}`)

// 3) 改造后的 var() 引用抽查
const probes = ['var(--text-muted)', 'var(--bg-soft)', 'var(--text-inverse)', 'var(--color-star)', 'var(--radius-xs)', 'var(--shadow-md)']
console.log('\n—— 新令牌在 JS chunk 中的引用次数 ——')
for (const p of probes) {
  let n = 0
  for (const f of jsFiles) n += (fs.readFileSync(path.join(ASSETS, f), 'utf8').match(new RegExp(p.replace(/[()]/g, '\\$&'), 'g')) || []).length
  console.log(`  ${p.padEnd(22)} ${n}`)
}
