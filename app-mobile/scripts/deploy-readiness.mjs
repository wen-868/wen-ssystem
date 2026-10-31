/**
 * MOBILE-H5-DEPLOY-READINESS-01 · 生产 H5 产物部署就绪工具
 *
 * 双用途：
 *  A) 作为模块被 vitest 导入（tests/h5-deploy-readiness.spec.ts）——对 dist/build/h5 的
 *     静态审计纯函数（绝对路径/开发端口/密钥/资源缺失/index 完整性/artifact manifest）；
 *  B) 作为 CLI（node scripts/deploy-readiness.mjs --preview）——启动「静态服务 + /api 反代」
 *     的本地生产预览，用 playwright 做路由直达/刷新与双尺寸截图，产出证据与 artifact manifest。
 *
 * 红线：不发布、不上传、不写服务器配置；/api 只反代到本机隔离后端（127.0.0.1:18111）。
 */
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createConnection } from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
export const DIST = resolve(HERE, '..', 'dist', 'build', 'h5')

/** 预览验证的路由集（卡§三.2：≥6 条，覆盖登录/首页/会员/费用/收款/对账） */
export const PREVIEW_ROUTES = [
  { path: '#/pages/login/login', marker: '登录', name: '登录页' },
  { path: '#/pages/home/home', marker: '首页', name: '首页' },
  { path: '#/pages-sub/marketing/member/member', marker: '会员中心', name: '会员中心' },
  { path: '#/pages-sub/marketing/member/member-list', marker: '会员管理', name: '会员列表' },
  { path: '#/pages-sub/finance/finance/expenses', marker: '费用', name: '费用管理' },
  { path: '#/pages-sub/finance/receipts/receipts', marker: '收款', name: '收款管理' },
  { path: '#/pages-sub/finance/reconciliation/reconciliation', marker: '对账', name: '对账中心' },
]

const TEXT_EXTS = new Set(['.html', '.js', '.css', '.json', '.map', '.svg', '.txt'])
/** 密钥扫描只认高置信形态（避免把应用自身的存储键名/文案当密钥） */
const SECRET_PATTERNS = [
  [/BEGIN [A-Z ]*PRIVATE KEY/, '私钥块'],
  [/AKIA[0-9A-Z]{16}/, 'AWS AccessKey'],
  [/sk-[A-Za-z0-9]{20,}/, 'sk- 形态密钥'],
  [/ghp_[A-Za-z0-9]{30,}/, 'GitHub PAT'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/eyJhbGciOi[A-Za-z0-9_.-]{80,}/, '硬编码 JWT'],
]
const ABS_PATH_RE = /(?:[A-Za-z]:\\[\w\-\\.]+|\/Users\/[\w-]+\/|\/home\/[\w-]+\/|file:\/\/\/[\w\-/.]*)/
const DEV_PORT_RE = /(?:localhost|127\.0\.0\.1):5173|:5173\/|localhost:3000\b|127\.0\.0\.1:3000\b/

function walk(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, base, out)
    else out.push({ file: p, rel: p.slice(base.length + 1).replace(/\\/g, '/') })
  }
  return out
}

