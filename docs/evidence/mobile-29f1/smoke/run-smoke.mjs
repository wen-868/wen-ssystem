#!/usr/bin/env node
/**
 * MOBILE-29F1 · 真实 H5 上传冒烟编排（§8.9 留档可复跑）
 *
 * 链路（全部真实件，无 mock）：
 *   Vite dev:h5（VITE_API_BASE=http://127.0.0.1:5199/api，经 .env.local 注入）
 *     → 页面内动态 import('/src/api/modules/profile.ts') / products.ts
 *     → 真实 profileApi.uploadAvatar(blobUrl) / uploadImage(blobUrl)
 *     → uni.uploadFile（H5 真实 XHR multipart）
 *     → Express+multer 冒烟服务（127.0.0.1:5199）
 *     → 服务端 records 取证：boundary 在场、req.file 非空、字段名/大小/类型正确
 *
 * 用法：node run-smoke.mjs
 * 产物：results.json（同目录）；上传文件本体落 uploads/；全程日志 stdout。
 * 退出码：0 = 冒烟通过；1 = 任一断言失败（含环境起不来）。
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const EVIDENCE = resolve(HERE, '..')
const APP_MOBILE = resolve(EVIDENCE, '../../..', 'app-mobile') // app-mobile/
const SMOKE_PORT = 5199
const SMOKE_BASE = `http://127.0.0.1:${SMOKE_PORT}`
const ENV_LOCAL = join(APP_MOBILE, '.env.local')

// 1x1 透明 PNG（68 字节）——任意合法字节即可，multer 不校验图片内容
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PNG_BYTES = Buffer.from(PNG_B64, 'base64').length

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
/** 起子进程并把输出转记到 stdout（带前缀），返回 { proc, waitText }
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

async function main() {
  mkdirSync(join(HERE, 'uploads'), { recursive: true })
  const results = { ok: false, steps: {}, assertions: [], error: null }

  // ── 1. 冒烟服务 ─────────────────────────────────────────────
  const server = spawnLogged(process.execPath, [join(HERE, 'server.cjs')], { cwd: HERE, env: { ...process.env, PORT: String(SMOKE_PORT) } }, 'smoke-srv')
  try {
    await waitFor(async () => (await fetch(`${SMOKE_BASE}/__health`)).ok, 30000, '冒烟服务 /__health')
    results.steps.smokeServer = 'up'
    log('冒烟服务就绪', SMOKE_BASE)

    // ── 2. dev:h5（.env.local 注入 VITE_API_BASE；gitignored（*.local），teardown 删除）──
    const envExisted = existsSync(ENV_LOCAL)
    const envBackup = envExisted ? readFileSync(ENV_LOCAL) : null
    writeFileSync(ENV_LOCAL, `VITE_API_BASE=${SMOKE_BASE}/api\n`, 'utf8')
    const dev = spawnLogged('npm', ['run', 'dev:h5'], { cwd: APP_MOBILE, env: { ...process.env }, shell: true }, 'dev-h5')
    let devUrl = null
    try {
      devUrl = await waitFor(async () => {
        const m = dev.getText().match(/Local:\s*(http:\/\/\S+?)\s*$/m) || dev.getText().match(/(http:\/\/localhost:\d+\/?)/)
        if (!m) return null
        const u = new URL(m[1])
        try { const r = await fetch(u.origin, { signal: AbortSignal.timeout(2000) }); return r.ok || r.status === 404 ? u.origin : null } catch { return null }
      }, 180000, 'dev:h5 本地地址可访')
      // 若上面超时，错误信息不带 dev 输出不便定位——这里主动 dump 尾部（仅超时路径到不了，作为保险保留）
      results.steps.devH5 = devUrl
      log('dev:h5 就绪', devUrl)

      // ── 3. Playwright 驱动真实上传 ───────────────────────────
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        page.on('pageerror', (e) => log('pageerror:', e.message))
        await page.goto(devUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForFunction(() => typeof window.uni !== 'undefined' && typeof window.uni.uploadFile === 'function', { timeout: 60000 })
        log('uni 运行时在位，开始驱动上传')

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

        const A = (name, cond, detail) => results.assertions.push({ name, pass: !!cond, detail })
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
      } finally {
        await browser.close()
      }
    } finally {
      dev.proc.kill('SIGTERM')
      await sleep(500)
      try { process.kill(-dev.proc.pid, 'SIGTERM') } catch { /* 非进程组 */ }
      if (envBackup !== null) writeFileSync(ENV_LOCAL, envBackup)
      else rmSync(ENV_LOCAL, { force: true })
    }

    results.ok = results.assertions.every((a) => a.pass)
  } catch (e) {
    results.error = String(e && e.stack || e)
  } finally {
    server.proc.kill('SIGTERM')
    await sleep(300)
    try { process.kill(-server.proc.pid, 'SIGTERM') } catch { /* 非进程组 */ }
  }

  writeFileSync(join(HERE, 'results.json'), JSON.stringify(results, null, 2), 'utf8')
  console.log('\n========== 冒烟断言汇总 ==========')
  for (const a of results.assertions) console.log(`${a.pass ? '✓' : '✗'} ${a.name}${a.pass ? '' : `  ⇒ ${a.detail}`}`)
  console.log('================================\n')
  log(results.ok ? 'SMOKE PASS（EXIT=0）' : 'SMOKE FAIL（EXIT=1）', `results → ${join(HERE, 'results.json')}`)
  process.exit(results.ok ? 0 : 1)
}

main()
