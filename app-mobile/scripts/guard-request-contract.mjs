#!/usr/bin/env node
// QODER-29 · 静态守卫 —— 移动端请求出口与凭据日志（MO-29 / MO-26）常驻门禁
//
// 接进 `npm run check:gates`（package.json 末段），任一违规 EXIT=1 并逐条点名。
// 三条判据（都是静态源码机检，不依赖运行期）：
//
//  A. 直接调用盘点（MO-29）：扫 app-mobile/src 下的 ts/vue 非注释行里的
//     `uni.request(` / `uni.uploadFile(` / `uni.downloadFile(` 调用点。
//     每条必须落在下面的登记册（DIRECT_CALL_REGISTRY）里、且该文件调用数不超过登记额度；
//     新增未登记的直接调用即红。（request.ts 本身是统一入口，登记额度=1。）
//  B. 安全头复用（MO-29）：任何含直接调用且非 request.ts 的文件，源码必须复用
//     buildRequestHeaders（统一鉴权 / 租户头 / CSRF 的唯一出处），不得再逐行自拼 storage。
//  C. 凭据日志（MO-26）：console.*(...) 调用里禁止出现"明文凭据取值"——
//     命中 password/token/csrf/secret/apiKey/authorization 等凭据词、且无长度/掩码脱敏痕迹即红。
//
// 用法：node scripts/guard-request-contract.mjs [--json]
// 反测（卡 §二.5）：
//   ① 注入一条未登记的 `uni.request` 令 A 红；
//   ② 摘掉某允许文件的 buildRequestHeaders 复用令 B 红；
//   ③ 注入 `console.log('password=', form.password)` 令 C 红。
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE_ROOT = resolve(HERE, '..')
const SRC = join(MOBILE_ROOT, 'src')

/** 注释行（行首 // * /* import）不计入（与 check-contract.mjs 同口径） */
const COMMENT_LINE_RE = /^\s*(?:\/\/|\*|\/\*|import\b)/

/**
 * 直接调用登记册（相对 app-mobile 的路径 -> 允许的直接网络调用条数 + 理由）。
 * ★ 新增/减少直接调用必须先改本表并留痕；改表属"更新基线"，注入违规属"再注入"，顺序见派单规范 §9.1。
 */
const DIRECT_CALL_REGISTRY = {
  'src/api/request.ts': { count: 1, reason: '统一请求入口本体（Promise 封装 uni.request，安全头来源）' },
  'src/api/modules/ai.ts': { count: 4, reason: 'AI 底座独立服务基址 + SSE 流式/非流式与写操作确认，无法走 Promise 型统一入口' },
  'src/utils/update.ts': { count: 1, reason: '热更新 .wgt 包下载 uni.downloadFile（二进制流，非请求型入口）' },
  'src/api/modules/products.ts': { count: 1, reason: '商品主图 multipart uni.uploadFile' },
  'src/api/modules/profile.ts': { count: 1, reason: '头像 multipart uni.uploadFile' }
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'unpackage') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|vue)$/.test(e.name)) out.push(p)
  }
  return out
}

const rel = (f) => relative(MOBILE_ROOT, f).replace(/\\/g, '/')

/** 非注释行里的直接网络调用（file/line/kind） */
function scanDirectCalls() {
  const re = /\buni\.(request|uploadFile|downloadFile)\s*\(/g
  const hits = []
  for (const f of walk(SRC)) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (COMMENT_LINE_RE.test(line)) return
      let m
      re.lastIndex = 0
      while ((m = re.exec(line)) !== null) {
        hits.push({ file: rel(f), line: i + 1, kind: `uni.${m[1]}` })
      }
    })
  }
  return hits
}

/** 提取一个 console.* 调用的完整文本（跨行按括号深度配平）；起始行若是注释返回 null */
function extractConsoleCalls(src) {
  const starts = []
  const startRe = /console\.(?:log|info|warn|error|debug|trace)\s*\(/g
  let m
  while ((m = startRe.exec(src)) !== null) starts.push(m.index)
  const calls = []
  for (const idx of starts) {
    // 起始所在行是否为注释行
    let lineStart = src.lastIndexOf('\n', idx - 1) + 1
    const lineText = src.slice(lineStart, src.indexOf('\n', idx) === -1 ? src.length : src.indexOf('\n', idx))
    if (COMMENT_LINE_RE.test(lineText)) continue
    let depth = 0
    let j = idx
    for (; j < src.length; j++) {
      const ch = src[j]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) break
      }
    }
    const text = src.slice(idx, j + 1)
    const line = src.slice(0, idx).split(/\r?\n/).length
    calls.push({ text, line })
  }
  return calls
}

