#!/usr/bin/env node
/**
 * MOBILE-28F1 · 微信小程序（WXSS）通配选择器守卫
 *
 * 背景（为什么需要）：微信 WXSS 不支持 `*` 通配选择器（含 `*::before` / `*::after` /
 * 后代式 `.scope *`），命中会让 preview 报 `unexpected token '*'` 并**阻断预览**。
 * 仓内为 H5 写的全局 box-sizing / prefers-reduced-motion 修复正是这种形态，
 * 必须用 uni 样式级条件编译 `/* #ifndef MP-WEIXIN *\/ ... /* #endif *\/` 把 MP 侧隔掉，
 * **保留 H5 行为**（不能直接删规则）。
 *
 * 三个模式：
 *   --src                扫源码（src/**\/*.vue 的 style 块 + *.scss / *.css）
 *                        只报**未被条件编译隔离**的通配 prelude ⇒ 会进 MP 产物 ⇒ 判红
 *   --dist <目录>        扫构建产物 *.wxss 的通配 prelude ⇒ 命中即判红（硬验收 2）
 *   --self-test          自检正对照：注入一条 `*` 规则必须被扫出、干净样本必须 0 命中
 *                        （证明扫描器**有分辨力**，不是恒绿；AGENTS.md 门禁铁律）
 *
 * 退出码：0 = 无命中 / 自检通过；1 = 有命中 / 自检失败。
 */
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_MOBILE = resolve(HERE, '..')
const SRC_ROOT = join(APP_MOBILE, 'src')

/* ───────────── CSS 规则 prelude 扫描（源码与压缩产物共用）───────────── */

/** 把 /* ... *\/ 注释替换为等长空白（保留换行 ⇒ 行号不漂移） */
function blankComments(css) {
  let out = ''
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const seg = end === -1 ? css.slice(i) : css.slice(i, end + 2)
      out += seg.replace(/[^\n]/g, ' ')
      if (end === -1) break
      i += seg.length - 1
    } else out += css[i]
  }
  return out
}

/**
 * 找出所有「规则选择器（prelude）里含 `*`」的位置。
 * 判定：每个 `{` 的 prelude **只取紧邻的最后一个段**（`}`/`;`/`{` 之后的文本）——
 *   否则嵌套块会把外层选择器重复计入内层（自检阴性对照曾因此假红）。
 *   prelude 以 `@` 开头（`@media` / `@supports` / `@keyframes`）不是选择器，跳过；
 *   `@keyframes` 的 `from` / `NN%` 步骤也不是选择器，跳过；空 prelude 跳过。
 *   这样 `@media (prefers-reduced-motion: reduce){ *,... {...} }` 的内层照样能扫出。
 */
const KEYFRAME_STEP = /^(from|to|\d+(\.\d+)?%|[\d.]+%)$/
export function findStarPreludes(css, lineOffset = 0) {
  const text = blankComments(css)
  const hits = []
  let buf = ''
  let bufLine = 1 + lineOffset
  let line = 1 + lineOffset
  let pending = true
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\n') { line++; buf += ch; continue }
    if (ch === '{' || ch === '}' || ch === ';') {
      if (ch === '{') {
        const prelude = buf.trim().replace(/\s+/g, ' ')
        if (prelude && !prelude.startsWith('@') && !KEYFRAME_STEP.test(prelude) && prelude.includes('*')) {
          hits.push({ line: bufLine, prelude: prelude.slice(0, 160) })
        }
      }
      buf = ''
      pending = true // 行号改由"下一个非空白字符"确定（避免注释导致的行号偏移）
      continue
    }
    if (pending && !/\s/.test(ch)) { bufLine = line; pending = false }
    buf += ch
  }
  return hits
}

/* ───────────── uni 样式级条件编译：判断某段是否被 MP-WEIXIN 隔离 ───────────── */

const MP_TOKENS = new Set(['MP-WEIXIN', 'MP'])

/**
 * 逐行扫描条件编译标记，返回**屏蔽区间**行号集合（1-based，相对 style 文本）。
 * 屏蔽 = 该段代码不会进入微信小程序产物：
 *   `/* #ifndef MP-WEIXIN *\/` 或 `/* #ifndef MP *\/`   ⇒ MP 侧被排除
 *   `/* #ifdef H5 *\/` / `/* #ifdef APP-PLUS *\/` 等     ⇒ 仅其它平台，MP 不编译
 * 反向 `/* #ifdef MP-WEIXIN *\/` 内的规则**会**进 MP ⇒ 不屏蔽。
 */
function mpBlockedLineRanges(styleText) {
  const lines = styleText.split(/\r?\n/)
  const blocked = []
  const stack = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\/\*\s*#(ifdef|ifndef|endif)\s*(.*?)\s*\*\//)
    if (!m) continue
    const kind = m[1]
    const ln = i + 1
    if (kind === 'endif') {
      const top = stack.pop()
      if (top && top.blocked) blocked.push([top.openLine, ln])
      continue
    }
    const tokens = m[2].split(/&&|\|\|/).map((s) => s.trim().replace(/^!/, '')).filter(Boolean)
    const touchesMp = tokens.some((t) => MP_TOKENS.has(t))
    const isNegatedMp = /!\s*(MP-WEIXIN|MP)\b/.test(m[2])
    let blocks
    if (kind === 'ifndef') blocks = touchesMp && !isNegatedMp
    else blocks = !touchesMp // ifdef 且条件不涉及 MP ⇒ MP 不编译该段
    stack.push({ openLine: ln, blocked: blocks })
  }
  return blocked
}

