#!/usr/bin/env node
/**
 * MOBILE-32F2 · guard-button-gates.mjs —— 按钮门控三方守恒守卫
 *
 * 双重真相源：
 *   A) scripts/button-gate-manifest.json  —— 动作清单（page/actionId/handler/method/endpoint/码/门控/状态）
 *   B) 源码 app-mobile/src/pages/**.vue   —— 真实按钮绑定
 *   C) app-mobile/src/api/modules/**.ts   —— 真实 HTTP method + path（不看 handler 名字，卡§三禁名称启发式）
 *
 * 判红条件（卡 §验收5，逐条点名）：
 *  ① UNREGISTERED_WRITE   源码解析出的服务端写调用（非 GET），manifest 未登记该 method+endpoint；
 *  ② UNGATED_WRITE        manifest 有该写条目且 status=GATED，但源码未见门控接线（writeGate 绑定 /
 *                         handler 内 gateX.value.enabled / gateOrHint(gateX) 三种形态之一）；
 *  ③ UNKNOWN_CODE         manifest 权限码不在 config/permission-gates.ts 注册码集合；
 *  ④ ENDPOINT_MISMATCH    manifest 声明的 method+endpoint 在源码中解析不到（= 错绑 / 已删除的调用）；
 *  ⑤ STATUS_MISMATCH      status=GATED 却 permissionCodes 为空，或 status=BLOCKED_BACKEND_CODE 却带码
 *                         （= 伪造码 / 把"后端没守卫"说成"已门控"）；
 *  ⑥ FAIL_OPEN            config/button-gates.ts 的 unavailable 分支不再 deny（权限失败被当有权限）；
 *  ⑦ FAKE_UI_ONLY         status=UI_ONLY / READ_ONLY 的条目里出现了非 GET 端点
 *                         （卡红线：不得把真实写伪装成 UI 开关来减少 UNGATED 数）。
 *
 * 用法：
 *   node scripts/guard-button-gates.mjs            校验（绿 EXIT=0 / 红 EXIT=1 并点名）
 *   node scripts/guard-button-gates.mjs --json     机读
 *   node scripts/guard-button-gates.mjs --self-test 四条反测（注入→点名变红→逐字节复原→复绿）
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SRC = join(ROOT, 'src')
const MODULES = join(SRC, 'api/modules')
const MANIFEST = join(HERE, 'button-gate-manifest.json')

const VERB = { get: 'GET', post: 'POST', put: 'PUT', del: 'DELETE', patch: 'PATCH', upload: 'POST' }

/** request.ts 导出的真实 method（以请求层为唯一真相，不由模块层自述） */
function requestVerbs() {
  const t = readFileSync(join(SRC, 'api/request.ts'), 'utf8')
  const out = {}
  for (const n of ['get', 'post', 'put', 'del', 'patch']) {
    const m = new RegExp(`export\\s+(?:async\\s+)?function\\s+${n}[\\s\\S]{0,700}?method\\s*[:=]\\s*['"\`]([A-Z]+)`).exec(t)
    out[n] = m ? m[1] : VERB[n]
  }
  out.upload = 'POST' // uni.uploadFile 恒为 POST
  return out
}
const V = requestVerbs()

/** `${id}` / `{id}` → `*`；去查询串；去掉 `${API_BASE}` 之类前缀段（真实 path 以 / 开头） */
const norm = (p) => {
  let s = (p || '').replace(/\$\{[^}]*\}/g, '*').replace(/\{[^}]*\}/g, '*').split('?')[0]
  s = s.replace(/^(\*\/)+/, '/') // `${API_BASE}/admin/...` → `/admin/...`
  if (!s.startsWith('/')) s = '/' + s
  return s
}

/** 段级匹配：`*` 段与任意段互配（与 check-contract.mjs 同源口径） */
function pathEquals(a, b) {
  const sa = norm(a).split('/').filter(Boolean)
  const sb = norm(b).split('/').filter(Boolean)
  if (sa.length !== sb.length) return false
  return sa.every((s, i) => s === '*' || sb[i] === '*' || s === sb[i])
}

