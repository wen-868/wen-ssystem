#!/usr/bin/env node
/**
 * 前端 API 路径 ↔ 后端注册路由 集合比对脚本（R101-C6-1B 交付物 ⑥）
 *
 * 目的：防止 D1 类缺陷复发 —— 前端封装了后端**不存在**的路径（或方法），
 *       运行时必然 404（如 `POST /platform/library/spus/{id}/approve`）。
 *
 * 比对口径：
 *   1. 前端集合：`saas-admin/src/api/*.ts` 里 `request.<method>('路径')` 的路径字面量；
 *   2. 后端集合：`backend/src/routes/**` 的 `routeConfig.prefix` + `xxxRouter.<method>("子路径")`；
 *   3. 参数段归一化：`:id`、`${id}`、`{id}` 一律归一为 `{p}`，逐段比对；
 *   4. 输出两类问题：`路径不存在`（前端有、后端无）、`方法不存在`（路径在、方法没注册）；
 *   5. 命中 `api-path-allowlist.json` 的条目视为**已知未立项项**，不计入失败。
 *
 * 用法（在仓库根目录或任意目录均可）：
 *   node saas-admin/scripts/check-api-paths.mjs
 *   node saas-admin/scripts/check-api-paths.mjs --json      # 机器可读输出
 *   node saas-admin/scripts/check-api-paths.mjs --no-color
 *   node saas-admin/scripts/check-api-paths.mjs --api-dir=<目录>   # 扫描指定 api 目录（用于"改前/改后"对照取证）
 *
 * 退出码：0 = 无非豁免问题；1 = 存在「前端有、后端无」或「方法未注册」；
 *         2 = 扫描前置条件不满足（目录缺失等）。
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')

const args = process.argv.slice(2)
const AS_JSON = args.includes('--json')
const USE_COLOR = !args.includes('--no-color') && !AS_JSON

const apiDirArg = args.find((a) => a.startsWith('--api-dir='))
const API_DIR = apiDirArg ? resolve(apiDirArg.slice('--api-dir='.length)) : join(REPO_ROOT, 'saas-admin', 'src', 'api')
const ROUTES_DIR = join(REPO_ROOT, 'backend', 'src', 'routes')
const ALLOWLIST_FILE = join(__dirname, 'api-path-allowlist.json')

/**
 * 前端 request 实例的 baseURL 是 `/api`（见 saas-admin/src/utils/request.ts），
 * 因此前端路径字面量不带 `/api` 前缀，而后端 routeConfig.prefix 带；
 * 比对前统一去掉后端的前导 `/api`。
 */
function stripApiPrefix(p) {
  return p.replace(/^\/api(?=\/|$)/, '')
}

for (const dir of [API_DIR, ROUTES_DIR]) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`[check-api-paths] 目录不存在：${dir}`)
    process.exit(2)
  }
}

/** 归一化路径：参数段统一成 {p}，去掉查询串与结尾斜杠 */
function normalizePath(raw) {
  let p = String(raw || '').trim()
  if (!p) return ''
  p = p.split('?')[0]
  // 模板字面量里的 `${...}` 与 express 的 `:param` 都是参数段
  p = p.replace(/\$\{[^}]*\}/g, '{p}')
  p = p.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '{p}')
  p = p.replace(/\{[^}]*\}/g, '{p}')
  p = p.replace(/\/+/g, '/')
  if (p.length > 1) p = p.replace(/\/$/, '')
  return p
}

/** 逐段比对，{p} 视为单段通配 */
function pathMatches(frontPath, backPath) {
  if (frontPath === backPath) return true
  const f = frontPath.split('/')
  const b = backPath.split('/')
  if (f.length !== b.length) return false
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '{p}' || b[i] === '{p}') continue
    if (f[i] !== b[i]) return false
  }
  return true
}

/** 拼接 URL 路径（不能用 path.join：Windows 下会产出反斜杠） */
function joinUrl(prefix, sub) {
  const p = String(prefix || '').replace(/\/$/, '')
  const s = String(sub || '')
  if (!s) return p || '/'
  return `${p}${s.startsWith('/') ? s : `/${s}`}`
}

/* ───────────────────────── 前端集合 ───────────────────────── */

