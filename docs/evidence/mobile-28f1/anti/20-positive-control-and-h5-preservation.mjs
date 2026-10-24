/**
 * MOBILE-28F1 · 控制验证（正对照 + 真实产物 + H5 行为保留 + 源码隔离自证）
 *
 * 对应卡 §三 硬验收 2「MP 产物 `*` 通配 prelude = 0；正对照注入后扫描必红」与
 * 硬验收 3「H5 原有 box-sizing / reduced-motion 行为仍保留」。
 *
 * 为什么需要 A：只报"命中 0"无法排除"扫描器失灵导致的假绿"（AGENTS.md 门禁铁律）。
 *   ⇒ A 把真实 MP 产物**复制到临时目录**后注入一条 `*` 规则，同一扫描器必须报红；
 *     真实产物目录本身**不写入**，避免污染构建产物。
 * 为什么需要 D：证明 H5 侧规则没有被删，只是被 `/* #ifndef MP-WEIXIN *\/` 隔掉
 *   （红线「不直接删除 H5 修复规则」）。
 *
 * 用法：node docs/evidence/mobile-28f1/anti/20-positive-control-and-h5-preservation.mjs
 * 退出码：0 = 四组控制全部符合预期；1 = 任一不符。
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { join, resolve, relative, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { scanDist, scanSource } from '../../../../app-mobile/scripts/guard-mp-style-selectors.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// anti/ → mobile-28f1/ → evidence/ → docs/ → 工作树根 → app-mobile
const APP = resolve(join(HERE, '../../../../app-mobile'))
const MP_DIST = join(APP, 'dist/build/mp-weixin')
const H5_DIST = join(APP, 'dist/build/h5')

let fail = 0
const say = (s) => console.log(s)

/* ── A) 正对照：注入必须被扫出（在临时副本上，不动真实产物） ── */
const tmp = mkdtempSync(join(tmpdir(), 'm28f1-positive-control-'))
try {
  const original = readFileSync(join(MP_DIST, 'app.wxss'), 'utf8')
  writeFileSync(join(tmp, 'app.wxss'), original + '\n.injected-positive-control-28f1 *{color:red}\n')
  const after = scanDist(tmp)
  say('A) 正对照注入（临时副本 ' + tmp + '；真实产物未写入）')
  say('   注入后命中 = ' + after.length)
  for (const h of after) say('   ✗ ' + h.file + '  ⇒  ' + h.prelude)
  const ok = after.length >= 1 && after.some((h) => /injected-positive-control-28f1/.test(h.prelude))
  say('   判定 = ' + (ok ? 'PASS（注入即被扫出 ⇒ 扫描器有分辨力，非恒绿）' : 'FAIL（扫描器失灵）'))
  if (!ok) fail++

  /* ── B) 真实 MP 产物必须 0 命中 ── */
  const real = scanDist(MP_DIST)
  say('')
  say('B) 真实 MP 产物扫描（' + relative(APP, MP_DIST) + '）')
  say('   命中 = ' + real.length)
  for (const h of real) say('   ✗ ' + h.file + '  ⇒  ' + h.prelude)
  say('   判定 = ' + (real.length === 0 ? 'PASS（`*` 通配 prelude = 0）' : 'FAIL'))
  if (real.length !== 0) fail++
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

/* ── C) H5 行为保留（逐规则解析；压缩器会把 `::before` 写成 `:before`，不得按字面匹配） ── */
say('')
say('C) H5 产物行为保留（硬验收 3）')
function walkCss(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walkCss(p, out)
    else if (p.endsWith('.css')) out.push(p)
  }
  return out
}
const cssFiles = walkCss(H5_DIST)
const boxHits = [], rmHits = [], csHits = [], formHits = []
for (const f of cssFiles) {
  const c = readFileSync(f, 'utf8')
  for (const seg of c.split('}')) {
    const i = seg.lastIndexOf('{')
    if (i < 0) continue
    const pre = seg.slice(0, i).trim()
    const body = seg.slice(i + 1)
    if (pre.includes('*') && /box-sizing:\s*border-box/.test(body)) boxHits.push(relative(H5_DIST, f).replace(/\\/g, '/') + '  |  ' + pre.slice(0, 60))
    if (/prefers-reduced-motion/.test(pre) && /transition-duration/.test(body)) rmHits.push(relative(H5_DIST, f).replace(/\\/g, '/'))
    if (/\.create-sale-page\s?\*/.test(pre) && /transition-duration/.test(body)) csHits.push(relative(H5_DIST, f).replace(/\\/g, '/'))
  }
  if (/uni-form\s*\{\s*display:\s*block/.test(c)) formHits.push(relative(H5_DIST, f).replace(/\\/g, '/'))
}
say('   扫描 H5 CSS 文件数 = ' + cssFiles.length)
say('   ① 全局 box-sizing 通配块（prelude 含 *）：' + (boxHits.length ? 'PRESENT ×' + boxHits.length : 'MISSING'))
for (const h of boxHits) say('      · ' + h)
say('   ② @media (prefers-reduced-motion) 带 transition 降级：' + (rmHits.length ? 'PRESENT → ' + [...new Set(rmHits)].join(', ') : 'MISSING'))
say('   ③ create-sale 页 .create-sale-page * 降级：' + (csHits.length ? 'PRESENT → ' + [...new Set(csHits)].join(', ') : 'MISSING'))
say('   ④ uni-form display:block（同批 H5 修复，须一并保留）：' + (formHits.length ? 'PRESENT → ' + [...new Set(formHits)].join(', ') : 'MISSING'))
if (!(boxHits.length && rmHits.length && csHits.length && formHits.length)) { fail++; say('   判定 = FAIL（H5 行为被削弱）') }
else say('   判定 = PASS（H5 四处行为全部保留，未删规则）')

/* ── D) 源码规则未删除 + 已被守卫判为"MP 侧隔离"（复用守卫判定，不另写正则） ── */
say('')
say('D) 源码规则未删除 + 已被条件编译隔离')
const srcFindings = scanSource(join(APP, 'src'))
say('   守卫在源码里扫到的通配 prelude 共 ' + srcFindings.length + ' 处：')
for (const f of srcFindings) say('   ' + (f.guarded ? '✓ 已隔离' : '✗ 未隔离') + ' ' + f.file + ':' + f.line + '  ⇒  ' + f.prelude.slice(0, 70))
const appVue = readFileSync(join(APP, 'src/App.vue'), 'utf8')
const csVue = readFileSync(join(APP, 'src/pages/sales/create-sale.vue'), 'utf8')
const checks = [
  ['App.vue box-sizing 规则文本仍在（未删）', /box-sizing: border-box/.test(appVue)],
  ['App.vue 全局 reduced-motion 规则文本仍在', /@media \(prefers-reduced-motion: reduce\)/.test(appVue)],
  ['create-sale.vue 页级 reduced-motion 规则文本仍在', /\.create-sale-page \*/.test(csVue)],
  ['源码全部通配被守卫判为已隔离', srcFindings.length > 0 && srcFindings.every((f) => f.guarded)]
]
for (const [name, ok] of checks) { say('   ' + (ok ? '✓' : '✗') + ' ' + name); if (!ok) fail++ }

say('')
say(fail === 0 ? 'MOBILE_28F1_CONTROLS_PASS' : 'MOBILE_28F1_CONTROLS_FAIL（' + fail + ' 项不符）')
process.exit(fail === 0 ? 0 : 1)
