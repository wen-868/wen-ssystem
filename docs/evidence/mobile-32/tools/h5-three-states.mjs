/**
 * MOBILE-32 · H5 三态运行态取证 v2 —— 先证明"页面真的渲染了目标按钮"，再判三态
 *
 * v1 的教训（自我报备，见回传卡）：dev server 起来了但页面未渲染（`Local:` 只代表 vite 启动），
 * 于是三态全拿到"空 DOM"，`写请求=0` 恒真 ⇒ 假绿。v2 加两道**前置断言**：
 *   ① 目标页必须至少渲染出 1 个写按钮（`.action-btn`/`.create-btn`/`button`），否则直接 FAIL；
 *   ② 必须观察到按钮随权限变化（有权限态 vs 无权限态 的 disabled 至少一处不同），
 *      否则说明"权限没接进页面"，同样 FAIL。
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '../../../../app-mobile')
const OUT = resolve(HERE, '../raw')
const PORT = 5299
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const STATES = {
  'ready-granted': {
    label: '有权限（STORE_MANAGER 持 store:transfer）',
    me: { id: 1, username: 'mgr', realName: '店长', roles: ['STORE_MANAGER'], storeId: 1, tenantId: 't1', permissions: ['store:transfer', 'sale:create', 'goods:edit', 'finance:create'] },
    menus: ['dashboard', 'finance', 'finance:transfer'],
  },
  'ready-denied': {
    label: '无权限（STORE_OPERATOR 不持 store:transfer）',
    me: { id: 2, username: 'op', realName: '店员', roles: ['STORE_OPERATOR'], storeId: 1, tenantId: 't1', permissions: ['sale:create'] },
    menus: ['dashboard', 'finance', 'finance:transfer'],
  },
  'unavailable': {
    label: '权限失败（/auth/me 500）',
    meError: true,
    menus: ['dashboard'],
  },
}

let activeState = 'ready-granted'
const records = { writes: [] }

function stub() {
  return createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
    const st = STATES[activeState]
    const json = (o, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(o)) }
    const ok = (data) => json({ code: '0', msg: 'ok', data, traceId: 't' })

    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      // ⚠️ 必须排除 OPTIONS：那是浏览器 CORS 预检，不是业务写请求（v2 曾把它计入 ⇒ 三态都"有写"）
      req.resume()
      req.on('end', () => { records.writes.push(`${req.method} ${url.pathname}`); ok({}) })
      return
    }
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); return res.end() }
    if (url.pathname === '/api/admin/auth/me') {
      if (st.meError) return json({ code: '500', msg: '服务器繁忙', data: null, traceId: 't' }, 500)
      return ok(st.me)
    }
    // 登录接口：让"真走登录流程"可行（v2 教训：只注入 localStorage 会被 App.vue 的 token 检查与页面守卫打回登录页）
    if (url.pathname.includes('/auth/login')) {
      return ok({
        token: 'stub-token',
        csrfToken: 'stub-csrf',
        user: st.me || { id: 9, username: 'x', roles: [], permissions: [] },
      })
    }
    if (url.pathname === '/api/admin/menus/user') return ok(st.menus)
    if (url.pathname.startsWith('/api/admin/transfers')) return ok({ records: [], list: [], total: 0, page: 1, pageSize: 20 })
    return ok([])
  })
}

/** 页面探针：等目标页出现写按钮，并读取按钮 disabled 与提示文案 */
const PROBE = () => {
  const pick = () => {
    const cands = [...document.querySelectorAll('.action-btn, .create-btn, .fab-btn, button, uni-button')]
    return cands.map((b) => ({
      cls: (b.className || '').toString().slice(0, 40),
      text: (b.textContent || '').trim().slice(0, 16),
      disabled: b.hasAttribute('disabled') || b.disabled === true,
      opacity: (() => { try { return getComputedStyle(b).opacity } catch { return '' } })(),
    }))
  }
  const hint = document.querySelector('.gate-hint-text')
  return { btns: pick(), hint: hint ? (hint.textContent || '').trim() : '', hash: location.hash, bodyLen: document.body.innerHTML.length }
}

