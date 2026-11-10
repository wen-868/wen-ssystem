#!/usr/bin/env node
/**
 * TOTAL-SAAS-UI-TOKENS-01 · computed 值 + 截图证据采集
 * 复用 e2e/a11y.saas-admin.spec.ts 的绕过登录墙方案：
 *   · saas-admin dev(5174) + mock 后端(8080, USE_MOCK_DB)
 *   · 路由守卫只查 localStorage.platform_token 非空 → 注入测试密钥签发的 platform_admin JWT
 * 用法：node saas-admin/tests/tools/capture-evidence.cjs <label> [baseURL]
 * 输出：$CENTRAL/projects/ms/evidence/TOTAL-SAAS-UI-TOKENS-01/<label>/
 *   ├── computed.json     （每页 × 每视口的令牌 computed 值）
 *   ├── 1440x1000/*.png
 *   └── 1024x768/*.png
 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { chromium } = require('@playwright/test')

const LABEL = process.argv[2] || 'before'
const BASE = process.argv[3] || 'http://127.0.0.1:5174'
const JWT_SECRET = process.env.E2E_JWT_SECRET || 'e2e-secret'
const CENTRAL = process.env.CENTRAL_ROOT || 'D:/Users/ZXQL/ZXQL-WORK'
const OUT = path.join(CENTRAL, 'projects', 'ms', 'evidence', 'TOTAL-SAAS-UI-TOKENS-01', LABEL)

/** 与 e2e/a11y.saas-admin.spec.ts 完全同源的 HS256 签名 */
function signPlatformAdminJwt() {
  const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    id: 1,
    type: 'platform_admin',
    username: 'ci-a11y-probe',
    iss: 'zhixiang-platform',
    aud: 'zhixiang-platform-client',
    iat: now,
    exp: now + 3600,
  }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest()
  return `${h}.${p}.${b64url(sig)}`
}

const PAGES = [
  { route: '/login', auth: false, name: 'login' },
  { route: '/dashboard', auth: true, name: 'dashboard' },
  { route: '/tenants', auth: true, name: 'tenants' },
  { route: '/subscriptions', auth: true, name: 'subscriptions' },
  { route: '/tenant-usage', auth: true, name: 'tenant-usage' },
  { route: '/reviews', auth: true, name: 'reviews' },
]
const VIEWPORTS = [
  { w: 1440, h: 1000, dir: '1440x1000' },
  { w: 1024, h: 768, dir: '1024x768' },
]
const TOKENS = [
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--bg-page',
  '--color-primary',
  '--el-color-primary',
  '--el-text-color-secondary',
]

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page
    .waitForFunction(() => {
      const d = document
      if (typeof d.getAnimations !== 'function') return true
      return d.getAnimations().filter((a) => a.playState === 'running').length === 0
    }, { timeout: 5000 })
    .catch(() => {})
  await page.waitForTimeout(500)
}

;(async () => {
  for (const d of ['1440x1000', '1024x768']) fs.mkdirSync(path.join(OUT, d), { recursive: true })
  const jwt = signPlatformAdminJwt()
  const browser = await chromium.launch()
  const results = []

  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
      if (p.auth) {
        await ctx.addInitScript((t) => {
          try { localStorage.setItem('platform_token', t) } catch (e) { /* ignore */ }
        }, jwt)
      }
      const page = await ctx.newPage()
      const url = BASE + p.route
      let ok = true
      let err = null
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 })
        await settle(page)
        const computed = await page.evaluate((names) => {
          const cs = getComputedStyle(document.documentElement)
          const b = getComputedStyle(document.body)
          const out = { root: {}, body: { color: b.color, backgroundColor: b.backgroundColor } }
          for (const n of names) out.root[n] = cs.getPropertyValue(n).trim()
          return out
        }, TOKENS)
        const shot = path.join(OUT, vp.dir, `${p.name}.png`)
        await page.screenshot({ path: shot, fullPage: false })
        results.push({ viewport: vp.dir, route: p.route, computed, screenshot: shot.replace(/\\/g, '/') })
        console.log(`  ✔ ${vp.dir} ${p.route}`)
      } catch (e) {
        ok = false
        err = String(e).slice(0, 200)
        results.push({ viewport: vp.dir, route: p.route, ok, error: err })
        console.log(`  ✘ ${vp.dir} ${p.route} → ${err}`)
      }
      await ctx.close()
    }
  }
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'computed.json'), JSON.stringify(results, null, 2), 'utf8')
  const fails = results.filter((r) => r.error).length
  console.log(`\n[${LABEL}] 完成：${results.length - fails}/${results.length} 页采集成功 → ${OUT}`)
  if (fails) process.exit(1)
})()
