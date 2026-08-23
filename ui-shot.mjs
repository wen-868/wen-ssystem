import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'https://m.onepan.cn'
const OUT = process.env.SHOT_OUT || path.resolve('./shots')
const TOKEN = process.env.MERCHANT_TOKEN || ''
const TENANT = process.env.MERCHANT_TENANT || 'default'
const LOGIN_USERNAME = process.env.LOGIN_USERNAME || ''
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || ''
const ONLY = (process.env.SHOT_ONLY || '').split(',').filter(Boolean)

fs.mkdirSync(OUT, { recursive: true })

// 从 pages.json 自动枚举所有二级/三级子页（作为走查清单）
function enumerateRoutes() {
  const p = JSON.parse(fs.readFileSync(path.resolve('app-mobile/src/pages.json'), 'utf8'))
  const out = []
  for (const sp of p.subPackages || []) {
    for (const pg of sp.pages || []) {
      out.push(sp.root + '/' + pg.path)
    }
  }
  return out
}

let routes = ONLY.length ? ONLY : enumerateRoutes()
routes = routes.map((r) => r.replace(/^\//, ''))

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
})
const page = await ctx.newPage()

// 先打开首页，注入登录态（明文 → 启动迁移自动转加密）
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(
  ({ token, tenant, username, pwd }) => {
    let t = token
    let tn = tenant
    // 支持用账号登录拿 token
    async function login() {
      const res = await fetch('/api/store/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pwd })
      })
      const body = await res.json()
      const data = body?.data || body
      if (data?.token) {
        t = data.token
        tn = data.user?.tenantId || data.tenantId || 'default'
        localStorage.setItem('merchant_user', JSON.stringify(data.user || {}))
        localStorage.setItem('merchant_csrf_token', data.csrfToken || '')
        return true
      }
      return false
    }

    async function apply() {
      if (!t && username && pwd) {
        const ok = await login()
        if (!ok) return false
      }
      localStorage.setItem('merchant_token', t)
      localStorage.setItem('merchant_tenant_id', tn)
      return true
    }
    return apply().then((ok) => ({ ok }))
  },
  { token: TOKEN, tenant: TENANT, username: LOGIN_USERNAME, pwd: LOGIN_PASSWORD }
).then((r) => {
  if (!r.ok) throw new Error('注入登录态失败：请提供 MERCHANT_TOKEN 或 LOGIN_USERNAME/LOGIN_PASSWORD')
})

// 重新加载，让存储迁移拦截器读到登录态
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

let okCount = 0
for (const route of routes) {
  const url = BASE + '/#/' + route
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  } catch {
    /* 网络空闲等待超时也截图 */
  }
  await page.waitForTimeout(1200)
  const name = route.replace(/[^\w-]+/g, '_')
  await page.screenshot({ path: path.join(OUT, name + '.png') })
  okCount++
  console.log('saved', route, '->', name + '.png')
}

console.log(`完成：${okCount}/${routes.length} 页截图 -> ${OUT}`)
await browser.close()
