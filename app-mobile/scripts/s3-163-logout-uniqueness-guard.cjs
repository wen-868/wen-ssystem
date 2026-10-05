#!/usr/bin/env node
/**
 * S3-163 出口唯一性守卫 —— 防止再长出「第二条副作用不同的 logout」
 *
 * 背景（业主口径 S3-162）：**退出帐号即退出凭证**。唯一正解收敛在
 *   `src/stores/user.ts` 的 `logout()`：无条件 `clearSavedCredentials()` + `setRememberMe(true)`。
 * S3-163 已删除与之冲突的死导出 `api/storage.ts` 的 `logout()`。
 * 本守卫防止未来再出现「清了 token 却不退凭证」的第二条实现。
 *
 * 判定规则（任一不满足 ⇒ 退出码 1 判红）：
 *   R1 死导出已删：src 内 `export function logout` 必须 0 命中。
 *   R2 口径一致：每个「会话清理实现」（含清 token / 清用户态动作的函数）必须二选一：
 *        (A) 主动退出 —— 同一函数体内同时出现 `clearSavedCredentials(` 与 `setRememberMe(`；
 *        (B) 被动例外 —— 401 失效清理，且必须同时满足「文件是 api/request.ts」
 *            且「该文件确实含 401 语义（`登录已过期` + `unauthorizedHandling`）」。
 *            例外是**绑定语义**而不是绑定文件名：一旦 request.ts 不再是 401 处理，例外自动失效并判红。
 *   R3 出口唯一：满足 (A) 的实现必须**恰好 1 处**。
 *
 * 为什么 R2(B) 不算「静默绕过」：401 是**被动**会话失效（不是用户退出），
 * S3-161 场景 C 明确要求「token 失效后打开 ⇒ 账号口令自动带出」，
 * 因此 401 路径**必须保留** saved_* ；且派单明确「不改 request.ts 的 401 逻辑」。
 *
 * 用法：
 *   node scripts/s3-163-logout-uniqueness-guard.cjs
 *   node scripts/s3-163-logout-uniqueness-guard.cjs --root <src 目录>   # 供反测在副本上跑
 *   node scripts/s3-163-logout-uniqueness-guard.cjs --json
 * 退出码：0 = 绿，1 = 红。
 */
const fs = require('node:fs')
const path = require('node:path')

const NL = String.fromCharCode(10)
const DEFAULT_ROOT = path.resolve(__dirname, '..', 'src')
const SCAN_EXT = ['.ts', '.js', '.vue', '.mjs', '.cjs']

let ROOT = DEFAULT_ROOT
let JSON_OUT = false
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--root') ROOT = path.resolve(process.argv[++i])
  else if (process.argv[i] === '--json') JSON_OUT = true
}

/** 去掉注释，避免注释里的示例代码造成误判；字符串内的 // 不做处理（对判定无影响） */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** .vue 只取 script 段（模板里的同名字符串不算实现） */
function codeOf(file, raw) {
  if (file.endsWith('.vue')) {
    const m = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
    return m ? m[1] : ''
  }
  return raw
}

