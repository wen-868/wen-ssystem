#!/usr/bin/env node
/**
 * MOBILE-29F2 · 真实 H5 上传冒烟编排（§8.9 留档可复跑）
 *
 * 链路（全部真实件，无 mock）：
 *   Vite dev:h5（VITE_API_BASE=http://127.0.0.1:5199/api，经 .env.local 注入）
 *     → 页面内动态 import('/src/api/modules/profile.ts') / products.ts
 *     → 真实 profileApi.uploadAvatar(blobUrl) / uploadImage(blobUrl)
 *     → uni.uploadFile（H5 真实 XHR multipart）
 *     → Express+multer 冒烟服务（127.0.0.1:5199）
 *     → 服务端 records 取证：boundary 在场、req.file 非空、字段名/大小/类型正确
 *
 * ★ MOBILE-29F2 相对 29F1 的两处强化（凌舟 2026-10-24 验收阻断项 3.1 / 驳回事实 4）：
 *   ① env 卫生：同时**快照并恢复**「工作树根 .env.local」与「app-mobile/.env.local」
 *      两处（29F1 只处理了 app-mobile，根的残留被 .gitignore 隐藏 ⇒ git status 假净，
 *      且从仓库根跑 spec 会把基址解析成 5199 冒烟地址 ⇒ 假红）；且经 process.on('exit')
 *      与信号钩子兜底，**异常退出也清理**，不依赖 teardown 分支被执行。
 *   ② pageerror 分类：仅允许具名已知 `hideTabBar:fail not TabBar page`；其它 pageerror
 *      或无法取到原文的未知对象一律**判红并留原文**（29F1 只打印不裁决）。
 *
 * 用法：node run-smoke.mjs
 * 产物：results.json（同目录）；上传文件本体落 uploads/；全程日志 stdout。
 * 退出码：0 = 冒烟通过；1 = 任一断言失败（含环境起不来）。
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { inspect } from 'node:util'
import net from 'node:net'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const EVIDENCE = resolve(HERE, '..')
const APP_MOBILE = resolve(EVIDENCE, '../../..', 'app-mobile') // app-mobile/
const ROOT = resolve(APP_MOBILE, '..') // 工作树根
const SMOKE_PORT = 5199
const SMOKE_BASE = `http://127.0.0.1:${SMOKE_PORT}`

// ★ MOBILE-29F2：两处 env 都要管（根 + app-mobile），顺序固定便于留档核对
const ENV_FILES = [join(ROOT, '.env.local'), join(APP_MOBILE, '.env.local')]
const INJECT = `VITE_API_BASE=${SMOKE_BASE}/api\n`

// 1x1 透明 PNG（70 字节）——任意合法字节即可，multer 不校验图片内容
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PNG_BYTES = Buffer.from(PNG_B64, 'base64').length

/** 具名已知噪声（白名单）——只有命中这里才允许豁免，其它一律判红
 *
 * ★ MOBILE-29F3（凌舟 2026-10-24 驳回后收紧）：
 *   29F2 的判据 `ctor==='PlaywrightError' && !name && !stack && logLen===0` **不够精确**——
 *   它不查 message / keys / inspect，也不限次数 ⇒ 任何同构造器、空 name/stack、空 log 的
 *   未知结构化对象（如凌舟注入的 `{name:'',message:'unknown-object-marker',log:[]}`）
 *   都会被当成"已知空壳"洗白（实测 SMOKE PASS/EXIT=0）。
 *   29F3 收紧为**逐字段精确 signature**，并限制同类空壳在单次冒烟中最多出现 1 条：
 *     - ctor === 'PlaywrightError'（构造器名精确）；
 *     - message 精确 === 'Object'（依据 29F2 留档实测：raw 恰为 "Object" 而 inspect 为
 *       "[Object] { log: [] }" ⇒ message 是字面 'Object' 且非枚举自有属性，见
 *       `docs/evidence/mobile-29f3/00-signature-forensics-from-29f2-tracked-results.md`）；
 *     - name === ''、stack === ''（空字符串精确，不是"缺失/falsy"）；
 *     - log 恰为空数组（Array.isArray 且 length === 0）；
 *     - keys **恰为** ['log','name']（集合相等、不得有额外字段）；
 *     - inspect 精确 === '[Object] { log: [] }'（稳定序列化，不接受正则宽泛匹配）。
 *   任一字段不满足（不同 message / 额外键 / 非空 stack / 第二条同类）⇒ 判红并留原文。 */
const KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE = Object.freeze({
  ctor: 'PlaywrightError',
  message: 'Object',
  name: '',
  stack: '',
  logLen: 0,
  keys: ['log', 'name'],
  inspect: '[Object] { log: [] }',
  maxOccurrences: 1 // 单次冒烟允许 0 或 1 条；>1 ⇒ 判红
})

/** 已知 PlaywrightError 空壳的精确判据（逐字段；全部相等才豁免） */
function isKnownPlaywrightErrorShell(parts) {
  if (!parts) return false
  if (parts.ctor !== KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.ctor) return false
  // message 精确 === 'Object'（29F2 留档实测：raw 恰为 "Object"，而 inspect 为 "[Object] { log: [] }"；
  // 若 message 为 falsy，raw 会等于 inspect 全文 ⇒ 证明现场 message 就是字面 'Object'，
  // 且它是**非枚举自有属性**（keys 只有 ['log','name']）。不接受 message||inspect 的宽松取值。）
  if (parts.message !== KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.message) return false
  if (parts.name !== KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.name) return false
  if (String(parts.stack || '') !== KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.stack) return false
  if (parts.logLen !== KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.logLen) return false
  const sigKeys = KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.keys
  const partsKeys = Array.isArray(parts.keys) ? [...parts.keys].sort() : []
  const sigSorted = [...sigKeys].sort()
  if (partsKeys.length !== sigSorted.length) return false
  for (let i = 0; i < sigSorted.length; i++) if (partsKeys[i] !== sigSorted[i]) return false
  if (parts.inspect !== KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.inspect) return false
  return true
}

const KNOWN_PAGEERRORS = [
  { id: 'hideTabBar:fail not TabBar page', match: (hay) => hay.includes('hideTabBar:fail not TabBar page') },
  {
    id: 'PlaywrightError 空壳（29F3 精确 signature：ctor/message/name/stack/log/keys/inspect 逐字段相等）',
    match: (_hay, parts) => isKnownPlaywrightErrorShell(parts)
  }
]

/** ★ MOBILE-29F3：可复用裁决器工厂 —— 把"同类已知空壳单次最多 maxOccurrences(=1) 条"
 *   的次数上限封进闭包：冒烟内部用它，`docs/evidence/mobile-29f3/` 的反测装置也能
 *   **直接 import 单测**（不必起浏览器即可证明"第二条同类 ⇒ 判红"）。
 *   judge(hay, parts) ⇒ { known, shell, overLimit }；known=null 即判红。 */
export function createPageErrorJudge(limit = KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE.maxOccurrences) {
  let shellSeen = 0
  return function judge(hay, parts) {
    if (hay.includes('hideTabBar:fail not TabBar page')) return { known: KNOWN_PAGEERRORS[0], shell: false, overLimit: false }
    const shell = isKnownPlaywrightErrorShell(parts)
    if (!shell) return { known: null, shell: false, overLimit: false }
    shellSeen += 1
    const overLimit = shellSeen > limit
    return { known: overLimit ? null : KNOWN_PAGEERRORS[1], shell: true, overLimit }
  }
}

export { isKnownPlaywrightErrorShell, KNOWN_PLAYWRIGHT_ERROR_SHELL_SIGNATURE }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('[run-smoke]', ...a)

