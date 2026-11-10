#!/usr/bin/env node
/**
 * TOTAL-SAAS-UI-TOKENS-01 · before/after 截图像素 diff
 * 判据（验收卡 §四.3）：除目标修正（文字加深 / 页面底微调）外无语义视觉漂移。
 *   · diff 像素占比高 ⇒ 预期内（全站文字色变化本来就是大面积的）
 *   · 关键是 diff 的**色相构成**：应只有「文字变深」与「底色微调」两类，
 *     不应出现布局错位（错位会造成大量结构性的形状差异）
 * 输出：evidence/diff-report.json + 每页 diff.png（红点标注）
 */
const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')

const CENTRAL = process.env.CENTRAL_ROOT || 'D:/Users/ZXQL/ZXQL-WORK'
const BASE = path.join(CENTRAL, 'projects', 'ms', 'evidence', 'TOTAL-SAAS-UI-TOKENS-01')
const PAGES = ['login', 'dashboard', 'tenants', 'subscriptions', 'tenant-usage', 'reviews']
const VPS = ['1440x1000', '1024x768']

const report = []
for (const vp of VPS) {
  for (const p of PAGES) {
    const a = PNG.sync.read(fs.readFileSync(path.join(BASE, 'before', vp, `${p}.png`)))
    const b = PNG.sync.read(fs.readFileSync(path.join(BASE, 'after', vp, `${p}.png`)))
    if (a.width !== b.width || a.height !== b.height) {
      report.push({ vp, page: p, error: '尺寸不同' })
      continue
    }
    const d = new PNG({ width: a.width, height: a.height })
    let diff = 0
    // 色相分类桶：文字加深(变暗) / 底色微调 / 其他
    let darker = 0, bgShift = 0, other = 0
    for (let i = 0; i < a.data.length; i += 4) {
      const dr = Math.abs(a.data[i] - b.data[i])
      const dg = Math.abs(a.data[i + 1] - b.data[i + 1])
      const db = Math.abs(a.data[i + 2] - b.data[i + 2])
      if (dr + dg + db > 12) {
        diff++
        d.data[i] = 255; d.data[i + 1] = 0; d.data[i + 2] = 0; d.data[i + 3] = 255
        // 分类：整体变暗 → 文字加深；整体轻微变亮(±10 内灰阶微移) → 底色修正
        const sumA = a.data[i] + a.data[i + 1] + a.data[i + 2]
        const sumB = b.data[i] + b.data[i + 1] + b.data[i + 2]
        if (sumB < sumA) darker++
        else if (Math.abs(sumB - sumA) <= 30) bgShift++
        else other++
      } else {
        const v = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3
        d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255
      }
    }
    const total = (a.width * a.height)
    const pct = ((diff / total) * 100).toFixed(3)
    fs.writeFileSync(path.join(BASE, `diff-${vp}-${p}.png`), PNG.sync.write(d))
    report.push({
      vp, page: p,
      diffPixels: diff, totalPixels: total, diffPct: pct + '%',
      分类: { 文字变暗: darker, 底色微调: bgShift, 其他需人工排查: other },
    })
    console.log(`${vp} ${p.padEnd(14)} diff=${pct}%  文字变暗=${darker}  底色微调=${bgShift}  其他=${other}`)
  }
}
fs.writeFileSync(path.join(BASE, 'diff-report.json'), JSON.stringify(report, null, 2), 'utf8')
console.log('\n报告与 diff.png 已写入', BASE)
