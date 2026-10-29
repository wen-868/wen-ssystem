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

/** 页面 import：局部名 → {module, orig}；另收 @/api/request 裸请求动词（MOBILE-32F4） */
function parseImports(text) {
  const map = new Map()
  const reqVerbs = new Map()
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
  // MOBILE-32F4：部分页面直接 `import { get, put, post } from '@/api/request'` 调请求层
  //（如 member-detail.vue）——此前守卫只认 api/modules 封装层，这些写调用点不可见 = 审计盲区。
  // 局部名即请求动词名（get/post/put/del/patch/upload），method 以 requestVerbs() 实测为准。
  const req = /import\s*\{([^}]+)\}\s*from\s*['"]@\/api\/request['"]/g
  while ((m = req.exec(text))) {
    for (const raw of m[1].split(',')) {
      const t = raw.trim()
      if (!t || t.startsWith('type ')) continue
      const as = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(t)
      const local = as ? (as[2] || as[1]) : null
      if (local && VERB[local]) reqVerbs.set(local, local)
    }
  }
  return { map, reqVerbs }
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
  const { map: imports, reqVerbs } = parseImports(text)
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
      // MOBILE-32F4：@/api/request 裸请求动词调用（路径以调用点行内字面量为准）
      if (reqVerbs.has(b[1])) {
        const c = findRequestCall(lines, i, i + 1)
        if (c && V[c.verb] !== 'GET') {
          const sym = `request.${c.verb}`
          if (!raw.some((x) => x.sym === sym && x.line === i + 1)) raw.push({ line: i + 1, sym, method: V[c.verb], path: norm(c.path), apiLine: c.line })
        }
        continue
      }
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

/**
 * 后端权限实证表（MOBILE-32F3 新增，卡§五.2/§五.3 的权威源）
 *   codes   ：backend/src 下 .ts 里 requirePermission("x:y") / requirePermission(PERM_X) 的全部码
 *   lineAt  ：某 routes.ts 文件某行的原文（供 codeProof 复核）
 *   consts  ：PERM_* 常量名 → 码值（后端用常量挂码时，行内不含字面量，需二级解析）
 * 后端不在本仓可达路径（例如只做前端 CI 检出）⇒ 返回 null，主校验退化为仅查前端注册表（并在读数里标注）。
 */
function backendPermissionTable() {
  const beSrc = resolve(ROOT, '..', 'backend', 'src')
  if (!existsSync(join(beSrc, 'routes'))) return null
  const codes = new Set()
  const consts = new Map()
  const files = new Map()
  const stack = [beSrc]
  while (stack.length) {
    const d = stack.pop()
    for (const ent of readdirSync(join(d, ''), { withFileTypes: true })) {
      const p = join(d, ent.name)
      if (ent.isDirectory()) { if (!/node_modules|__tests__/.test(ent.name)) stack.push(p); continue }
      if (!ent.name.endsWith('.ts')) continue
      let t
      try { t = readFileSync(p, 'utf8') } catch { continue }
      for (const m of t.matchAll(/requirePermission\(\s*["'`]([^"'`]+)["'`]/g)) codes.add(m[1])
      for (const m of t.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*["'`]([^"'`:]+:[^"'`]+)["'`]/g)) consts.set(m[1], m[2])
      for (const m of t.matchAll(/requirePermission\(\s*([A-Z][A-Z0-9_]*)\s*\)/g)) { const v = consts.get(m[1]); if (v) codes.add(v) }
      if (/\.routes\.ts$/.test(ent.name)) files.set(ent.name, t.split(/\r?\n/))
    }
  }
  return {
    codes,
    consts,
    lineAt: (file, ln) => (files.get(file) || [])[ln - 1] ?? null,
    /** 该 routes.ts 文件所属路由器的挂载前缀（`{ prefix: "/api/xxx", router: XRouter }`） */
    prefixOf: (file, ln) => {
      const lines = files.get(file) || []
      // 找本文件里的 router 变量名
      const rvm = /(\w+)\.(?:get|post|put|delete|patch)\(\s*["'`]/.exec(lines[ln - 1] || '')
      if (!rvm) return null
      const rv = rvm[1]
      const p = new RegExp(`\\{\\s*prefix:\\s*["'\`]([^"'\`]+)["'\`]\\s*,\\s*router:\\s*${rv}\\b`).exec(lines.join('\n'))
      return p ? p[1] : null
    },
    fileCount: files.size,
  }
}

/** 后端挂载前缀含 /api，manifest 端点不含 ⇒ 归一后再比 */
const normApi = (p) => norm(String(p || '').replace(/^\/api(?=\/)/, ''))

/** 主校验 */
function run() {
  const errors = []
  if (!existsSync(MANIFEST)) return { errors: ['MISSING_MANIFEST: ' + MANIFEST], stats: null }
  let manifest
  try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) } catch (e) { return { errors: ['MANIFEST_NOT_JSON: ' + e.message], stats: null } }
  const byModule = buildIndex()

  // ③ 权限码合法性（MOBILE-32F3 起：以后端实文为权威源，前端注册表为辅证）
  //    卡§五.2/§五.3 的判据是「后端实证权限码」，故：
  //     · 码 ∈ 后端 requirePermission 全集 ⇒ 合法；
  //     · 否则仅当已在前端注册表登记且给出 codeProof 才放行（防止把注册表当免检金牌）；
  //     · status=GATED 必须给 codeProof，且该 `routes.ts:行` 实文确实挂了这个码（含常量间接引用）
  //       ⇒ 机检不通过即 CODEPROOF_MISMATCH（比"字符串在不在注册表里"更强：错绑他页码会被点名）。
  const pgText = readFileSync(join(SRC, 'config/permission-gates.ts'), 'utf8')
  const known = new Set([...pgText.matchAll(/['"]([a-z][a-z0-9_]*(?::[a-z*][a-z0-9_:-]*)?)['"]/g)].map((m) => m[1]))
  const be = backendPermissionTable()
  if (be && be.codes.size) {
    for (const c of known) if (!be.codes.has(c)) { /* 前端注册表有、后端无 ⇒ 不判红（入口门可先于后端），仅计入统计 */ }
  }

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
      for (const c of e.permissionCodes || []) {
        if (!c) continue
        const inBackend = be && be.codes.has(c)
        if (!inBackend && !known.has(c)) errors.push(`UNKNOWN_CODE: ${e.id} → 权限码 "${c}" 既未出现在后端 requirePermission 实文，也未在 config/permission-gates.ts 注册`)
      }
      // 卡§五.2：status=GATED 的码必须有后端行号实证，且该行实文确实挂了这个码
      if (e.status === 'GATED') {
        if (!e.codeProof) errors.push(`GATED_MISSING_PROOF: ${e.id} status=GATED 但无 codeProof（须给出 backend routes.ts:行 + requirePermission 码）`)
        else if (be) {
          const m = /([\w.-]+\.routes\.ts):(\d+)/.exec(e.codeProof)
          if (!m) errors.push(`CODEPROOF_UNPARSEABLE: ${e.id} codeProof 内找不到 "xxx.routes.ts:行" ⇒ ${String(e.codeProof).slice(0, 80)}`)
          else {
            const [, file, ln] = m
            const row = be.lineAt(file, Number(ln))
            if (!row) errors.push(`CODEPROOF_MISMATCH: ${e.id} codeProof 指向 ${file}:${ln}，但该文件无此行或文件不存在`)
            else if (!/requirePermission/.test(row)) errors.push(`CODEPROOF_MISMATCH: ${e.id} codeProof 声称 ${file}:${ln} 挂码，实文无 requirePermission ⇒ ${row.trim().slice(0, 90)}`)
            else {
              const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              for (const claimed of e.permissionCodes || []) {
                if (!claimed) continue
                const literal = new RegExp(`requirePermission\\(\\s*["'\`]${esc(claimed)}["'\`]`).test(row)
                const viaConst = [...row.matchAll(/requirePermission\(\s*([A-Z][A-Z0-9_]*)\s*\)/g)].some((cm) => be.consts.get(cm[1]) === claimed)
                if (!literal && !viaConst) errors.push(`CODEPROOF_MISMATCH: ${e.id} 声称 ${file}:${ln} 挂 "${claimed}"，实文不是该码 ⇒ ${row.trim().slice(0, 100)}`)
              }
              // ⚠️ 仅核"该行挂了某某码"是不够的：把 A 动作绑到 B 页面的码、再抄 B 页那一行的行号，
              //    上面逐码比对照样通过（MOBILE-32F3 自测 M7 实测踩中）。
              //    ⇒ 必须再核**该行注册的端点是否就是本条目声明的端点**（含 /api 前缀归一与参数段等价）。
              if (e.method && e.endpoint) {
                const rm = new RegExp(`\\.(get|post|put|delete|patch)\\(\\s*["'\`]([^"'\`]*)["'\`]`).exec(row)
                const BE_VERB = { get: 'GET', post: 'POST', put: 'PUT', delete: 'DELETE', patch: 'PATCH' }
                if (!rm) errors.push(`CODEPROOF_MISMATCH: ${e.id} codeProof 指向 ${file}:${ln}，但该行不是路由注册行（无法核对端点）`)
                else {
                  const [, rverb, rsub] = rm
                  const prefix = be.prefixOf(file, ln)
                  const full = normApi((prefix ?? '') + rsub)
                  const want = normApi(e.endpoint)
                  if (BE_VERB[rverb] !== e.method || !pathEquals(full, want)) {
                    errors.push(`CODEPROOF_ENDPOINT_MISMATCH: ${e.id} 声明 ${e.method} ${e.endpoint}，但 codeProof 所指 ${file}:${ln} 注册的是 ${BE_VERB[rverb]} ${full}（错绑到别的端点/别的页）`)
                  }
                }
              }
            }
          }
        }
      }
      if (e.status === 'GATED' && !(e.permissionCodes || []).length) errors.push(`STATUS_MISMATCH: ${e.id} status=GATED 但 permissionCodes 为空（无码即无从判定，应登记 BLOCKED_BACKEND_CODE 或 blocked）`)
      if (e.status === 'BLOCKED_BACKEND_CODE' && (e.permissionCodes || []).length) errors.push(`STATUS_MISMATCH: ${e.id} status=BLOCKED_BACKEND_CODE 却带权限码 "${e.permissionCodes.join(',')}"（伪造码）`)
      if ((e.status === 'UI_ONLY' || e.status === 'READ_ONLY') && e.method && e.method !== 'GET' && !String(e.endpoint).includes(',')) errors.push(`FAKE_UI_ONLY: ${e.id} 登记为 ${e.status} 却带 ${e.method} ${e.endpoint}（真实写不得伪装成 UI 开关）`)
      // 卡 §三.4：BLOCKED_BACKEND_CODE 不得计入 GATED 完成数 ⇒ 必须显式标注 counted_as_completed=false
      if (e.status === 'BLOCKED_BACKEND_CODE') {
        if (e.countedAsCompleted !== false) errors.push(`BLOCKED_COUNTED_AS_DONE: ${e.id} 后端无码，必须 countedAsCompleted=false 且不得计入 GATED 完成数`)
        if (e.codeProof === undefined) errors.push(`BLOCKED_MISSING_PROOF: ${e.id} 必须给出后端无 requirePermission 的行号依据 codeProof`)
        // 卡§五.3：后端确无挂码的端点不得伪造码，且**不得有任何已批准的写尝试**
        if (e.approvedWriteAttempts !== 0) errors.push(`BLOCKED_MISSING_ZERO_ATTEMPTS: ${e.id} status=BLOCKED_BACKEND_CODE 必须 approvedWriteAttempts=0（当前 ${JSON.stringify(e.approvedWriteAttempts)}）`)
      }
      if (e.status === 'GATED' && e.approvedWriteAttempts !== undefined) errors.push(`STATUS_MISMATCH: ${e.id} status=GATED 不应带 approvedWriteAttempts（该字段专属于 BLOCKED_BACKEND_CODE 的"零写尝试"承诺）`)
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
        new RegExp(`gateOrHint\\(\\s*${e.gateVar}\\s*\\)`).test(text) ||
        // 模板内联形态（transfer / receipts 既有风格；MOBILE-32F3 expenses 沿用 receipts 风格）：
        //   @tap="gateX.enabled && fn()"  —— 点击前短路
        //   :disabled="!gateX.enabled"    —— 按钮禁用
        // 只认**带 && 的短路或 ! 取反**，裸 ${e.gateVar}.enabled 出现在插值文案里不算接线。
        new RegExp(`@tap[^=]*=\\s*"[^"]*${e.gateVar}\\.enabled\\s*&&`).test(text) ||
        new RegExp(`:disabled="!${e.gateVar}\\.enabled"`).test(text)
      if (!wired) errors.push(`UNGATED_WRITE: ${e.id} 声明 status=GATED，但源码未见 ${e.gateVar} 接线（既无 writeGate 绑定，也无 ${e.gateVar}.value.enabled / gateOrHint(${e.gateVar}) / 模板 gate 短路预检）`)
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
  const targets = {
    manifest: MANIFEST,
    createSale: join(SRC, 'pages/sales/create-sale.vue'),
    expenses: join(SRC, 'pages-sub/finance/finance/expenses.vue'),
    memberDetail: join(SRC, 'pages-sub/marketing/member/member-detail.vue'),
    buttonGates: join(SRC, 'config/button-gates.ts'),
  }
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
    // ===== MOBILE-32F3 新增四类反测（逐条对应卡§六） =====
    {
      key: 'expenses',
      name: 'M6[卡§六.1] 删掉费用页「通过」按钮的 gate 绑定',
      file: targets.expenses,
      apply: (t) => t.replace('@tap.stop="gateExpenseApprove.enabled && approveExpense(item)"', '@tap.stop="approveExpense(item)"'),
    },
    {
      key: 'manifest',
      name: 'M7[卡§六.2] 把费用动作绑到收款页的码（跨页错绑）',
      file: targets.manifest,
      apply: (t) => {
        const j = JSON.parse(t)
        const e = j.entries.find((x) => x.id === 'exp-approve')
        if (!e) throw new Error('M7 前置不成立：缺 exp-approve')
        // 同时改码与其"实证"行号，模拟"把错绑伪装成已核实"
        e.permissionCodes = ['finance:receipt:create']
        e.codeProof = 'receipt.routes.ts:23 requirePermission("finance:receipt:create")'
        return JSON.stringify(j, null, 2) + '\n'
      },
    },
    {
      key: 'manifest',
      name: 'M8[卡§六.3] 把 BLOCKED_BACKEND_CODE 伪造为可用码',
      file: targets.manifest,
      apply: (t) => {
        const j = JSON.parse(t)
        const e = j.entries.find((x) => x.id === 'cs-submitPayment')
        if (!e || e.status !== 'BLOCKED_BACKEND_CODE') throw new Error('M8 前置不成立：cs-submitPayment 不是 BLOCKED')
        e.status = 'GATED'
        e.permissionCodes = ['finance:payment'] // 后端该端点确无此码 ⇒ 伪造
        e.codeProof = 'payment-new.routes.ts:14 requirePermission("finance:payment")'
        e.countedAsCompleted = true
        delete e.approvedWriteAttempts
        return JSON.stringify(j, null, 2) + '\n'
      },
    },
    {
      key: 'buttonGates',
      name: 'M9[卡§六.4] 让权限请求失败路径返回 allowed',
      file: targets.buttonGates,
      apply: (t) => {
        // 失败关闭的**兜底收尾**是 resolveButtonGate 末尾那句
        //   return deny('unavailable', BUTTON_HINTS.unavailable, `三态=${view.viewState}…`)
        // 把它改成放行 = "权限取不到也当有权限"（卡§六.4 要打的就是这条路径）。
        // 注意 M4 打的是 guard 判据⑥的 fail-closed 特征（deny('unavailable') 字面消失），
        // M9 打的是**行为**（运行态真会放行），两条各守一处，互不替代。
        const m = /return\s+deny\(\s*\n?\s*'unavailable',[\s\S]{0,220}?\)\s*\n\}/.exec(t)
        if (!m) return t
        return t.replace(
          m[0],
          `return { status: 'allowed', enabled: true, showHint: false, hint: '', stale: false, reason: 'M9 probe: 权限失败放行' }\n}`,
        )
      },
    },
    // ===== MOBILE-32F4 新增六条（会员三页；JSON 改写均走结构化，防字符串静默失配） =====
    {
      key: 'memberDetail',
      name: 'M10[F4] 会员详情写调用端点漂移（新增客户改指不存在的端点）',
      file: targets.memberDetail,
      apply: (t) => t.replace("post('/store/members/manage', payload)", "post('/store/members/manage-probe', payload)"),
    },
    {
      key: 'manifest',
      name: 'M11[F4] 把无码的会员新增伪造为 GATED 并配假实证',
      file: targets.manifest,
      apply: (t) => {
        const j = JSON.parse(t)
        const e = j.entries.find((x) => x.id === 'mbr-dtl-create')
        if (!e || e.status !== 'BLOCKED_BACKEND_CODE') throw new Error('M11 前置不成立：mbr-dtl-create 不是 BLOCKED')
        e.status = 'GATED'
        e.permissionCodes = ['member:manage'] // 后端该端点确无此码 ⇒ 伪造
        e.codeProof = 'store.routes.ts:44 requirePermission("member:manage")'
        e.countedAsCompleted = true
        delete e.approvedWriteAttempts
        return JSON.stringify(j, null, 2) + '\n'
      },
    },
    {
      key: 'manifest',
      name: 'M12[F4] 会员编辑条目端点错绑（PUT 改指他端点）',
      file: targets.manifest,
      apply: (t) => {
        const j = JSON.parse(t)
        const e = j.entries.find((x) => x.id === 'mbr-dtl-update')
        if (!e) throw new Error('M12 前置不成立：缺 mbr-dtl-update')
        e.endpoint = '/admin/members/{id}'
        return JSON.stringify(j, null, 2) + '\n'
      },
    },
    {
      key: 'manifest',
      name: 'M13[F4] 把 BLOCKED 充值动作计入完成（countedAsCompleted 翻真）',
      file: targets.manifest,
      apply: (t) => {
        const j = JSON.parse(t)
        const e = j.entries.find((x) => x.id === 'mbr-dtl-recharge')
        if (!e || e.status !== 'BLOCKED_BACKEND_CODE') throw new Error('M13 前置不成立：mbr-dtl-recharge 不是 BLOCKED')
        e.countedAsCompleted = true
        return JSON.stringify(j, null, 2) + '\n'
      },
    },
    {
      key: 'manifest',
      name: 'M14[F4] 删掉积分调整条目的无码实证（codeProof 消失）',
      file: targets.manifest,
      apply: (t) => {
        const j = JSON.parse(t)
        const e = j.entries.find((x) => x.id === 'mbr-dtl-points-adjust')
        if (!e || e.status !== 'BLOCKED_BACKEND_CODE') throw new Error('M14 前置不成立：mbr-dtl-points-adjust 不是 BLOCKED')
        delete e.codeProof
        return JSON.stringify(j, null, 2) + '\n'
      },
    },
    {
      key: 'manifest',
      name: 'M15[F4] 把列表「新增」导航伪造为 GATED 写动作',
      file: targets.manifest,
      apply: (t) => {
        const j = JSON.parse(t)
        const e = j.entries.find((x) => x.id === 'mbr-list-add')
        if (!e || e.status !== 'UI_ONLY') throw new Error('M15 前置不成立：mbr-list-add 不是 UI_ONLY')
        e.status = 'GATED'
        e.permissionCodes = ['member:manage']
        e.codeProof = 'store.routes.ts:44 requirePermission("member:manage")'
        return JSON.stringify(j, null, 2) + '\n'
      },
    },
  ]
  let ok = true
  for (const s of scenarios) {
    const orig = readFileSync(s.file, 'utf8')
    const mutated = s.apply(orig)
    const injected = mutated !== orig
    if (!injected) {
      console.log(`✗ ${s.name}｜注入未生效（字符串/结构未匹配 ⇒ 这是假反测，必须修判据而不是记账）`)
      ok = false
      continue
    }
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
  console.log(ok ? `SELF-TEST PASS：${scenarios.length} 条注入（M1-M${scenarios.length}）均点名变红且逐字节复原后复绿` : 'SELF-TEST FAIL')
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