/** 静态资源审计：绝对路径 / 开发端口 / 高置信密钥 / 引用了但不存在的资源 */
export function auditArtifact(distDir = DIST) {
  const findings = { absolutePaths: [], devPorts: [], secrets: [], missingAssets: [], scanned: 0, totalBytes: 0 }
  if (!existsSync(distDir)) return { ...findings, indexHtml: false }
  const files = walk(distDir)
  const exists = new Set(files.map((f) => f.rel))
  for (const { file, rel } of files) {
    findings.scanned++
    findings.totalBytes += statSync(file).size
    if (!TEXT_EXTS.has(extname(file))) continue
    const text = readFileSync(file, 'utf8')
    const am = text.match(ABS_PATH_RE)
    if (am) findings.absolutePaths.push(`${rel} ⇒ ${am[0].slice(0, 60)}`)
    const pm = text.match(DEV_PORT_RE)
    if (pm) findings.devPorts.push(`${rel} ⇒ ${pm[0]}`)
    for (const [re, name] of SECRET_PATTERNS) {
      const sm = text.match(re)
      if (sm) findings.secrets.push(`${rel} ⇒ ${name}:${sm[0].slice(0, 24)}…`)
    }
    // 本地资源引用完整性（html 的 src/href 与 js/css 内的相对资源引用）
    for (const m of text.matchAll(/(?:src|href)=["'](\/?[\w\-./]+\.[a-z]{2,4})(?:\?[^"']*)?["']/gi)) {
      const ref = m[1].replace(/^\//, '')
      if (/^(https?:)?\/\//.test(m[1]) || ref.startsWith('static/')) {
        if (m[1].startsWith('/') && !existsSync(join(distDir, ref)) && !exists.has(ref)) findings.missingAssets.push(`${rel} ⇒ ${m[1]}`)
      } else {
        const resolved = rel.includes('/') ? join(dirname(rel), ref).replace(/\\/g, '/') : ref
        if (!exists.has(resolved) && !existsSync(join(distDir, resolved))) findings.missingAssets.push(`${rel} ⇒ ${ref}`)
      }
    }
  }
  return { ...findings, indexHtml: existsSync(join(distDir, 'index.html')) }
}

/** artifact manifest：HEAD / 逐文件与总体 SHA256 / 文件数与总大小 / 生成时间 / 路由集 */
export function buildArtifactManifest(distDir = DIST, routes = PREVIEW_ROUTES, head = null) {
  const files = walk(distDir)
  const perFile = {}
  let totalBytes = 0
  for (const { file, rel } of files) {
    const buf = readFileSync(file)
    perFile[rel] = createHash('sha256').update(buf).digest('hex')
    totalBytes += buf.length
  }
  const treeSha = createHash('sha256')
  for (const rel of Object.keys(perFile).sort()) treeSha.update(`${rel}  ${perFile[rel]}\n`)
  return {
    head: head ?? gitHead(),
    distTreeSha256: treeSha.digest('hex'),
    fileCount: files.length,
    totalBytes,
    generatedAt: new Date().toISOString(),
    routes: routes.map((r) => r.path),
    perFileCount: Object.keys(perFile).length,
  }
}

function gitHead() {
  try {
    const wt = resolve(HERE, '..', '..')
    const r = spawnSync('git', ['-C', wt, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
    return (r.stdout || '').trim() || null
  } catch { return null }
}

/** 静态服务 + /api 反代（本地生产预览专用；handler 独立导出供测试） */
export function createPreviewHandler(apiBase = 'http://127.0.0.1:18111') {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }
  return function handler(req, res) {
    const url = new URL(req.url, 'http://preview.local')
    if (url.pathname.startsWith('/api/')) {
      // 反代到隔离后端：透传方法/头/体
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        const target = apiBase + url.pathname + url.search
        const preq = (target.startsWith('https') ? httpsRequest : httpRequest)(target, { method: req.method, headers: { ...req.headers, host: new URL(apiBase).host } }, (pres) => {
          res.writeHead(pres.statusCode, pres.headers)
          pres.pipe(res)
        })
        preq.on('error', () => { res.writeHead(502); res.end('{"code":502,"msg":"preview proxy: isolated backend unreachable"}') })
        if (chunks.length) preq.write(Buffer.concat(chunks))
        preq.end()
      })
      return
    }
    let rel = decodeURIComponent(url.pathname).replace(/^\//, '')
    if (rel === '' || !extname(rel)) rel = 'index.html' // SPA 兜底：无扩展名路径一律回 index.html（hash 路由由前端接管）
    const file = join(DIST, rel)
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  }
}

/* ---------- CLI：--preview ---------- */
const argv = process.argv.slice(2)
if (argv.includes('--preview')) {
  const WT = resolve(HERE, '..', '..')
  const BE = join(WT, 'backend')
  const EVID = 'D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/MOBILE-H5-DEPLOY-READINESS-01'
  const RAW = join(EVID, 'raw')
  mkdirSync(RAW, { recursive: true })
  const lines = []
  const log = (s) => { lines.push(s); console.log(s) }
  const MD = 'D:/Users/ZXQL/wt-agents/_s3194-evidence/mysql8046/mysql-8.0.46-winx64'
  const RT = 'D:/Users/ZXQL/wt-agents/_f1-rt'
  const { pathToFileURL } = await import('node:url')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const supervised = []
  const supervise = (cmd, args, opts = {}) => { const p = spawn(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], ...opts }); supervised.push(p); return p }
  const portOpen = (port) => new Promise((res) => { const s = createConnection({ port, host: '127.0.0.1', timeout: 1500 }); s.on('connect', () => { s.destroy(); res(true) }); s.on('error', () => res(false)); s.on('timeout', () => { s.destroy(); res(false) }) })
  const waitPort = async (port, tries) => { for (let i = 0; i < tries; i++) { if (await portOpen(port)) return true; await sleep(2000) } return false }
  process.on('exit', () => { for (const p of supervised) { try { spawnSync('taskkill', ['/T', '/F', '/PID', String(p.pid)], { shell: true, stdio: 'ignore' }) } catch {} } })

  const audit = auditArtifact()
  const manifest = buildArtifactManifest()
  writeFileSync(join(EVID, 'artifact-manifest.json'), JSON.stringify({ ...manifest, audit }, null, 2) + '\n', 'utf8')
  log(`MOBILE-H5-DEPLOY-READINESS-01 · 生产 H5 本地预览（${manifest.generatedAt}）`)
  log(`dist=${DIST}`)
  log(`manifest: head=${manifest.head} treeSha256=${manifest.distTreeSha256} files=${manifest.fileCount} bytes=${manifest.totalBytes}`)
  log(`audit: 绝对路径=${audit.absolutePaths.length} 开发端口=${audit.devPorts.length} 密钥=${audit.secrets.length} 缺失资源=${audit.missingAssets.length} indexHtml=${audit.indexHtml}`)
  if (!audit.indexHtml) { log('FATAL: index.html 缺失'); writeFileSync(join(RAW, '20-preview-run.txt'), lines.join('\n'), 'utf8'); process.exit(1) }

  // 隔离后端（仅 /api 反代目标；未起则拉起，与既有证据口径一致）
  if (!(await portOpen(3411))) {
    supervise(join(MD, 'bin', 'mysqld.exe'), [`--no-defaults`, `--datadir=${RT}/mysql-data`, `--basedir=${MD}`, '--port=3411', `--tmpdir=${RT}/mysql-tmp`])
    if (!(await waitPort(3411, 40))) { log('⚠ mysqld 未起（预览继续，仅数据页不可用）') }
  }
  if (!(await portOpen(18111))) {
    supervise('node', ['--import', 'tsx', 'src/server.ts'], { cwd: BE })
    if (!(await waitPort(18111, 60))) log('⚠ backend 未起（预览继续，仅数据页不可用）')
  }

  const server = createServer(createPreviewHandler('http://127.0.0.1:18111'))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`
  log(`[静态生产预览] ${base}（/api → 127.0.0.1:18111 反代）`)

  const { chromium } = await import(pathToFileURL('D:/Users/ZXQL/ZXQL-MS/wen-ssystem/node_modules/playwright/index.mjs').href)
  const browser = await chromium.launch({ headless: true })

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  const failed404 = []
  page.on('response', (r) => { if (r.status() === 404) failed404.push(`${r.status()} ${r.url().replace(base, '')}`) })

  let routeFail = 0
  // 登录页在**未认证阶段**验证：已登录访问登录页被弹回首页是正确的路由守卫行为
  const loginRoute = PREVIEW_ROUTES[0]
  await page.goto(`${base}/${loginRoute.path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await sleep(3500)
  const lDirect = await page.evaluate((mk) => (document.body.innerText || '').includes(mk), loginRoute.marker)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await sleep(3000)
  const lRefresh = await page.evaluate((mk) => (document.body.innerText || '').includes(mk), loginRoute.marker)
  if (lDirect && lRefresh) log(`  ✓ ${loginRoute.name} ${loginRoute.path}｜未认证直达=true 刷新=true`)
  else { routeFail++; log(`  ✗ ${loginRoute.name} 未认证直达=${lDirect} 刷新=${lRefresh}`) }

  // 真实登录（走预览站自己的 /api 反代 ⇒ 生产产物 + 相对路径 API 的真实行为）
  await page.goto(`${base}/#/pages/login/login`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await sleep(4000)
  await page.evaluate(() => { window.__u = 'store_manager'; window.__p = 'F1rtTest#2026' })
  await page.evaluate(() => {
    const setV = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    const ins = [...document.querySelectorAll('uni-input input')]
    if (ins.length >= 2) { setV(ins[0], window.__u); setV(ins[1], window.__p) }
    return ins.length
  })
  await sleep(500)
  // 生产产物按钮文案为「登 录」（带空格）⇒ 匹配前必须去空白；找不到则记录现场按钮文本
  const clickRes = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, '')
    const b = [...document.querySelectorAll('.login-btn, button')].find((x) => norm(x.textContent).includes('登录'))
    if (!b) return { ok: false, btns: [...document.querySelectorAll('button')].map((x) => norm(x.textContent)).slice(0, 6), hash: location.hash }
    b.click()
    return { ok: true }
  })
  log(`[登录点击] ${JSON.stringify(clickRes)}`)
  await sleep(5000)
  log(`[登录] merchant_token=${await page.evaluate(() => !!localStorage.getItem('merchant_token') || Object.keys(localStorage).some((k) => k.includes('merchant_token')))}`)

  for (const r of PREVIEW_ROUTES.slice(1)) {
    // SPA 直达
    await page.goto(`${base}/${r.path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await sleep(3500)
    const direct = await page.evaluate(() => (document.body.innerText || '').slice(0, 2000))
    const directOk = direct.includes(r.marker)
    // 刷新
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await sleep(3000)
    const refreshed = await page.evaluate(() => (document.body.innerText || '').slice(0, 2000))
    const refreshOk = refreshed.includes(r.marker)
    const ok = directOk && refreshOk
    if (!ok) routeFail++
    log(`  ${ok ? '✓' : '✗'} ${r.name} ${r.path}｜直达=${directOk} 刷新=${refreshOk}（marker「${r.marker}」）`)
  }
  if (failed404.length) { routeFail++; log(`  ✗ 静态资源 404：${failed404.slice(0, 8).join(' ‖ ')}`) }
  else log('  ✓ 无静态资源 404')

  // 双尺寸截图（1440×1000 桌面 + 390×844 移动）
  await page.goto(`${base}/${PREVIEW_ROUTES[3].path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await sleep(3500)
  await page.screenshot({ path: join(RAW, 'screenshot-1440x1000.png'), fullPage: false })
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mpage = await mob.newPage()
  await mpage.goto(`${base}/${PREVIEW_ROUTES[3].path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await sleep(3500)
  await mpage.screenshot({ path: join(RAW, 'screenshot-390x844.png'), fullPage: false })
  await mob.close()
  log('  ✓ 截图：screenshot-1440x1000.png / screenshot-390x844.png（会员列表）')

  await browser.close()
  server.close()
  const manifestLine = `artifact: head=${manifest.head} treeSha256=${manifest.distTreeSha256} files=${manifest.fileCount} bytes=${manifest.totalBytes} generatedAt=${manifest.generatedAt}`
  log(manifestLine)
  log(`${routeFail === 0 ? 'H5_DEPLOY_PREVIEW_PASS（生产产物本地预览：路由直达/刷新、静态资源、双尺寸截图）' : `H5_DEPLOY_PREVIEW_FAIL（${routeFail} 项）`}`)
  writeFileSync(join(RAW, '20-preview-run.txt'), lines.join('\n'), 'utf8')
  process.exit(routeFail === 0 ? 0 : 1)
}
