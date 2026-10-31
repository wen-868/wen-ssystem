#!/usr/bin/env node
/** 定位 index 产物中残留旧色的具体来源（我方 tokens.css 还是 element-plus） */
import fs from 'node:fs'
import path from 'node:path'

const f = path.join('saas-admin', 'dist', 'assets')
const global = fs.readdirSync(f).find((x) => x.startsWith('index-') && x.endsWith('.css'))
const s = fs.readFileSync(path.join(f, global), 'utf8')

for (const c of ['#6b7280', '#909399', '#F56C6C', '#ff9900', '#303133', '#409eff', '#C0C4CC', '#EBEEF5']) {
  let i = -1
  const hits = []
  while ((i = s.indexOf(c, i + 1)) !== -1) {
    const before = s.slice(Math.max(0, i - 70), i)
    const ctx = before.split(/[;{}]/).pop() || before
    hits.push(ctx.trim().slice(-60) + c)
  }
  console.log(`${c.padEnd(10)} ×${hits.length}`)
  hits.slice(0, 4).forEach((h) => console.log('        ' + h))
}
