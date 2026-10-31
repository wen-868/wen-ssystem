#!/usr/bin/env node
/**
 * 总后台（saas-admin）令牌与视觉漂移审计脚本 —— 林夕（总台界面与设计规范 owner）
 * 单号：TOTAL-SAAS-UI-TOKENS-01
 *
 * 审计维度：
 *   ① 未定义令牌引用  —— var(--x) 但 --x 在本文件或 tokens.css 中均无定义
 *   ② 硬编码色值      —— #hex / rgb() / rgba() / hsl()，绕过设计令牌
 *   ③ 硬编码圆角/阴影 —— border-radius / box-shadow 写死值
 *   ④ 与 admin-web 令牌漂移 —— 同名令牌取值不一致
 *
 * 已知误报防护（踩坑日志 [46]）：
 *   · 先剥离块注释 /* *\/ 与行注释 // 与 HTML 注释 <!-- -->，注释里的 var(--token) 说明文字不计
 *   · 令牌定义文件（tokens.css / tokens-*.css）自身不计硬编码（那里本来就是定义值的地方）
 *   · 允许白名单：scripts/allow.json（按 文件:行 或 值 豁免，需写明理由）
 *
 * 用法：node docs/设计/token-audit.mjs
 * 输出：控制台摘要 + docs/设计/token-audit-report.md
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SAAS = path.join(ROOT, 'saas-admin', 'src')
const TOKENS_FILE = path.join(SAAS, 'styles', 'tokens.css')
const ADMIN_WEB_TOKENS = path.join(ROOT, 'admin-web', 'src', 'styles', 'tokens.css')
const EXT = ['.vue', '.css', '.scss', '.ts']
const TOKEN_DEF_FILE_RE = /(^|\/)(tokens|theme)[^/]*\.css$/
/** 「令牌名 → 值」映射条目，如 "--chart-2": "#16a34a" */
const TOKEN_MAP_ENTRY_RE = /['"]--[A-Za-z0-9_-]+['"]\s*:\s*['"]?[#(r]/

/** 递归收集源文件 */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (EXT.includes(path.extname(e.name))) out.push(p)
  }
  return out
}