const inRanges = (blocked, line) => blocked.some(([a, b]) => line > a && line < b)

/* ───────────── 源码扫描 ───────────── */

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name.startsWith('.')) continue
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

export function scanSource(root = SRC_ROOT) {
  const findings = []
  for (const file of walk(root)) {
    if (!/\.(vue|scss|css)$/.test(file)) continue
    const raw = readFileSync(file, 'utf8')
    const blocks = [] // { text, lineOffset }
    if (file.endsWith('.vue')) {
      const re = /<style[^>]*>([\s\S]*?)<\/style>/g
      let m
      while ((m = re.exec(raw))) {
        const startLine = raw.slice(0, m.index + m[0].indexOf('>', 0) + 1).split(/\r?\n/).length
        blocks.push({ text: m[1], lineOffset: startLine - 1, absStart: startLine })
      }
    } else blocks.push({ text: raw, lineOffset: 0, absStart: 1 })

    for (const b of blocks) {
      const hits = findStarPreludes(b.text, b.lineOffset)
      if (!hits.length) continue
      const blocked = mpBlockedLineRanges(b.text)
      for (const h of hits) {
        const rel = h.line - b.lineOffset
        findings.push({
          file: relative(root, file).replace(/\\/g, '/'),
          line: h.line,
          prelude: h.prelude,
          guarded: inRanges(blocked, rel)
        })
      }
    }
  }
  return findings
}

/* ───────────── 产物扫描 ───────────── */

export function scanDist(distDir) {
  const hits = []
  for (const file of walk(distDir)) {
    if (!file.endsWith('.wxss')) continue
    const css = readFileSync(file, 'utf8')
    for (const h of findStarPreludes(css)) {
      hits.push({ file: relative(distDir, file).replace(/\\/g, '/'), prelude: h.prelude })
    }
  }
  return hits
}

/* ───────────── 自检（正对照 + 阴性对照）───────────── */

export function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'mp-star-selftest-'))
  try {
    writeFileSync(join(dir, 'probe.wxss'), '.injected-probe *,.injected-probe *::before{color:red}')
    writeFileSync(join(dir, 'clean.wxss'), '.clean-probe{color:red}.clean-probe .child,:hover{color:blue}')
    writeFileSync(join(dir, 'media.wxss'), '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important}}')
    writeFileSync(join(dir, 'kf.wxss'), '@keyframes a{from{opacity:0}to{opacity:1}}')
    const byFile = (f) => scanDist(dir).filter((h) => h.file === f)
    const positive = byFile('probe.wxss')
    const negative = byFile('clean.wxss')
    const mediaHits = byFile('media.wxss')
    const kfHits = byFile('kf.wxss')
    const atOnlyHits = findStarPreludes('@media (min-width:1px){ .a{color:red} }')
    return {
      // 正对照必红（≥1）、干净样本必 0、@media 内层通配必须检到、@keyframes 步骤不误报
      ok: positive.length >= 1 && negative.length === 0 && mediaHits.length === 1 && kfHits.length === 0 && atOnlyHits.length === 0,
      positiveHits: positive.length,
      negativeHits: negative.length,
      mediaInnerHits: mediaHits.length,
      keyframeFalseHits: kfHits.length,
      atOnlyHits: atOnlyHits.length
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* ───────────── CLI ───────────── */

/** 源码扫描模式（无参默认）：只报**未隔离**的通配 prelude ⇒ 会进 MP 产物即判红 */
function srcMode() {
  const findings = scanSource()
  const unguarded = findings.filter((f) => !f.guarded)
  console.log(`源码通配 prelude：命中 ${findings.length} 处 / 未隔离 ${unguarded.length} 处（已隔离=有 /* #ifndef MP-WEIXIN */ 等包裹，不进 MP 产物）`)
  for (const f of findings) console.log(`${f.guarded ? '✓ 已隔离' : '✗ 未隔离'} ${f.file}:${f.line}  ⇒  ${f.prelude}`)
  console.log(unguarded.length === 0 ? 'MP_STAR_GUARD_SRC_PASS' : 'MP_STAR_GUARD_SRC_FAIL')
  process.exit(unguarded.length === 0 ? 0 : 1)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    const r = selfTest()
    console.log('self-test:', JSON.stringify(r))
    console.log(r.ok ? 'MP_STAR_GUARD_SELF_TEST_PASS（注入必红 / 干净必 0 / @media 内层可检 / @规则不误报）' : 'MP_STAR_GUARD_SELF_TEST_FAIL')
    process.exit(r.ok ? 0 : 1)
  }
  if (args.includes('--src')) srcMode()
  const di = args.indexOf('--dist')
  if (di !== -1) {
    const distDir = resolve(args[di + 1])
    const hits = scanDist(distDir)
    console.log(`MP 产物通配 prelude（${relative(APP_MOBILE, distDir).replace(/\\/g, '/')}）：命中 ${hits.length} 处`)
    for (const h of hits) console.log(`✗ ${h.file}  ⇒  ${h.prelude}`)
    console.log(hits.length === 0 ? 'MP_STAR_GUARD_DIST_PASS' : 'MP_STAR_GUARD_DIST_FAIL')
    process.exit(hits.length === 0 ? 0 : 1)
  }
  // 无参数 ⇒ 默认 --src（源码扫描，无需构建产物；供 npm run guard:mp-style 直接调用）
  if (args.length === 0) return srcMode()
  console.log('用法：node scripts/guard-mp-style-selectors.mjs [--src] | --dist <wxss目录> | --self-test')
  process.exit(2)
}

const selfPath = resolve(fileURLToPath(import.meta.url))
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === selfPath) main()
