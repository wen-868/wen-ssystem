/**
 * 三主题 H5 视觉走查脚本（R96-01）
 *
 * 用法：node scripts/theme-walkthrough.mjs <dist目录> <输出目录>
 * 依赖：pw-run 目录下的 playwright-core（channel: msedge）
 *
 * 对 4 个关键页（首页/分类/购物车/我的）截图并记录控制台错误。
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(
  pathToFileURL('D:/Users/ZXQL/ZXQL-MS/wen-ssystem/.playwright-cli/pw-run/node_modules/playwright-core/index.mjs').href
)

const DIST = resolve(process.argv[2] || 'D:/Users/ZXQL/ZXQL-MS/wen-ssystem/miniapp/dist')
const OUT = resolve(process.argv[3] || 'D:/Users/ZXQL/ZXQL-MS/wen-ssystem/docs/reports/R96-01-themes')
mkdirSync(OUT, { recursive: true })

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const filePath = urlPath === '/' ? join(DIST, 'index.html') : join(DIST, urlPath)
    const data = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    // SPA 兜底：返回空 HTML，交由前端路由
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>智享商城</title></head><body></body></html>')
  }
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
console.log('静态服务器已启动:', `http://127.0.0.1:${port}`)

const PAGES = [
  ['01-home', 'pages/index/index'],
  ['02-category', 'pages/category/index'],
  ['03-cart', 'pages/cart/index'],
  ['04-profile', 'pages/profile/index']
]

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.setDefaultTimeout(20000)

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('[console.error] ' + m.text())
})
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')))
page.on('requestfailed', (r) => {
  if (!r.url().includes('placeholder.com')) errors.push('[requestfailed] ' + r.url() + ' ' + (r.failure()?.errorText || ''))
})

for (const [name, route] of PAGES) {
  await page.goto(`http://127.0.0.1:${port}/#/${route}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1800)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  console.log(`已截图: ${name} → ${join(OUT, `${name}.png`)}`)
}

console.log('控制台错误数:', errors.length)
errors.slice(0, 10).forEach((e) => console.log('  ', e))

await browser.close()
server.close()