/** 凭据词（\b 边界；passwordLen / savedPassword 之类不会命中裸 password） */
const CRED_TOKEN_RE = /\b(password|passwd|pwd|token|csrf|secret|access[-_]?token|refresh[-_]?token|api[-_]?key|authorization)\b/i
/** 脱敏痕迹：只打长度 / 掩码 / 截断，允许 */
const MASKED_RE = /\.length\b|Len\b|len\b|slice\(|\.slice|mask|redact|\*\*\*|%\s*d|\{\s*\}/i

function scanCredentialLogs() {
  const offenders = []
  for (const f of walk(SRC)) {
    const src = readFileSync(f, 'utf8')
    for (const c of extractConsoleCalls(src)) {
      if (CRED_TOKEN_RE.test(c.text) && !MASKED_RE.test(c.text)) {
        offenders.push({ file: rel(f), line: c.line, text: c.text.replace(/\s+/g, ' ').slice(0, 160) })
      }
    }
  }
  return offenders
}

/** 安全头复用：含直接调用且非 request.ts 的文件，必须引用 buildRequestHeaders */
function checkHeaderReuse(filesWithDirectCalls) {
  const offenders = []
  for (const file of filesWithDirectCalls) {
    if (file === 'src/api/request.ts') continue // 它就是安全头来源
    const src = readFileSync(join(MOBILE_ROOT, file), 'utf8')
    if (!/buildRequestHeaders\s*\(/.test(src)) offenders.push(file)
  }
  return offenders
}

function main() {
  const jsonMode = process.argv.includes('--json')
  const direct = scanDirectCalls()

  // —— A. 直接调用是否都登记、且不超额度 ——
  const perFile = new Map()
  for (const d of direct) perFile.set(d.file, (perFile.get(d.file) ?? 0) + 1)
  const aViolations = []
  for (const [file, count] of perFile) {
    const reg = DIRECT_CALL_REGISTRY[file]
    if (!reg || count > reg.count) {
      const hits = direct.filter((d) => d.file === file).map((d) => `${d.file}:${d.line} ${d.kind}`)
      aViolations.push({ file, count, allowed: reg ? reg.count : 0, hits })
    }
  }

  // —— B. 安全头复用 ——
  const bViolations = checkHeaderReuse([...perFile.keys()])

  // —— C. 凭据日志 ——
  const cViolations = scanCredentialLogs()

  const red = aViolations.length > 0 || bViolations.length > 0 || cViolations.length > 0

  if (jsonMode) {
    console.log(JSON.stringify({
      directCallTotal: direct.length,
      inventory: direct,
      registry: DIRECT_CALL_REGISTRY,
      A_unregisteredOrExcess: aViolations,
      B_headerReuseMissing: bViolations,
      C_credentialLogLeaks: cViolations,
      exit: red ? 1 : 0
    }, null, 2))
    process.exit(red ? 1 : 0)
  }

  console.log('—— QODER-29 请求出口 & 凭据日志静态守卫 ——')
  console.log(`直接网络调用（uni.request/uploadFile/downloadFile，非注释行）：共 ${direct.length} 处`)
  for (const d of direct) {
    const reg = DIRECT_CALL_REGISTRY[d.file]
    console.log(`  ${d.file}:${d.line}  ${d.kind}  ${reg ? '✔ 已登记' : '✘ 未登记'}`)
  }

  if (aViolations.length > 0) {
    console.error(`\n✗ [A] 存在未登记 / 超出额度的直接调用（MO-29）：`)
    for (const v of aViolations) console.error(`    ${v.file}: 实际 ${v.count} > 登记 ${v.allowed} — ${v.hits.join('; ')}`)
  }
  if (bViolations.length > 0) {
    console.error(`\n✗ [B] 直接调用未复用统一安全头 buildRequestHeaders（MO-29）：`)
    bViolations.forEach((f) => console.error(`    ${f}`))
  }
  if (cViolations.length > 0) {
    console.error(`\n✗ [C] console 日志出现明文凭据取值（MO-26）：`)
    for (const v of cViolations) console.error(`    ${v.file}:${v.line}  ${v.text}`)
  }

  if (!red) {
    console.log('\n✓ A 全部登记且未超额 · B 复用统一安全头 · C 无明文凭据日志 ⇒ EXIT=0')
  }
  process.exit(red ? 1 : 0)
}

main()
