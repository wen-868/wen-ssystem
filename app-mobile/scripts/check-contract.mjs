#!/usr/bin/env node
/**
 * QODER-1（批次 0）· 门 4 —— `check:contract` 移动端↔后端契约对账
 *
 * 判据（可复跑口径，回答审查报告「附 A.2」对 /admin 计数口径的质疑）：
 *   1) 调用侧：扫 `app-mobile/src/**\/*.{ts,vue}` **非注释行**里的字符串字面量
 *      （单引号/双引号/反引号），取以 `/admin/` 开头的路径；反引号里的 `${...}`
 *      归一为 `*` 参数段；去掉查询串。每条记录 `file:line` 出处。
 *      —— 这就是「移动端调用了哪些 /admin 路径」的**唯一口径**（按去重路径数，
 *         不是按出现次数；出现次数/去重数都打印出来，供 A.2 三口径对账）。
 *   2) 注册侧：扫 `backend/src/routes` 下全部 `.routes.ts`，按 guard-rbac-wiring.mjs
 *      同一套「`router: X` ↔ 最近 `prefix: "..."` 配对」取得 router 变量前缀，
 *      再抽 `VAR.(get|post|put|patch|delete)("/path")` 组成完整路径注册表；
 *      `:param` 归一为 `*` 段。文件名推断前缀的兼容形态（auto-routes.inferPrefix）
 *      同样支持（文件内**没有**任何 prefix 声明时按 `xxx.routes.ts → /api/xxx`）。
 *   3) 差集 = 调用侧路径 −（可匹配注册侧路径）。段级匹配：`*` 段与任一段互配。
 *      差集非空 ⇒ **EXIT=1 并逐条打印**（含出处 file:line）；
 *      允许**具名豁免**（`contract-exemptions.json`，每条必须带理由），豁免命中即从差集移除；
 *      豁免条目**失效**（路径已能对上）⇒ 同样报错要求删除（防豁免清单发霉）。
 *
 * 用法：
 *   node scripts/check-contract.mjs            人读模式（打印三口径计数 + 差集 + 豁免对账）
 *   node scripts/check-contract.mjs --json     机读模式（{callOccurrences, uniqueCallPaths, missing[], staleExemptions[]}）
 *
 * 反测（QODER-1 §三.2）：注入 1 条不存在的契约路径 ⇒ EXIT=1 且点名该路径；复原 ⇒ EXIT=0（SHA256 一致）。
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(MOBILE_ROOT, '..')
const MOBILE_SRC = join(MOBILE_ROOT, 'src')
const BACKEND_ROUTES = join(REPO_ROOT, 'backend', 'src', 'routes')
const EXEMPTIONS_FILE = join(HERE, 'contract-exemptions.json')

const CALL_METHOD_RE = /\b(?:get|post|put|del|upload|request)\s*\(/
/** 注释行（行首 // * /* import）不是调用（同 guard-rbac-wiring 踩坑[134]口径） */
const COMMENT_LINE_RE = /^\s*(?:\/\/|\*|\/\*|import\b)/
const HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete']

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'unpackage') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|vue)$/.test(e.name)) out.push(p)
  }
  return out
}

/** 反引号模板里的 `${...}` → `*`；去查询串；保证以 / 开头 */
export function normalizePath(raw) {
  let p = raw.replace(/\$\{[^}]*\}/g, '*').split('?')[0].trim()
  if (!p.startsWith('/')) p = '/' + p
  return p
}

/** 段级匹配：`*` 段与任意段互配；其余要求逐字相等 */
export function patternEquals(a, b) {
  const sa = a.split('/').filter(Boolean)
  const sb = b.split('/').filter(Boolean)
  if (sa.length !== sb.length) return false
  return sa.every((seg, i) => seg === '*' || sb[i] === '*' || seg === sb[i])
}