/** 剥离注释（块注释 / 行注释 / HTML 注释），保留行号：用等长空白替换 */
function stripComments(src) {
  let s = src
  s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  s = s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
  s = s.replace(/(^|[\s;{(])(\/\/[^\n]*)/g, (_m, a, b) => a + b.replace(/./g, ' '))
  return s
}

/** 解析令牌定义：返回 Map<name, {value, file}> */
function collectDefs(file) {
  const map = new Map()
  const src = stripComments(fs.readFileSync(file, 'utf8'))
  const re = /(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)[;}]/g
  let m
  while ((m = re.exec(src))) map.set(m[1], { value: m[2].trim(), file })
  return map
}

/**
 * 收集「运行时注入」的自定义属性名：
 *   · :style="{ '--kv-columns': columns }"   —— Vue 内联样式绑定
 *   · el.style.setProperty('--x', v)         —— JS 直接赋值
 * 这类变量不在 CSS 里声明，但在运行时一定会被注入，不应判为「未定义」。
 */
function collectInjected(src) {
  const set = new Set()
  const re = /['"](--[A-Za-z0-9_-]+)['"]\s*:|setProperty\(\s*['"](--[A-Za-z0-9_-]+)['"]/g
  let m
  while ((m = re.exec(src))) set.add(m[1] || m[2])
  return set
}

/**
 * 豁免名单 —— 设备外壳 / 插画 / 第三方组件内部样式，不属于主题令牌范畴
 * 规则：'相对路径' → 豁免行号集合；或 '*' 表示整文件豁免
 */
const EXEMPT = {
  // MobilePreview 模拟的是一部手机：机身、刘海、Home 指示条、音量键、屏幕
  // 其造型色（#1a1a1a 机身 / #333 home 条 / #000 / #fff）与异形圆角（36/44/28/24/14px）
  // 是「被模拟的硬件」，不是总后台主题，改令牌反而破坏拟真。
  'saas-admin/src/views/MobilePreview.vue': new Set([
    598, 599, 602, 603, 612, 618, 624, 636, 637, 646, 647, 658, 659,
    662, 687, 688, 695, 710, 718, 719, 730,
  ]),
  // 登录页背景 SVG 装饰插画：白色描边/填充属插画构成，非主题色
  'saas-admin/src/views/login/PlatformLogin.vue': new Set([7, 17, 27, 28]),
}

const files = walk(SAAS)
const globalDefs = fs.existsSync(TOKENS_FILE) ? collectDefs(TOKENS_FILE) : new Map()

const issues = { undefinedToken: [], hardColor: [], hardRadius: [], hardShadow: [] }

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  const src = stripComments(raw)
  const rel = path.relative(ROOT, file).split(path.sep).join('/')
  const isTokenFile = TOKEN_DEF_FILE_RE.test(rel)
  const localDefs = collectDefs(file)
  const injected = collectInjected(raw) // 用未剥注释原文：绑定写在模板/script 里
  const exempt = EXEMPT[rel] || null
  const lines = src.split('\n')

  lines.forEach((line, i) => {
    const ln = i + 1
    if (exempt && (exempt.has('*') || exempt.has(ln))) return // 豁免行整行跳过

    // ① 未定义令牌引用
    for (const m of line.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
      const name = m[1]
      if (!globalDefs.has(name) && !localDefs.has(name) && !injected.has(name)) {
        issues.undefinedToken.push({ file: rel, line: ln, name, text: line.trim().slice(0, 120) })
      }
    }

    if (isTokenFile) return // 令牌定义文件内不算硬编码

    // 令牌值登记表（如 TS 里的 CHART_TOKEN_FALLBACK: { "--chart-2": "#16a34a" }）
    // 形如「令牌名 → 色值」的映射条目，其右值本就是令牌的镜像，不算硬编码
    if (TOKEN_MAP_ENTRY_RE.test(line)) return

    // ② 硬编码色值
    const colorHits = []
    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) colorHits.push(m[0])
    for (const m of line.matchAll(/\b(rgba?|hsla?)\s*\(/g)) colorHits.push(m[1] + '()')
    if (colorHits.length) {
      issues.hardColor.push({ file: rel, line: ln, hits: [...new Set(colorHits)], text: line.trim().slice(0, 140) })
    }

    // ③ 硬编码圆角
    const r = line.match(/border-radius\s*:\s*([^;]+);/)
    if (r && !/var\(/.test(r[1]) && !/^(0|inherit|initial|unset)$/.test(r[1].trim()) && !/%/.test(r[1])) {
      issues.hardRadius.push({ file: rel, line: ln, value: r[1].trim(), text: line.trim().slice(0, 140) })
    }

    // ③ 硬编码阴影
    const sh = line.match(/box-shadow\s*:\s*([^;]+);/)
    if (sh && !/var\(/.test(sh[1]) && !/^(none|inherit|initial|unset)$/.test(sh[1].trim())) {
      issues.hardShadow.push({ file: rel, line: ln, value: sh[1].trim().slice(0, 60), text: line.trim().slice(0, 140) })
    }
  })
}

// ④ 与 admin-web 令牌漂移（同名不同值）
const drift = []
if (fs.existsSync(ADMIN_WEB_TOKENS)) {
  const aw = collectDefs(ADMIN_WEB_TOKENS)
  for (const [name, { value }] of globalDefs) {
    if (aw.has(name)) {
      const av = aw.get(name).value
      if (av.toLowerCase().replace(/\s+/g, '') !== value.toLowerCase().replace(/\s+/g, '')) {
        drift.push({ name, saasAdmin: value, adminWeb: av })
      }
    }
  }
}

// ⑤ Element Plus 命名空间与设计令牌的跨体系漂移
//   同一界面里 EP 原生组件（el-button/el-tag/el-message…）用 --el-*，
//   自研组件用 --color-*/--text-*，两组不同值即「视觉漂移」。
const EL_MAP = [
  ['--el-color-success', '--color-success', '成功'],
  ['--el-color-warning', '--color-warning', '警告'],
  ['--el-color-danger', '--color-danger', '危险'],
  ['--el-color-info', '--color-info', '信息'],
  ['--el-color-primary', '--color-primary', '主色'],
  ['--el-text-color-primary', '--text-primary', '主文本'],
  ['--el-text-color-regular', '--text-secondary', '常规文本'],
  ['--el-text-color-secondary', '--text-muted', '次要文本'],
  ['--el-text-color-placeholder', '--text-placeholder', '占位文本'],
  ['--el-border-color', '--border-normal', '边框'],
  ['--el-border-radius-base', '--radius-md', '圆角'],
]
const EL_CSS_CANDIDATES = [
  path.join(ROOT, 'node_modules', 'element-plus', 'dist', 'index.css'),
  path.join(ROOT, 'saas-admin', 'node_modules', 'element-plus', 'dist', 'index.css'),
]
const elCss = EL_CSS_CANDIDATES.find((p) => fs.existsSync(p))
/** 已被 :root:root 覆盖的 EP 令牌（tokens.css 中形如 --el-x: var(--y)） */
const overridden = new Map()
if (fs.existsSync(TOKENS_FILE)) {
  const t = stripComments(fs.readFileSync(TOKENS_FILE, 'utf8'))
  for (const m of t.matchAll(/(--el-[A-Za-z0-9_-]+)\s*:\s*(var\([^)]+\))/g)) {
    overridden.set(m[1], m[2])
  }
}
const elDrift = []
if (elCss) {
  const ep = collectDefs(elCss)
  for (const [elTok, dsTok, label] of EL_MAP) {
    const target = globalDefs.get(dsTok)?.value ?? '（令牌缺失）'
    if (overridden.has(elTok)) continue // 已收口，跳过
    const origin = ep.get(elTok)?.value ?? '（EP 未定义）'
    const norm = (v) => String(v).toLowerCase().replace(/\s+/g, '')
    if (norm(origin) !== norm(target)) {
      elDrift.push({ label, elTok, origin, dsTok, target })
    }
  }
}

const total =
  issues.undefinedToken.length + issues.hardColor.length + issues.hardRadius.length + issues.hardShadow.length

console.log('═══ 总后台令牌与视觉漂移审计（TOTAL-SAAS-UI-TOKENS-01）═══')
console.log(`扫描文件 ${files.length} 个｜令牌定义 ${globalDefs.size} 个`)
console.log(`① 未定义令牌引用 : ${issues.undefinedToken.length}`)
console.log(`② 硬编码色值     : ${issues.hardColor.length}`)
console.log(`③ 硬编码圆角     : ${issues.hardRadius.length}`)
console.log(`③ 硬编码阴影     : ${issues.hardShadow.length}`)
console.log(`④ 与 admin-web 同名不同值 : ${drift.length}`)
console.log(`⑤ Element 跨体系漂移      : ${elDrift.length}（已收口 ${overridden.size} 个）`)
console.log(`合计（①~③）: ${total}`)

// 落盘报告
const md = []
md.push('# 总后台（saas-admin）令牌与视觉漂移审计报告')
md.push('')
md.push(`> 单号 TOTAL-SAAS-UI-TOKENS-01｜审计人 林夕｜生成脚本 \`docs/设计/token-audit.mjs\``)
md.push(`> 扫描 ${files.length} 个文件，令牌定义 ${globalDefs.size} 个，合计问题 **${total}** 处`)
md.push('')
md.push('| 维度 | 数量 |')
md.push('|---|---|')
md.push(`| ① 未定义令牌引用 | ${issues.undefinedToken.length} |`)
md.push(`| ② 硬编码色值 | ${issues.hardColor.length} |`)
md.push(`| ③ 硬编码圆角 | ${issues.hardRadius.length} |`)
md.push(`| ③ 硬编码阴影 | ${issues.hardShadow.length} |`)
md.push(`| ④ 与 admin-web 同名不同值 | ${drift.length} |`)
md.push(`| ⑤ Element 跨体系漂移（未收口） | ${elDrift.length} |`)
md.push('')
md.push(`> 说明：①②③ 为本仓代码可自行收口项，目标恒为 0；④⑤ 为**跨体系/跨产品**对齐项，需评审后决定，不计入收口 KPI。`)
md.push('')
for (const [key, title] of [
  ['undefinedToken', '① 未定义令牌引用'],
  ['hardColor', '② 硬编码色值'],
  ['hardRadius', '③ 硬编码圆角'],
  ['hardShadow', '③ 硬编码阴影'],
]) {
  md.push(`## ${title}（${issues[key].length}）`)
  md.push('')
  if (!issues[key].length) md.push('（无）')
  else {
    md.push('| 文件 | 行 | 命中 | 原文 |')
    md.push('|---|---|---|---|')
    for (const it of issues[key]) {
      const hit = it.name || (it.hits ? it.hits.join(', ') : it.value)
      md.push(`| ${it.file} | ${it.line} | \`${String(hit).replace(/\|/g, '\\|')}\` | \`${it.text.replace(/\|/g, '\\|')}\` |`)
    }
  }
  md.push('')
}
md.push('## ④ 与 admin-web 同名不同值（令牌漂移）')
md.push('')
if (!drift.length) md.push('（无）')
else {
  md.push('| 令牌 | saas-admin | admin-web |')
  md.push('|---|---|---|')
  for (const d of drift) md.push(`| \`${d.name}\` | ${d.saasAdmin} | ${d.adminWeb} |`)
}
md.push('')
md.push('## ⑤ Element Plus 跨体系漂移（未收口）')
md.push('')
md.push(`已通过 \`:root:root\` 收口 ${overridden.size} 个：${[...overridden.keys()].map((k) => `\`${k}\``).join('、')}`)
md.push('')
if (!elDrift.length) md.push('（无，全部对齐）')
else {
  md.push('| 语义 | Element 令牌 | EP 原值 | 设计令牌 | 令牌值 |')
  md.push('|---|---|---|---|---|')
  for (const d of elDrift) {
    md.push(`| ${d.label} | \`${d.elTok}\` | ${d.origin} | \`${d.dsTok}\` | ${d.target} |`)
  }
}
md.push('')
fs.writeFileSync(path.join(ROOT, 'docs', '设计', 'token-audit-report.md'), md.join('\n'), 'utf8')
console.log('报告已写入 docs/设计/token-audit-report.md')