function scanFrontendPaths() {
  const items = []
  const files = readdirSync(API_DIR).filter((f) => f.endsWith('.ts')).sort()
  // 例：return request.get(`/platform/library/spus/${id}/status`)
  //     return request.put('/platform/library/brands/${id}', { status })
  const callRe = /\b(?:request|api|axios|http)\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*([`'"])([\s\S]*?)\2/g
  for (const file of files) {
    const full = join(API_DIR, file)
    const text = readFileSync(full, 'utf8')
    const lines = text.split(/\r?\n/)
    let m
    while ((m = callRe.exec(text)) !== null) {
      const [, method, , rawPath] = m
      // 跨行匹配时可能吃进换行，取第一行作为路径字面量
      const raw = rawPath.split('\n')[0]
      const path = normalizePath(raw)
      if (!path.startsWith('/')) continue
      const upto = text.slice(0, m.index)
      const line = upto.split('\n').length
      items.push({
        method: method.toUpperCase(),
        path,
        raw: raw.trim(),
        file: relative(REPO_ROOT, full).replace(/\\/g, '/'),
        line,
        text: (lines[line - 1] || '').trim(),
      })
    }
  }
  return items
}

/* ───────────────────────── 后端集合 ───────────────────────── */

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

function scanBackendRoutes() {
  const routes = []
  for (const full of walk(ROUTES_DIR).sort()) {
    const text = readFileSync(full, 'utf8')
    const prefixMatch = text.match(/prefix:\s*(["'`])([^"'`]+)\1/)
    const prefix = prefixMatch ? prefixMatch[2] : ''
    const file = relative(REPO_ROOT, full).replace(/\\/g, '/')
    // 例：platformLibraryRouter.put("/spus/:id/status", asyncHandler(...))
    const routeRe = /([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|delete|patch|all)\s*\(\s*(["'`])([^"'`]*)\3/g
    let m
    while ((m = routeRe.exec(text)) !== null) {
      const [, varName, method, , sub] = m
      // 形如 app.use(...) / express.static 变量的调用跳过：只认本文件声明的 router 变量
      if (/^(app|express|server)$/.test(varName)) continue
      const line = text.slice(0, m.index).split('\n').length
      routes.push({
        method: method.toUpperCase(),
        path: stripApiPrefix(normalizePath(joinUrl(prefix, sub))),
        raw: `${method.toUpperCase()} ${prefix}${sub}`,
        file,
        line,
      })
    }
    // 同一文件内的子挂载（xxxRouter.use("/sub", ...)）也计入前缀候选
    const mountRe = /\.\s*use\s*\(\s*(["'`])(\/[^"'`]*)\1/g
    while ((m = mountRe.exec(text)) !== null) {
      routes.push({
        method: 'ALL',
        path: stripApiPrefix(normalizePath(joinUrl(prefix, m[2]))),
        raw: `USE ${prefix}${m[2]}`,
        file,
        line: text.slice(0, m.index).split('\n').length,
      })
    }
  }
  return routes
}

/* ───────────────────────── 豁免清单 ───────────────────────── */

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) return []
  try {
    const data = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8'))
    return Array.isArray(data.entries) ? data.entries : []
  } catch (e) {
    console.error(`[check-api-paths] 豁免清单解析失败：${ALLOWLIST_FILE} → ${e.message}`)
    process.exit(2)
  }
}

/* ───────────────────────── 比对 ───────────────────────── */

const frontend = scanFrontendPaths()
const backend = scanBackendRoutes()
const allowlist = loadAllowlist()

const allowKey = (e) => `${e.method.toUpperCase()} ${normalizePath(e.path)}`
const allowed = new Map(allowlist.map((e) => [allowKey(e), e]))

const pathMissing = []
const methodMissing = []
const allowedHits = []

for (const f of frontend) {
  const samePath = backend.filter((b) => pathMatches(f.path, b.path))
  if (samePath.length === 0) {
    const hit = allowed.get(`${f.method} ${f.path}`)
    ;(hit ? allowedHits : pathMissing).push({ ...f, allow: hit })
    continue
  }
  const okMethod = samePath.some((b) => b.method === f.method || b.method === 'ALL')
  if (!okMethod) {
    const hit = allowed.get(`${f.method} ${f.path}`)
    const entry = { ...f, backendMethods: [...new Set(samePath.map((b) => b.method))].join(','), allow: hit }
    ;(hit ? allowedHits : methodMissing).push(entry)
  }
}

const uniquePaths = new Set(frontend.map((f) => `${f.method} ${f.path}`))
const report = {
  scanned: {
    frontendCalls: frontend.length,
    frontendUnique: uniquePaths.size,
    backendRoutes: backend.length,
  },
  pathMissing,
  methodMissing,
  allowlisted: allowedHits.map((a) => ({ method: a.method, path: a.path, file: `${a.file}:${a.line}`, reason: a.allow.reason })),
  unusedAllowlist: allowlist.filter((e) => !allowedHits.some((a) => allowKey(a) === allowKey(e))).map((e) => ({ method: e.method, path: e.path, reason: e.reason })),
}

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const c = (code, s) => (USE_COLOR ? `\u001b[${code}m${s}\u001b[0m` : s)
  const red = (s) => c(31, s)
  const green = (s) => c(32, s)
  const gray = (s) => c(90, s)

  console.log('check-api-paths · 前端 API 路径 ↔ 后端注册路由')
  console.log(gray(`  前端调用点 ${report.scanned.frontendCalls}（去重 ${report.scanned.frontendUnique}）· 后端注册路由 ${report.scanned.backendRoutes}`))
  console.log(gray(`  豁免清单 ${allowlist.length} 条（命中 ${report.allowlisted.length} 条）`))
  console.log('')

  if (pathMissing.length === 0 && methodMissing.length === 0) {
    console.log(green('PASS 未发现「前端有、后端无」的路径 / 方法'))
  } else {
    if (pathMissing.length > 0) {
      console.log(red(`FAIL 路径不存在（前端有、后端无）：${pathMissing.length} 条`))
      for (const p of pathMissing) {
        console.log(red(`  - ${p.method} ${p.path}`) + gray(`   ${p.file}:${p.line}`))
      }
    }
    if (methodMissing.length > 0) {
      console.log(red(`FAIL 方法未注册（路径在、方法无）：${methodMissing.length} 条`))
      for (const p of methodMissing) {
        console.log(red(`  - ${p.method} ${p.path}`) + gray(`   后端已注册方法：${p.backendMethods}   ${p.file}:${p.line}`))
      }
    }
  }

  if (report.allowlisted.length > 0) {
    console.log('')
    console.log(gray(`已豁免（已知未立项项）：${report.allowlisted.length} 条`))
    for (const a of report.allowlisted) {
      console.log(gray(`  - ${a.method} ${a.path}  ${a.reason}`))
    }
  }
  if (report.unusedAllowlist.length > 0) {
    console.log('')
    console.log(gray(`提示：豁免清单中 ${report.unusedAllowlist.length} 条当前未命中（可考虑清理）`))
  }
}

process.exit(pathMissing.length === 0 && methodMissing.length === 0 ? 0 : 1)