/** ① 调用侧：非注释行的 `/admin/...` 字符串字面量（含 '...' "..." `...`） */
function scanMobileCalls() {
  const literalRe = /['"`](\/admin\/[^'"`\s]*)['"`]/g
  const occurrences = []
  const files = walk(MOBILE_SRC)
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (COMMENT_LINE_RE.test(line)) return
      let m
      literalRe.lastIndex = 0
      while ((m = literalRe.exec(line)) !== null) {
        occurrences.push({
          file: relative(REPO_ROOT, f).replace(/\\/g, '/'),
          line: i + 1,
          path: normalizePath(m[1]),
          viaCall: CALL_METHOD_RE.test(line) || /url\s*:/.test(line),
        })
      }
    })
  }
  return occurrences
}

/** ② 注册侧：guard-rbac-wiring 同款 prefixByRouter（配对规则保持单一心智） */
function prefixByRouter(src, receiverVars) {
  const prefixes = [...src.matchAll(/prefix\s*:\s*["']([^"']*)["']/g)].map((m) => ({
    idx: m.index,
    prefix: m[1],
  }))
  const map = new Map()
  for (const m of src.matchAll(/router\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    let best = null
    for (const p of prefixes) {
      const d = Math.abs(p.idx - m.index)
      if (!best || d < best.d) best = { d, prefix: p.prefix }
    }
    if (best) map.set(m[1], best.prefix)
  }
  if (prefixes.length === 1) {
    for (const v of receiverVars) if (!map.has(v)) map.set(v, prefixes[0].prefix)
  }
  return map
}

function scanBackendRegistrations() {
  const routes = []
  const seenFiles = []
  for (const e of readdirSync(BACKEND_ROUTES, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.routes.ts')) continue
    const f = join(BACKEND_ROUTES, e.name)
    const src = readFileSync(f, 'utf8')
    seenFiles.push(e.name)
    const callRe = new RegExp(
      `([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${HTTP_VERBS.join('|')})\\s*\\(\\s*["'\`]([^"'\`\\n]*)`,
      'g'
    )
    const receiverVars = [...new Set([...src.matchAll(callRe)].map((m) => m[1]))]
    const prefixMap = prefixByRouter(src, receiverVars)
    const filePrefix = /(^|\n)\s*(?:export\s+const\s+routeConfigs?\b)/.test(src)
      ? null
      : `/api/${e.name.replace(/\.routes\.ts$/, '')}` // auto-routes.inferPrefix 兼容形态
    for (const m of src.matchAll(callRe)) {
      const prefix = prefixMap.get(m[1]) ?? filePrefix ?? '?'
      if (prefix === '?') continue
      const line = src.slice(0, m.index).split(/\r?\n/).length
      routes.push({
        file: `backend/src/routes/${e.name}`,
        line,
        method: m[2].toUpperCase(),
        path: normalizePath(prefix + m[3]),
      })
    }
  }
  // 注册侧盲区修正：`backend/src/server.ts` 存在**直接挂 app**的端点（如
  // `/api/admin/auth/mfa/verify`、`demo-login`，server.ts:239-247），不经过 routes/**；
  // 不纳入会把真实存在的端点误报成契约缺口。
  const serverFile = join(REPO_ROOT, 'backend', 'src', 'server.ts')
  if (existsSync(serverFile)) {
    const src = readFileSync(serverFile, 'utf8')
    const appRe = new RegExp(
      `\\bapp\\s*\\.\\s*(${HTTP_VERBS.join('|')})\\s*\\(\\s*["'\`]/api/([^"'\`\\n]*)`,
      'g'
    )
    for (const m of src.matchAll(appRe)) {
      const line = src.slice(0, m.index).split(/\r?\n/).length
      routes.push({
        file: 'backend/src/server.ts',
        line,
        method: m[1].toUpperCase(),
        path: normalizePath('/api/' + m[2]),
      })
    }
  }
  return routes
}

function main() {
  const jsonMode = process.argv.includes('--json')
  if (!existsSync(BACKEND_ROUTES)) {
    console.error(`找不到后端路由目录：${BACKEND_ROUTES}`)
    process.exit(1)
  }
  const occurrences = scanMobileCalls()
  const backend = scanBackendRegistrations()

  // A.2 三口径计数（子串出现次数 / 引号内出现次数 / 去重路径数）
  let substringCount = 0
  for (const o of occurrences) substringCount += 1
  const uniquePaths = [...new Set(occurrences.map((o) => o.path))].sort()
  const callSiteOccurrences = occurrences.filter((o) => o.viaCall).length

  const missing = []
  for (const p of uniquePaths) {
    const full = normalizePath('/api' + p)
    const hit = backend.some((r) => patternEquals(r.path, full))
    if (!hit) {
      missing.push({
        path: p,
        sources: occurrences.filter((o) => o.path === p).map((o) => `${o.file}:${o.line}`),
      })
    }
  }

  const exemptions = existsSync(EXEMPTIONS_FILE)
    ? JSON.parse(readFileSync(EXEMPTIONS_FILE, 'utf8'))
    : []
  const badExemptions = exemptions.filter(
    (x) => !x.path || !x.reason || !x.owner || !x.ruling
  )
  if (badExemptions.length > 0) {
    console.error('contract-exemptions.json 存在缺字段条目（path/reason/owner/ruling 必填）：')
    badExemptions.forEach((x) => console.error(`  ${JSON.stringify(x)}`))
    process.exit(1)
  }
  const stillMissing = []
  const exemptedHits = []
  for (const item of missing) {
    const ex = exemptions.find((x) => x.path === item.path)
    if (ex) exemptedHits.push(ex.path)
    else stillMissing.push(item)
  }
  // stale 判定：豁免路径不在当前差集 ⇒ 条目失效（要么调用点已删、要么后端已注册），
  // 两种都必须回来删掉豁免，否则豁免清单只进不出、必然发霉。
  const staleExemptions = exemptions
    .filter((x) => !missing.some((m) => m.path === x.path))
    .map((x) => x.path)

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          callOccurrences: substringCount,
          callSiteOccurrences,
          uniqueCallPaths: uniquePaths.length,
          backendRegistered: backend.length,
          missing: stillMissing,
          exempted: exemptedHits,
          staleExemptions,
        },
        null,
        2
      )
    )
  } else {
    console.log(`—— 契约对账（QODER-1 门 4，口径见文件头注释）——`)
    console.log(`A.2 口径① 引号内 '/admin/...' 出现次数（本脚本非注释行口径）: ${substringCount}`)
    console.log(`A.2 口径② 其中位于调用/ url: 行内的出现次数:              ${callSiteOccurrences}`)
    console.log(`A.2 口径③ 去重后的调用路径数:                              ${uniquePaths.length}`)
    console.log(`后端注册端点（routes/*.routes.ts 抽得，含全动词）:          ${backend.length}`)
    console.log(`差集（调用有、注册无）: ${missing.length} 条，其中具名豁免 ${exemptedHits.length} 条`)
  }

  let red = false
  if (stillMissing.length > 0) {
    red = true
    if (!jsonMode) {
      console.error(`\n✗ 未豁免的契约缺口 ${stillMissing.length} 条（逐条点名 + 出处）：`)
      for (const item of stillMissing) {
        console.error(`  ${item.path}`)
        item.sources.forEach((s) => console.error(`      ← ${s}`))
      }
    } else {
      console.error(`✗ 未豁免缺口 ${stillMissing.length} 条，详见 --json 输出 missing[]`)
    }
  }
  if (staleExemptions.length > 0) {
    red = true
    console.error(`✗ 豁免清单发霉（路径已不在差集 ⇒ 条目失效，必须删除）：`)
    staleExemptions.forEach((p) => console.error(`  ${p}`))
  }
  if (!red && !jsonMode) console.log('\n✓ 差集为 0 或全部具名豁免 ⇒ EXIT=0')
  process.exit(red ? 1 : 0)
}

main()