async function runState(key, browser, base) {
  activeState = key
  records.writes.length = 0
  const st = STATES[key]
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  const cons = []
  page.on('console', (m) => cons.push(`${m.type()}: ${m.text()}`.slice(0, 160)))

  // 注入登录态（localStorage 明文键 + enc_ 前缀两套；storage.ts 拦截器读 enc_）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.evaluate((me) => {
    try {
      const u = JSON.stringify(me || {})
      localStorage.setItem('merchant_token', 'stub-token')
      localStorage.setItem('enc_merchant_token', JSON.stringify({ data: 'stub-token' }))
      localStorage.setItem('merchant_user', u)
      localStorage.setItem('enc_merchant_user', JSON.stringify({ data: u }))
      localStorage.setItem('merchant_tenant_id', 't1')
      localStorage.setItem('enc_merchant_tenant_id', JSON.stringify({ data: 't1' }))
      localStorage.setItem('merchant_csrf_token', 'stub-csrf')
      localStorage.setItem('enc_merchant_csrf_token', JSON.stringify({ data: 'stub-csrf' }))
    } catch {}
  }, st.me)

  // 关键：注入后**必须重新加载**（App.vue 的 onLaunch 在首次加载时已判定"无 token → 登录页"
  // 并 reLaunch 到 /pages/login/login；仅写 localStorage 不改当前路由，会一直停在登录页）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await sleep(1200)
  const afterReloadHash = await page.evaluate(() => location.hash)

  await page.goto(`${base}#/pages-sub/finance/transfer/transfer`, { waitUntil: 'domcontentloaded' })
  // 等按钮出现（最多 25s；出现即返回）
  let probe = null
  for (let i = 0; i < 25; i++) {
    await sleep(1000)
    probe = await page.evaluate(PROBE)
    if (probe.btns.length > 0) break
  }
  await sleep(800)
  probe = await page.evaluate(PROBE)
  await page.close()
  return { state: key, label: st.label, writes: [...records.writes], probe, errs: errs.slice(0, 5), cons: cons.slice(0, 8) }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const server = await new Promise((r) => { const s = stub(); s.listen(PORT, '127.0.0.1', () => r(s)) })

  const envFiles = [join(APP, '..', '.env.local'), join(APP, '.env.local')]
  const snap = envFiles.map((f) => ({ f, buf: existsSync(f) ? readFileSync(f) : null }))
  for (const f of envFiles) writeFileSync(f, `VITE_API_BASE=http://127.0.0.1:${PORT}/api\n`, 'utf8')

  const dev = spawn('npm', ['run', 'dev:h5'], { cwd: APP, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  dev.stdout.on('data', (b) => (out += b)); dev.stderr.on('data', (b) => (out += b))

  const restore = () => {
    for (const s of snap) { try { if (s.buf === null) rmSync(s.f, { force: true }); else writeFileSync(s.f, s.buf) } catch {} }
    try { dev.kill('SIGTERM') } catch {}
    try { server.close() } catch {}
  }
  process.on('exit', restore)

  let base = null
  for (let i = 0; i < 90; i++) {
    await sleep(2000)
    const m = out.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').match(/Local:\s*(http:\/\/\S+)/)
    if (m) { base = m[1].trim(); break }
  }
  if (!base) { console.log('DEV_NOT_STARTED'); restore(); process.exit(1) }
  await sleep(3000) // 让 vite 完成首次编译

  const browser = await chromium.launch({ headless: true })
  const results = []
  try { for (const k of Object.keys(STATES)) results.push(await runState(k, browser, base)) }
  finally { await browser.close() }

  const lines = [`MOBILE-32 · H5 三态运行态取证 v2（${new Date().toISOString()}）`, `dev base = ${base}`, '']
  let fail = 0

  // 前置①：目标页必须真的渲染出写按钮
  const granted = results.find((r) => r.state === 'ready-granted')
  const nBtn = granted ? granted.probe.btns.length : 0
  lines.push(`[前置①] 有权限态渲染按钮数 = ${nBtn}（hash=${granted ? granted.probe.hash : ''}, bodyLen=${granted ? granted.probe.bodyLen : 0}）`)
  if (nBtn === 0) {
    fail++
    lines.push('✗ 页面未渲染任何按钮 ⇒ 本装置的"写请求=0"没有意义（v1 假绿根因）')
    if (granted && granted.errs.length) lines.push('  pageerror: ' + granted.errs.join(' ‖ '))
    if (granted && granted.cons.length) lines.push('  console: ' + granted.cons.join(' ‖ '))
  } else lines.push('✓ 目标页已渲染按钮')
  lines.push('')

  for (const r of results) {
    const dis = r.probe.btns.filter((b) => b.disabled).length
    lines.push(`=== ${r.state} · ${r.label} ===`)
    lines.push(`写请求数 = ${r.writes.length}${r.writes.length ? ' [' + r.writes.join(', ') + ']' : ''}`)
    lines.push(`按钮总数 = ${r.probe.btns.length}；disabled = ${dis}`)
    lines.push(`按钮明细(前6) = ${r.probe.btns.slice(0, 6).map((b) => `「${b.text || b.cls || '?'}」${b.disabled ? 'DISABLED' : 'enabled'}${b.opacity ? ' op=' + b.opacity : ''}`).join(' | ') || '(无)'}`)
    lines.push(`gate-hint = ${r.probe.hint || '(无)'}`)
    if (r.errs.length) lines.push(`pageerror = ${r.errs.join(' ‖ ')}`)
    lines.push('')

    if (r.state === 'ready-denied' || r.state === 'unavailable') {
      if (r.writes.length !== 0) { fail++; lines.push(`✗ 期望写请求 0，实际 ${r.writes.length}`) }
      else lines.push('✓ 写请求 0')
      if (nBtn > 0 && dis === 0) { fail++; lines.push('✗ 期望至少 1 个 disabled 写按钮（无权限/权限失败时不得放开）') }
      else if (nBtn > 0) lines.push(`✓ 有 ${dis} 个 disabled 写按钮`)
    } else {
      lines.push(`（对照态：disabled=${dis} / 写请求=${r.writes.length}）`)
    }
  }

  // 前置②：三态之间按钮 disabled 必须有差异（否则说明权限没接进页面）
  const denied = results.find((r) => r.state === 'ready-denied')
  const grantedDis = granted ? granted.probe.btns.filter((b) => b.disabled).length : -1
  const deniedDis = denied ? denied.probe.btns.filter((b) => b.disabled).length : -1
  lines.push('')
  lines.push(`[前置②] 有权限态 disabled=${grantedDis} / 无权限态 disabled=${deniedDis} ⇒ 差异=${grantedDis !== deniedDis}`)
  if (nBtn > 0 && grantedDis === deniedDis) {
    fail++
    lines.push('✗ 三态按钮状态无差异 ⇒ 权限判定未真正影响按钮（判据无效）')
  } else if (nBtn > 0) lines.push('✓ 三态按钮状态有差异（权限接线生效）')

  lines.push('')
  lines.push(fail === 0 ? 'H5_THREE_STATES_PASS（含前置①②）' : `H5_THREE_STATES_FAIL（${fail} 项）`)
  writeFileSync(join(OUT, '44-h5-three-states.txt'), lines.join('\n'), 'utf8')
  console.log(lines.join('\n'))
  restore()
  process.exit(fail === 0 ? 0 : 1)
}

main()
