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
 * 两条都是**具名 + 紧判据**，且第二条是 29F2 现场取证后补入的（29F1 只打印不裁决，
 * 把下面这条空壳与 hideTabBar 混为一谈）：
 *   ① uni 运行时在非 TabBar 页调 hideTabBar 的失败（凌舟 2026-10-24 裁定归为已知噪声）；
 *   ② Playwright **工具侧空壳**错误：ctor=PlaywrightError、name/stack 为空、log 为空数组
 *      （实测字段 `{"name":"","ctor":"PlaywrightError","keys":["log","name"],"inspect":"[Object] { log: [] }","stack":""}`），
 *      不含任何页面运行时信息，稳定出现 1 条且与上传链路无关（15 条上传断言全绿）。
 *      判据刻意收紧到"三项全空"，任何带 message / stack / 非空 log 的 PlaywrightError 仍判红。 */
const KNOWN_PAGEERRORS = [
  { id: 'hideTabBar:fail not TabBar page', match: (hay) => hay.includes('hideTabBar:fail not TabBar page') },
  {
    id: 'PlaywrightError 空壳（工具侧：name/stack 为空且 log 为空数组，非页面运行时错误）',
    match: (_hay, parts) => parts && parts.ctor === 'PlaywrightError' && !parts.name && !parts.stack && parts.logLen === 0
  }
]

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
          const known = KNOWN_PAGEERRORS.find((k) => k.match(hay, parts)) || null
          results.pageErrors.push({ raw: String(raw).slice(0, 500), knownId: known ? known.id : null, parts: {
            name: parts.name, ctor: parts.ctor, logLen: parts.logLen,
            keys: parts.keys,
            inspect: String(parts.inspect).slice(0, 800),
            stack: String(parts.stack || '').slice(0, 800)
          } })
          log('pageerror:', known ? `已知豁免（${known.id}）` : `未知 ⇒ 判红：${String(raw).slice(0, 200)}`)
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

        // 反测注入口（仅 SMOKE_INJECT_PAGEERROR 有值时生效，正式跑不带该变量）：
        // 让页面抛一个**未知** pageerror，用于验证"未知 pageerror 必须判红"这一裁决本身有效
        // （§9.1：反测装置必须在已知坏版本上跑出红）。
        if (process.env.SMOKE_INJECT_PAGEERROR) {
          log('反测注入未知 pageerror：', process.env.SMOKE_INJECT_PAGEERROR)
          await page.evaluate((msg) => {
            setTimeout(() => { throw new Error(msg) }, 0)
          }, process.env.SMOKE_INJECT_PAGEERROR)
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

main()