async function waitFor(fn, timeoutMs, what, interval = 1000) {
  const t0 = Date.now()
  for (;;) {
    try { const v = await fn(); if (v) return v } catch { /* keep waiting */ }
    if (Date.now() - t0 > timeoutMs) throw new Error(`等待超时：${what}（${timeoutMs}ms）`)
    await sleep(interval)
  }
}

/** 起子进程并把输出转记到 stdout（带前缀），返回 { proc, getText }
 *  注意：text 累加时剥离 ANSI 颜色码（vite banner 的 `Local` 被 \x1b[1m..\x1b[22m 包裹，
 *  不剥则字面 `Local:` 不存在、URL 匹配正则永远落空）；stdout 转记保留原样。 */
function spawnLogged(cmd, args, opts, prefix) {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
  let text = ''
  const pump = (buf) => { const s = buf.toString(); text += s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, ''); process.stdout.write(`[${prefix}] ${s}`) }
  proc.stdout.on('data', pump)
  proc.stderr.on('data', pump)
  return { proc, getText: () => text }
}

// ─────────────── env 快照 / 恢复（★ MOBILE-29F2 核心）───────────────
const envSnapshots = new Map()
function snapshotEnvs() {
  for (const f of ENV_FILES) {
    if (existsSync(f)) {
      const buf = readFileSync(f)
      envSnapshots.set(f, { existed: true, sha: createHash('sha256').update(buf).digest('hex'), buf })
    } else {
      envSnapshots.set(f, { existed: false })
    }
  }
  log('env 快照：', ENV_FILES.map((f) => {
    const s = envSnapshots.get(f)
    return `${f} ⇒ ${s.existed ? '存在 sha=' + s.sha.slice(0, 12) : '不存在'}`
  }).join(' | '))
}
function injectEnvs() {
  for (const f of ENV_FILES) writeFileSync(f, INJECT, 'utf8')
  log('env 已注入：', ENV_FILES.join(' , '))
}
let restored = false
function restoreEnvsOnce(why) {
  if (restored) return
  restored = true
  const done = []
  for (const f of ENV_FILES) {
    const snap = envSnapshots.get(f)
    if (!snap) continue
    try {
      if (!snap.existed) { rmSync(f, { force: true }); done.push(`${f} ⇒ 删除（快照时不存在）`) }
      else { writeFileSync(f, snap.buf); done.push(`${f} ⇒ 复原 sha=${snap.sha.slice(0, 12)}`) }
    } catch (e) { done.push(`${f} ⇒ 恢复失败：${e.message}`) }
  }
  log(`env 恢复（触发：${why}）：`, done.join(' | ') || '（无快照可恢复）')
}
// 兜底：正常 / 异常 / 信号退出都会走到（29F1 教训：只靠 finally 分支，被中断就残留）
process.on('exit', () => restoreEnvsOnce('exit'))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { restoreEnvsOnce(sig); process.exit(1) })

function portFree(port) {
  return new Promise((r) => {
    const s = net.createConnection(port, '127.0.0.1')
    s.on('connect', () => { s.destroy(); r(false) })
    s.on('error', () => r(true))
  })
}