/** 在一组源码行里找第一个请求动词调用（含 uni.uploadFile 的 url） */
function findRequestCall(lines, from, to) {
  for (let i = from; i < Math.min(to, lines.length); i++) {
    const m = /(?:^|[^.\w$])(get|post|put|del|patch|upload)\s*(?:<[^>]*>)?\s*\(\s*\(?\s*[`'"]([^`'"]*)/.exec(lines[i])
    if (m) return { verb: m[1], path: m[2], line: i + 1 }
    const block = lines.slice(i, Math.min(i + 14, lines.length)).join('\n')
    const u = /uni\.uploadFile\(\s*\{[\s\S]{0,400}?url:\s*[^`'"]*[`'"]([^`'"]*?\/admin\/[^`'"$]*)/.exec(block)
    if (u) return { verb: 'upload', path: u[1], line: i + 1 }
  }
  return null
}

/**
 * API 索引：module → symbol → {method, path}
 * 支持：对象方法（含 `const xApi = {}` / `export const xApi = {}`）、裸导出函数、
 *       以及**委托包装**（对象方法体只是 `return 裸函数(...)`）→ 递归落到真实端点。
 */
function buildIndex() {
  const byModule = new Map()
  for (const f of readdirSync(MODULES).filter((x) => x.endsWith('.ts')).sort()) {
    const mod = basename(f, '.ts')
    const lines = readFileSync(join(MODULES, f), 'utf8').split(/\r?\n/)
    const rec = new Map()

    // 先收集裸导出（委托目标），供对象方法回查
    const bare = new Map()
    let cur = null, curLine = 0
    for (let i = 0; i < lines.length; i++) {
      const b = /^export\s+(?:async\s+)?function\s+(\w+)|^export\s+const\s+(\w+)\s*=\s*(?:async\s*)?(?:function\s*\(|\()/ .exec(lines[i])
      if (b) { cur = b[1] || b[2]; curLine = i + 1; continue }
      if (!cur) continue
      if (/^export\s+/.test(lines[i])) { cur = null; continue }
      const c = findRequestCall(lines, i, i + 1)
      if (c) { if (!bare.has(cur)) bare.set(cur, { verb: c.verb, path: c.path, apiLine: c.line }); cur = null }
    }

    // 对象方法
    let obj = null, objStart = -1
    for (let i = 0; i < lines.length; i++) {
      const o = /^(?:export\s+)?const\s+(\w+)\s*=\s*\{/.exec(lines[i])
      if (o) { obj = o[1]; objStart = i; continue }
      if (!obj || !/^\}/.test(lines[i])) continue
      const starts = []
      for (let j = objStart + 1; j < i; j++) if (/^\s{2}(?:(\w+)\s*:\s*)?(?:async\s+)?\w+\s*[(:]/.test(lines[j])) starts.push(j)
      starts.forEach((j, n) => {
        const g = /^\s{2}(?:(\w+)\s*:\s*)?(?:async\s+)?(\w+)\s*[(:]/.exec(lines[j])
        const name = g && (g[1] || g[2])
        if (!name || ['return', 'if', 'for', 'const', 'let', 'await', 'else'].includes(name)) return
        const end = n + 1 < starts.length ? starts[n + 1] : i
        const body = lines.slice(j, end).join('\n')
        let c = findRequestCall(lines, j, end)
        // 委托包装：体内没有请求动词，而是 `return 同模块裸函数(...)`
        if (!c) {
          const d = /return\s+(\w+)\s*\(/.exec(body)
          if (d && bare.has(d[1])) { const r = bare.get(d[1]); c = { verb: r.verb, path: r.path, line: r.apiLine } }
        }
        if (!c) return
        const key = `${obj}.${name}`
        if (!rec.has(key)) rec.set(key, { module: mod, name: key, method: V[c.verb], path: norm(c.path), apiLine: c.line })
      })
      obj = null
    }
    // 裸导出也进索引
    for (const [name, c] of bare) if (!rec.has(name)) rec.set(name, { module: mod, name, method: V[c.verb], path: norm(c.path), apiLine: c.line })

    // 尾列导出形态：`function name(...)`（未带 export）+ 文件末尾 `export { ..., name }`
    const tail = /^(?:async\s+)?function\s+(\w+)|^(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/
    const exportedNames = new Set()
    for (const l of lines) {
      const m = /^export\s*\{\s*([^}]+)\s*\}/.exec(l)
      if (m) m[1].split(',').forEach((s) => { const t = s.trim().replace(/^type\s+/, ''); if (t) exportedNames.add(t.split(/\s+as\s+/).pop().trim()) })
    }
    for (let i = 0; i < lines.length; i++) {
      const t = tail.exec(lines[i])
      if (!t) continue
      const name = t[1] || t[2]
      if (!exportedNames.has(name) || rec.has(name)) continue
      let end = i + 1
      while (end < lines.length && !/^\}/.test(lines[end])) end++
      const c = findRequestCall(lines, i, end)
      if (c) rec.set(name, { module: mod, name, method: V[c.verb], path: norm(c.path), apiLine: c.line })
    }
    byModule.set(mod, rec)
  }
  return byModule
}

/** 页面 import：局部名 → {module, orig} */
function parseImports(text) {
  const map = new Map()
  let m
  const named = /import\s*\{([^}]+)\}\s*from\s*['"]@\/api\/modules\/([\w.-]+)['"]/g
  while ((m = named.exec(text))) {
    for (const raw of m[1].split(',')) {
      const t = raw.trim()
      if (!t || t.startsWith('type ')) continue
      const as = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(t)
      if (as) map.set(as[2] || as[1], { module: m[2], orig: as[1] })
    }
  }
  return map
}

/** 顶层函数声明行索引：用于把写调用归属到 handler */
function topLevelFns(text) {
  const lines = text.split(/\r?\n/)
  const out = []
  lines.forEach((l, i) => {
    const m = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*async\s*\(/.exec(l)
    if (m) out.push({ name: m[1] || m[2], line: i + 1 })
  })
  return out
}

/** 解析一个页面：全部服务端写调用（含一层本地函数跟随 = 卡§三.2 确认链） */
function analyzePage(relFile, byModule) {
  const text = readFileSync(join(SRC, relFile.replace(/^src\//, '')), 'utf8')
  const imports = parseImports(text)
  const objOwner = new Map()
  for (const [mod, rec] of byModule) for (const k of rec.keys()) if (k.includes('.')) { const o = k.split('.')[0]; if (!objOwner.has(o)) objOwner.set(o, mod) }
  const fns = topLevelFns(text)
  const lines = text.split(/\r?\n/)
  const raw = []
  lines.forEach((l, i) => {
    if (/^\s*(?:\/\/|\*|\/\*)/.test(l)) return
    const o = /(\w+Api)\.(\w+)\s*\(/.exec(l)
    if (o && objOwner.has(o[1])) {
      const rec = byModule.get(objOwner.get(o[1]))?.get(`${o[1]}.${o[2]}`)
      if (rec && rec.method !== 'GET') raw.push({ line: i + 1, sym: `${o[1]}.${o[2]}`, ...rec })
    }
    for (const b of l.matchAll(/(?:^|[^.\w$])(\w+)\s*\(/g)) {
      const imp = imports.get(b[1])
      if (!imp) continue
      const rec = byModule.get(imp.module)?.get(imp.orig)
      if (rec && rec.method !== 'GET' && !raw.some((x) => x.sym === (imp.orig === b[1] ? b[1] : `${imp.module}.${b[1]}`) && x.line === i + 1)) raw.push({ line: i + 1, sym: b[1], ...rec })
    }
  })
  const ownerOf = (line) => { let best = null; for (const f of fns) if (f.line <= line && (!best || f.line > best.line)) best = f; return best?.name ?? null }
  const bodyOf = (name) => {
    const s = new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=\\s*(?:async\\s*)?\\()`).exec(text)
    if (!s) return null
    const open = text.indexOf('{', s.index)
    if (open < 0) return null
    let d = 0
    for (let i = open; i < text.length; i++) { if (text[i] === '{') d++; else if (text[i] === '}') { d--; if (!d) return text.slice(open, i + 1) } }
    return null
  }
  // 一层跟随：入口 handler 调用本地函数，该函数体内有写调用 ⇒ 入口 handler 也算写动作（卡§三.2）
  for (const w of [...raw]) {
    const owner = ownerOf(w.line)
    if (!owner || owner === w.sym) continue
    w.handler = owner
    for (const f of fns) {
      if (f.name === owner || !bodyOf(f.name)) continue
      if (new RegExp(`\\b${owner}\\s*\\(`).test(bodyOf(f.name))) {
        const via = `${f.name}→${owner}`
        if (!raw.some((x) => x.sym === w.sym && x.handler === via)) raw.push({ ...w, handler: via, inherited: true })
      }
    }
  }
  for (const w of raw) if (!w.handler) w.handler = ownerOf(w.line)
  // 同一调用点只报一次（确认链继承出的多条记录合并 handler 标签）
  const uniq = []
  for (const w of raw) {
    const k = `${w.line}|${w.sym}|${w.method}|${w.path}`
    const hit = uniq.find((x) => `${x.line}|${x.sym}|${x.method}|${x.path}` === k)
    if (hit) { if (w.handler && !hit.handlers.includes(w.handler)) hit.handlers.push(w.handler) }
    else uniq.push({ ...w, handlers: [w.handler].filter(Boolean) })
  }
  return { text, writes: uniq }
}

/** 主校验 */
function run() {
  const errors = []
  if (!existsSync(MANIFEST)) return { errors: ['MISSING_MANIFEST: ' + MANIFEST], stats: null }
  let manifest
  try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) } catch (e) { return { errors: ['MANIFEST_NOT_JSON: ' + e.message], stats: null } }
  const byModule = buildIndex()

  // ③ 权限码合法性
  const pgText = readFileSync(join(SRC, 'config/permission-gates.ts'), 'utf8')
  const known = new Set([...pgText.matchAll(/['"]([a-z][a-z0-9_]*(?::[a-z*][a-z0-9_:-]*)?)['"]/g)].map((m) => m[1]))

  // ⑥ 失败关闭
  const bg = readFileSync(join(SRC, 'config/button-gates.ts'), 'utf8')
  if (!/deny\(\s*'unavailable'/.test(bg)) errors.push('FAIL_OPEN: config/button-gates.ts 的 unavailable 分支不再 deny（权限加载失败被当成有权限 ⇒ 放行）')

  const stats = { pages: [], GATED: 0, UNGATED: 0, BLOCKED_BACKEND_CODE: 0, UI_ONLY: 0, READ_ONLY: 0, sourceWrites: 0 }

  for (const page of manifest.pages || []) {
    const { text, writes } = analyzePage(page.file, byModule)
    const entries = (manifest.entries || []).filter((e) => e.page === page.id)
    const gated = entries.filter((e) => e.status === 'GATED')
    const declared = entries.filter((e) => e.endpoint && e.method)

    for (const e of entries) {
      for (const c of e.permissionCodes || []) if (c && !known.has(c)) errors.push(`UNKNOWN_CODE: ${e.id} → 权限码 "${c}" 未在 config/permission-gates.ts 注册`)
      if (e.status === 'GATED' && !(e.permissionCodes || []).length) errors.push(`STATUS_MISMATCH: ${e.id} status=GATED 但 permissionCodes 为空（无码即无从判定，应登记 BLOCKED_BACKEND_CODE 或 blocked）`)
      if (e.status === 'BLOCKED_BACKEND_CODE' && (e.permissionCodes || []).length) errors.push(`STATUS_MISMATCH: ${e.id} status=BLOCKED_BACKEND_CODE 却带权限码 "${e.permissionCodes.join(',')}"（伪造码）`)
      if ((e.status === 'UI_ONLY' || e.status === 'READ_ONLY') && e.method && e.method !== 'GET' && !String(e.endpoint).includes(',')) errors.push(`FAKE_UI_ONLY: ${e.id} 登记为 ${e.status} 却带 ${e.method} ${e.endpoint}（真实写不得伪装成 UI 开关）`)
      // 卡 §三.4：BLOCKED_BACKEND_CODE 不得计入 GATED 完成数 ⇒ 必须显式标注 counted_as_completed=false
      if (e.status === 'BLOCKED_BACKEND_CODE') {
        if (e.countedAsCompleted !== false) errors.push(`BLOCKED_COUNTED_AS_DONE: ${e.id} 后端无码，必须 countedAsCompleted=false 且不得计入 GATED 完成数`)
        if (e.codeProof === undefined) errors.push(`BLOCKED_MISSING_PROOF: ${e.id} 必须给出后端无 requirePermission 的行号依据 codeProof`)
      }
      if (e.status === 'GATED' && e.countedAsCompleted === false) errors.push(`STATUS_MISMATCH: ${e.id} status=GATED 却标 countedAsCompleted=false（状态与完成标记矛盾）`)
    }

    // ① 源码写调用必须登记
    for (const w of writes) {
      if (!declared.some((e) => e.method === w.method && pathEquals(e.endpoint, w.path))) {
        errors.push(`UNREGISTERED_WRITE: ${page.file}:${w.line} ${w.sym} ⇒ ${w.method} ${w.path} 未在 manifest 登记（新增未登记写调用）`)
      }
    }

    // ④② manifest ↔ 源码对账
    for (const e of gated) {
      const hit = writes.find((w) => w.method === e.method && pathEquals(e.endpoint, w.path))
      if (!hit) { errors.push(`ENDPOINT_MISMATCH: ${e.id} 声明 ${e.method} ${e.endpoint}，但源码未解析到该写调用（错绑端点或调用已移除）`); continue }
      const wired =
        new RegExp(`writeGate:\\s*${e.gateVar}\\b`).test(text) ||
        new RegExp(`${e.gateVar}\\.value\\.enabled`).test(text) ||
        new RegExp(`gateOrHint\\(\\s*${e.gateVar}\\s*\\)`).test(text)
      if (!wired) errors.push(`UNGATED_WRITE: ${e.id} 声明 status=GATED，但源码未见 ${e.gateVar} 接线（既无 writeGate 绑定，也无 ${e.gateVar}.value.enabled / gateOrHint(${e.gateVar}) 预检）`)
    }
    for (const e of entries.filter((x) => x.status === 'BLOCKED_BACKEND_CODE')) {
      const hit = writes.find((w) => w.method === e.method && pathEquals(e.endpoint, w.path))
      if (!hit) errors.push(`ENDPOINT_MISMATCH: ${e.id} 声明 ${e.method} ${e.endpoint}，但源码未解析到该写调用`)
    }

    stats.pages.push({ page: page.id, GATED: gated.length, BLOCKED_BACKEND_CODE: entries.filter((e) => e.status === 'BLOCKED_BACKEND_CODE').length, UI_ONLY: entries.filter((e) => e.status === 'UI_ONLY').length, READ_ONLY: entries.filter((e) => e.status === 'READ_ONLY').length, sourceWrites: writes.length })
    // ⑧ 端点集合守恒：manifest 登记的写端点集合 == 源码真实写端点集合（不多不少，三方同数）
    const srcSet = new Set(writes.map((w) => `${w.method} ${w.path}`))
    const manSet = new Set(entries.filter((e) => e.endpoint && e.method && ['GATED', 'BLOCKED_BACKEND_CODE'].includes(e.status)).map((e) => `${e.method} ${norm(e.endpoint)}`))
    const toKeySet = (s) => new Set([...s].map((k) => { const [m, p] = k.split(' '); return `${m} ${norm(p)}` }))
    const srcKeys = toKeySet(srcSet)
    const manKeys = toKeySet(manSet)
    // 端点数按"归一后的段级形态"比较（`{x}`/`${x}` 均已 → `*`）
    const onlySrc = [...srcKeys].filter((k) => ![...manKeys].some((m) => { const [mm, mp] = m.split(' '); const [, kp] = k.split(' '); return mm === k.split(' ')[0] && pathEquals(mp, kp) }))
    const onlyMan = [...manKeys].filter((k) => ![...srcKeys].some((s) => { const [, sp] = s.split(' '); const [, kp] = k.split(' '); return s.split(' ')[0] === k.split(' ')[0] && pathEquals(sp, kp) }))
    for (const k of onlySrc) errors.push(`SET_MISMATCH: ${page.id} 源码存在写端点 ${k}，manifest 未登记（审计器 ↔ manifest 数量不守恒）`)
    for (const k of onlyMan) errors.push(`SET_MISMATCH: ${page.id} manifest 登记了 ${k}，源码已无该写调用（数量不守恒 / 残留条目）`)
    stats.GATED += gated.length
    stats.BLOCKED_BACKEND_CODE += entries.filter((e) => e.status === 'BLOCKED_BACKEND_CODE').length
    stats.UI_ONLY += entries.filter((e) => e.status === 'UI_ONLY').length
    stats.READ_ONLY += entries.filter((e) => e.status === 'READ_ONLY').length
    stats.sourceWrites += writes.length
    stats.UNGATED += writes.filter((w) => !declared.some((e) => e.method === w.method && pathEquals(e.endpoint, w.path))).length
  }
  return { errors, stats }
}

const args = process.argv.slice(2)

if (args.includes('--self-test')) {
  const targets = { manifest: MANIFEST, createSale: join(SRC, 'pages/sales/create-sale.vue'), buttonGates: join(SRC, 'config/button-gates.ts') }
  const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
  const before = Object.fromEntries(Object.entries(targets).map(([k, p]) => [k, sha(p)]))
  const scenarios = [
    { key: 'createSale', name: 'M1 新增未登记写调用', file: targets.createSale, apply: (t) => t.replace('/** 保存（暂存草稿）', 'async function __probeUnregisteredWrite(holdNo: string) {\n  await storeApi.deleteHoldOrder(holdNo)\n}\n\n/** 保存（暂存草稿）') },
    { key: 'createSale', name: 'M2 摘掉目标按钮门', file: targets.createSale, apply: (t) => t.replace('writeGate: gatePurchaseIn', '/* M2: gate removed */') },
    { key: 'manifest', name: 'M3 manifest 错绑端点', file: targets.manifest, apply: (t) => t.replace('"endpoint": "/admin/receipts"', '"endpoint": "/admin/NOT-A-REAL-endpoint"') },
    { key: 'buttonGates', name: 'M4 权限失败改成放行', file: targets.buttonGates, apply: (t) => t.replace(/return deny\(\s*\n\s*'unavailable',\s*\n\s*BUTTON_HINTS\.unavailable,\s*\n\s*`三态=\$\{view\.viewState\}（\$\{view\.policy\}）⇒ 失败关闭`\s*\n\s*\)/, "return { status: 'allowed', enabled: true, showHint: false, hint: '', stale: false, reason: 'M4 probe: 失败改成放行' }") },
    {
      key: 'manifest',
      name: 'M5 计数守恒破坏（真实写伪装成 UI_ONLY 减少 GATED）',
      file: targets.manifest,
      apply: (t) => {
        // manifest 现为多行 JSON ⇒ 必须走 JSON 改写，字符串 replace 会静默失配（注入不生效=假反测）
        const j = JSON.parse(t)
        const e = j.entries.find((x) => x.id === 'cs-submitReceipt')
        if (!e || e.status !== 'GATED') throw new Error('M5 前置不成立：cs-submitReceipt 不是 GATED')
        e.status = 'UI_ONLY'
        e.permissionCodes = []
        return JSON.stringify(j, null, 2) + '\n'
      },
    },
  ]
  let ok = true
  for (const s of scenarios) {
    const orig = readFileSync(s.file, 'utf8')
    const mutated = s.apply(orig)
    const injected = mutated !== orig
    writeFileSync(s.file, mutated, 'utf8')
    const { errors } = run()
    const red = errors.length > 0
    const kind = errors[0] ? errors[0].split(':')[0] : '—'
    writeFileSync(s.file, orig, 'utf8')
    const restored = sha(s.file) === before[s.key]
    const green = run().errors.length === 0
    const pass = injected && red && restored && green
    console.log(`${pass ? '✓' : '✗'} ${s.name}｜注入生效=${injected} 判红=${red}（点名 ${errors.length} 条，首条判据=${kind}）逐字节复原=${restored} 复绿=${green}`)
    if (!pass) { ok = false; errors.slice(0, 3).forEach((e) => console.log('      · ' + e)) }
  }
  console.log(ok ? 'SELF-TEST PASS：五条注入（M1-M5，含计数守恒红例）均点名变红且逐字节复原后复绿' : 'SELF-TEST FAIL')
  process.exit(ok ? 0 : 1)
}

const { errors, stats } = run()
if (args.includes('--json')) console.log(JSON.stringify({ errors, stats }, null, 2))
else {
  console.log(`guard-button-gates · 三方守恒（manifest ↔ 源码绑定 ↔ API 端点）`)
  for (const p of stats.pages) console.log(`  ${p.page}: GATED=${p.GATED} BLOCKED_BACKEND_CODE=${p.BLOCKED_BACKEND_CODE} UI_ONLY=${p.UI_ONLY} READ_ONLY=${p.READ_ONLY} 源码写调用=${p.sourceWrites}`)
  console.log(`  合计：GATED=${stats.GATED}｜BLOCKED_BACKEND_CODE=${stats.BLOCKED_BACKEND_CODE}｜UI_ONLY=${stats.UI_ONLY}｜READ_ONLY=${stats.READ_ONLY}｜UNGATED=${stats.UNGATED}`)
  for (const e of errors) console.log('  ✗ ' + e)
  console.log(errors.length ? `✗ 判红 ${errors.length} 条 ⇒ EXIT=1` : '✓ 三方数量守恒、门控接线完整、码合法、失败关闭 ⇒ EXIT=0')
}
process.exit(errors.length ? 1 : 0)