const CLEAR_ACTIONS = [
  { name: 'removeToken()', re: /removeToken\s*\(/ },
  { name: "removeStorageSync('merchant_token')", re: /removeStorageSync\s*\(\s*['"]merchant_token['"]\s*\)/ },
  { name: "removeSecureStorage('merchant_token')", re: /removeSecureStorage\s*\(\s*['"]merchant_token['"]\s*\)/ },
  { name: 'removeUser()', re: /removeUser\s*\(/ },
  { name: 'removeTenant()', re: /removeTenant\s*\(/ },
  { name: 'removeCsrfToken()', re: /removeCsrfToken\s*\(/ },
]

const FN_DECL = /^\s*(export\s+)?(async\s+)?function\s+[A-Za-z0-9_]+/
const VAR_FN = /^\s*(export\s+)?const\s+[A-Za-z0-9_]+\s*=\s*(async\s*)?\(/

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (SCAN_EXT.indexOf(path.extname(e.name)) >= 0) acc.push(p)
  }
  return acc
}

/** 找出包含该行的函数（向上找最近的函数声明），并用花括号配平取函数体 */
function enclosing(lines, idx) {
  let start = -1
  for (let k = idx; k >= 0; k--) {
    if (FN_DECL.test(lines[k]) || VAR_FN.test(lines[k])) { start = k; break }
  }
  if (start < 0) return { name: '(top-level)', start: 0, end: lines.length - 1 }
  let depth = 0
  for (let k = start; k < lines.length; k++) {
    for (const ch of lines[k]) { if (ch === '{') depth++; else if (ch === '}') depth-- }
    if (depth === 0 && k > start) return { name: (lines[start].match(/function\s+([A-Za-z0-9_]+)/) || [])[1] || '(anonymous)', start, end: k }
  }
  return { name: (lines[start].match(/function\s+([A-Za-z0-9_]+)/) || [])[1] || '(anonymous)', start, end: lines.length - 1 }
}

const results = []
const impls = []
let deadLogoutHits = 0

const files = walk(ROOT, [])
for (const f of files.sort()) {
  const raw = fs.readFileSync(f, 'utf8')
  const rel = path.relative(ROOT, f).split(path.sep).join('/')
  const code = stripComments(codeOf(f, raw))

  if (/export\s+function\s+logout/.test(code)) deadLogoutHits++

  const lines = code.split(NL)
  const seen = new Set()
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i]
    if (FN_DECL.test(L) && /function\s+(removeToken|removeUser|removeTenant|removeCsrfToken)\s*\(/.test(L)) continue
    const hit = CLEAR_ACTIONS.find((a) => a.re.test(L))
    if (!hit) continue
    const fn = enclosing(lines, i)
    const key = rel + '#' + fn.name + '@' + fn.start
    if (seen.has(key)) continue
    seen.add(key)
    const body = lines.slice(fn.start, fn.end + 1).join(NL)
    impls.push({
      file: rel,
      line: i + 1,
      fn: fn.name,
      action: hit.name,
      purges: /clearSavedCredentials\s*\(/.test(body),
      resets: /setRememberMe\s*\(/.test(body),
      is401: rel === 'api/request.ts' && raw.includes('登录已过期') && raw.includes('unauthorizedHandling'),
    })
  }
}

for (const im of impls) {
  let verdict, why
  if (im.purges && im.resets) { verdict = 'OK'; why = '主动退出：同时清了凭据并复位「记住我」' }
  else if (im.is401) { verdict = 'OK'; why = '被动例外：401 失效清理（保留 saved_* 以满足 S3-161 场景 C）' }
  else { verdict = 'FAIL'; why = '清了会话但**未**退凭证：缺 ' + (!im.purges ? 'clearSavedCredentials() ' : '') + (!im.resets ? 'setRememberMe()' : '') }
  results.push({ rule: 'R2', verdict, file: im.file, line: im.line, fn: im.fn, action: im.action, why })
}

const activeExits = results.filter((r) => r.rule === 'R2' && r.verdict === 'OK' && r.why.indexOf('主动退出') === 0)
results.push({ rule: 'R1', verdict: deadLogoutHits === 0 ? 'OK' : 'FAIL', detail: 'export function logout 命中 ' + deadLogoutHits + ' 处（要求 0）' })
results.push({ rule: 'R3', verdict: activeExits.length === 1 ? 'OK' : 'FAIL', detail: '主动退出实现 ' + activeExits.length + ' 处（要求恰好 1）' })

const failed = results.filter((r) => r.verdict === 'FAIL')
const green = failed.length === 0
const out = []
out.push('[guard] root=' + ROOT)
out.push('[guard] 扫描文件 ' + files.length + ' 个；识别会话清理实现 ' + impls.length + ' 处')
for (const r of results) {
  if (r.rule === 'R2') out.push('  ' + r.verdict + '  ' + r.file + ':' + r.line + '  fn=' + r.fn + '  [' + r.action + ']  ' + r.why)
  else out.push('  ' + r.verdict + '  ' + r.rule + '  ' + r.detail)
}
out.push('[guard] 判定: ' + (green ? 'GREEN（出口唯一性成立）' : 'RED（存在违反口径的会话清理实现）'))
if (!green) out.push('[guard] 修复指引：主动退出必须同时调用 clearSavedCredentials() 与 setRememberMe()；401 被动清理不得新增第二处。')
if (JSON_OUT) out.push('[guard] JSON=' + JSON.stringify({ green, root: ROOT, files: files.length, results }))
process.stdout.write(out.join(NL) + NL)
process.exit(green ? 0 : 1)