async function main() {
  mkdirSync(join(HERE, 'uploads'), { recursive: true })
  const results = { ok: false, steps: {}, assertions: [], pageErrors: [], env: {}, error: null }
  const A = (name, cond, detail) => results.assertions.push({ name, pass: !!cond, detail })
  snapshotEnvs()

  // ── 1. 冒烟服务 ─────────────────────────────────────────────
  const server = spawnLogged(process.execPath, [join(HERE, 'server.cjs')], { cwd: HERE, env: { ...process.env, PORT: String(SMOKE_PORT) } }, 'smoke-srv')
  try {
    await waitFor(async () => (await fetch(`${SMOKE_BASE}/__health`)).ok, 30000, '冒烟服务 /__health')
    results.steps.smokeServer = 'up'
    log('冒烟服务就绪', SMOKE_BASE)

    // ── 2. dev:h5（两处 .env.local 注入 VITE_API_BASE；走快照恢复，不依赖 gitignore）──
    injectEnvs()
    const dev = spawnLogged('npm', ['run', 'dev:h5'], { cwd: APP_MOBILE, env: { ...process.env }, shell: true }, 'dev-h5')
    let devUrl = null
    try {
      devUrl = await waitFor(async () => {
        const m = dev.getText().match(/Local:\s*(http:\/\/\S+?)\s*$/m) || dev.getText().match(/(http:\/\/localhost:\d+\/?)/)
        if (!m) return null
        const u = new URL(m[1])
        try { const r = await fetch(u.origin, { signal: AbortSignal.timeout(2000) }); return r.ok || r.status === 404 ? u.origin : null } catch { return null }
      }, 180000, 'dev:h5 本地地址可访')
      results.steps.devH5 = devUrl
      log('dev:h5 就绪', devUrl)

      // ── 3. Playwright 驱动真实上传 ───────────────────────────
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        // ★ MOBILE-29F2：pageerror 先收集再分类裁决（不再只打印）
        // ★ MOBILE-29F3：改用 createPageErrorJudge() —— 逐字段精确 signature + 同类空壳单次冒烟
        //   最多 maxOccurrences(=1) 条，第二条同类 ⇒ 不豁免、按未知判红（凌舟裁定 3）。
        const judgePageError = createPageErrorJudge()
        page.on('pageerror', (e) => {
          // ★ MOBILE-29F2：取证要能定位来源——pageerror 可能是非 Error 抛出（实测 uni 运行时
          // 会抛 message 为 "Object" 的对象），只记 message 会永远查不出是谁抛的，故全字段留原文。
          const parts = {
            name: e && e.name,
            message: e && e.message,
            ctor: e && e.constructor && e.constructor.name,
            keys: e && typeof e === 'object' ? Object.keys(e).slice(0, 20) : undefined,
            logLen: Array.isArray(e && e.log) ? e.log.length : undefined,
            inspect: (() => { try { return inspect(e, { depth: 2, breakLength: 200 }) } catch { return '(inspect failed)' } })(),
            stack: e && e.stack
          }
          const hay = [parts.name, parts.message, parts.ctor, parts.inspect, parts.stack].filter(Boolean).join('\n')
          const raw = String(parts.message || parts.inspect || '(空)')
          const verdict = judgePageError(hay, parts)
          const known = verdict.known
          results.pageErrors.push({ raw: String(raw).slice(0, 500), knownId: known ? known.id : null, parts: {
            name: parts.name, message: parts.message, ctor: parts.ctor, logLen: parts.logLen,
            keys: parts.keys,
            inspect: String(parts.inspect).slice(0, 800),
            stack: String(parts.stack || '').slice(0, 800)
          } })
          if (verdict.overLimit) {
            log('pageerror: 已知空壳**超出 maxOccurrences=1**（第二次同类）⇒ 判红：', String(raw).slice(0, 200))
          } else {
            log('pageerror:', known ? `已知豁免（${known.id}）` : `未知 ⇒ 判红：${String(raw).slice(0, 200)}`)
          }
          if (!known) log('pageerror 全字段原文：', JSON.stringify(results.pageErrors[results.pageErrors.length - 1].parts).slice(0, 800))
        })
        // 辅助取证：收集页面 console（用于坐实 pageerror 与 uni 运行时噪声的同源关系）
        results.console = []
        page.on('console', (msg) => {
          const t = msg.text()
          results.console.push({ type: msg.type(), text: String(t).slice(0, 300) })
          if (/hideTabBar|tabbar|TabBar/i.test(t)) log('console(hideTabBar 线索):', String(t).slice(0, 200))
        })
        await page.goto(devUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForFunction(() => typeof window.uni !== 'undefined' && typeof window.uni.uploadFile === 'function', { timeout: 60000 })
        log('uni 运行时在位，开始驱动上传')

        // 反测注入口 A（仅 SMOKE_INJECT_PAGEERROR 有值时生效，正式跑不带该变量）：
        // 让页面抛一个**未知** pageerror（普通 Error），用于验证"未知 pageerror 必须判红"这一裁决本身有效
        // （§9.1：反测装置必须在已知坏版本上跑出红）。
        if (process.env.SMOKE_INJECT_PAGEERROR) {
          log('反测注入未知 pageerror（普通 Error）：', process.env.SMOKE_INJECT_PAGEERROR)
          await page.evaluate((msg) => {
            setTimeout(() => { throw new Error(msg) }, 0)
          }, process.env.SMOKE_INJECT_PAGEERROR)
          await sleep(500)
        }

        // ★ MOBILE-29F3 反测注入口 B（仅 SMOKE_INJECT_UNKNOWN_OBJ=1 时生效，正式跑不带）：
        // 抛 凌舟 2026-10-24 的**结构化未知对象**反例 `{name:'',message:'unknown-object-marker',log:[]}`。
        // 29F2 的宽泛判据（不查 message/keys/inspect、不限次数）会把它当"已知空壳"洗白 ⇒ SMOKE PASS/EXIT=0；
        // 29F3 收紧后 message 与 keys 均不精确匹配 signature ⇒ **必须 EXIT=1**（凌舟裁定 4）。
        if (process.env.SMOKE_INJECT_UNKNOWN_OBJ === '1') {
          log('反测注入未知 pageerror（结构化未知对象 name="" / message="unknown-object-marker" / log=[]）')
          await page.evaluate(() => {
            setTimeout(() => { throw { name: '', message: 'unknown-object-marker', log: [] } }, 0)
          })
          await sleep(500)
        }

        const drive = await page.evaluate(async (pngB64) => {
          const bin = Uint8Array.from(atob(pngB64), (c) => c.charCodeAt(0))
          const blob = new Blob([bin], { type: 'image/png' })
          const url = URL.createObjectURL(blob)
          const out = { avatar: null, image: null, avatarErr: null, imageErr: null }
          try {
            const prof = await import('/src/api/modules/profile.ts')
            out.avatar = await prof.profileApi.uploadAvatar(url)
          } catch (e) { out.avatarErr = String(e && e.message || e) }
          try {
            const prod = await import('/src/api/modules/products.ts')
            out.image = await prod.uploadImage(url)
          } catch (e) { out.imageErr = String(e && e.message || e) }
          return out
        }, PNG_B64)
        results.steps.drive = drive
        log('页面内上传结果', JSON.stringify(drive))

        // ── 4. 服务端取证 + 断言 ───────────────────────────────
        await waitFor(async () => (await (await fetch(`${SMOKE_BASE}/__records`)).json()).length >= 2, 15000, '服务端收到两条上传记录')
        const records = await (await fetch(`${SMOKE_BASE}/__records`)).json()
        results.records = records

        A('恰好两条上传记录（avatar + image）', records.length === 2, `records=${records.length}`)
        const avatar = records.find((r) => r.endpoint === '/api/admin/auth/avatar')
        const image = records.find((r) => r.endpoint === '/api/admin/products/upload-image')
        A('avatar 记录存在', !!avatar)
        A('image 记录存在', !!image)
        for (const [tag, rec, field] of [['avatar', avatar, 'avatar'], ['image', image, 'image']]) {
          if (!rec) continue
          A(`${tag}: Content-Type 为浏览器 multipart 且 boundary 在场`, rec.hasBoundary && /^multipart\/form-data/.test(rec.contentType), rec.contentType)
          A(`${tag}: multer 零错误（旧 bug 会在此报 boundary 错）`, !rec.multerError, String(rec.multerError))
          A(`${tag}: req.file 非空且字段名=${field}`, !!rec.file && rec.file.fieldname === field, JSON.stringify(rec.file))
          A(`${tag}: 文件大小与页面 blob 逐字节一致（${PNG_BYTES}B）`, !!rec.file && rec.file.size === PNG_BYTES, `${rec.file && rec.file.size}`)
          A(`${tag}: 文件 MIME 为 image/png`, !!rec.file && /^image\/png/.test(rec.file.mimetype), rec.file && rec.file.mimetype)
        }
        A('页面内 uploadAvatar 成功解出 data.avatar', !!drive.avatar && typeof drive.avatar.avatar === 'string' && drive.avatar.avatar.length > 0, JSON.stringify(drive.avatarErr || drive.avatar))
        A('页面内 uploadImage 成功解出 url', typeof drive.image === 'string' && drive.image.length > 0, JSON.stringify(drive.imageErr || drive.image))

        // ★ MOBILE-29F2：pageerror 分类裁决
        const unknown = results.pageErrors.filter((e) => !e.knownId)
        const knownIds = [...new Set(results.pageErrors.filter((e) => e.knownId).map((e) => e.knownId))]
        A(
          '无未知 pageerror（仅允许具名 hideTabBar:fail not TabBar page）',
          unknown.length === 0,
          unknown.length ? `未知 ${unknown.length} 条：${JSON.stringify(unknown.map((e) => e.raw))}` : `已知豁免：${knownIds.join(',') || '（无 pageerror）'}`
        )
      } finally {
        await browser.close()
      }
    } finally {
      dev.proc.kill('SIGTERM')
      await sleep(500)
      try { process.kill(-dev.proc.pid, 'SIGTERM') } catch { /* 非进程组 */ }
    }
  } catch (e) {
    results.error = String(e && e.stack || e)
  } finally {
    server.proc.kill('SIGTERM')
    await sleep(300)
    try { process.kill(-server.proc.pid, 'SIGTERM') } catch { /* 非进程组 */ }
    // 正常 / 异常路径都先恢复 env（process.on('exit') 是二次兜底）
    restoreEnvsOnce('teardown')
  }

  // ── 5. 交付态卫生核验（★ MOBILE-29F2：不以 gitignore 后的 git status 干净为准）──
  const envAfter = {}
  for (const f of ENV_FILES) envAfter[f] = existsSync(f) ? readFileSync(f, 'utf8') : null
  results.env = {
    files: ENV_FILES,
    after: envAfter,
    residue: ENV_FILES.filter((f) => envAfter[f] !== null),
    smokePortHits: Object.values(envAfter).filter((v) => v && v.includes(`127.0.0.1:${SMOKE_PORT}`)).length
  }
  A(
    '交付态：根与 app-mobile 均无 .env.local 残留',
    results.env.residue.length === 0,
    results.env.residue.length ? `残留：${results.env.residue.join(' , ')}` : '两处均已清理'
  )
  A(
    `交付态：两处 .env* 中 127.0.0.1:${SMOKE_PORT} 命中为 0`,
    results.env.smokePortHits === 0,
    `命中 ${results.env.smokePortHits} 处`
  )
  const free = await portFree(SMOKE_PORT)
  A(`冒烟端口 ${SMOKE_PORT} 已释放`, free, free ? 'free' : 'OCCUPIED')

  results.ok = results.assertions.length > 0 && results.assertions.every((a) => a.pass)
  writeFileSync(join(HERE, 'results.json'), JSON.stringify(results, null, 2), 'utf8')
  console.log('\n========== 冒烟断言汇总 ==========')
  for (const a of results.assertions) console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.pass ? '' : `  ⇒ ${a.detail}`}`)
  console.log('================================\n')
  log(results.ok ? 'SMOKE PASS（EXIT=0）' : 'SMOKE FAIL（EXIT=1）', `results → ${join(HERE, 'results.json')}`)
  process.exit(results.ok ? 0 : 1)
}

// ★ MOBILE-29F3：仅在**被直接执行**时跑冒烟；被反测装置 `import` 时只导出判据函数。
//   （import 会求值整个模块，若无此守卫，反测装置 import 一次就会起一场完整冒烟。）
const selfPath = resolve(fileURLToPath(import.meta.url))
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === selfPath) main()
