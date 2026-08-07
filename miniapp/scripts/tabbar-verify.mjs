/**
 * tabBar 视觉验证脚本（R96-01）
 * 定位页面 tabBar 元素，截取其区域并输出元素框与 DOM 中图标的颜色信息。
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(
  pathToFileURL('D:/Users/ZXQL/ZXQL-MS/wen-ssystem/.playwright-cli/pw-run/node_modules/playwright-core/index.mjs').href
)

const DIST = resolve(process.argv[2] || 'D:/Users/ZXQL/ZXQL-MS/wen-ssystem/miniapp/dist')
const OUT = resolve(process.argv[3] || 'D:/Users/ZXQL/ZXQL-MS/wen-ssystem/docs/reports/R96-01-themes/tabbar-check.png')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' }

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const filePath = urlPath === '/' ? join(DIST, 'index.html') : join(DIST, urlPath)
    const data = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(`http://127.0.0.1:${port}/#/pages/index/index`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)

// 查找 tabBar 相关元素
const info = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('taro-tabbar, .taro-tabbar, .taro-tabbar__container, [class*=tabbar], [class*=tab-bar]'))
  const found = []
  for (const el of els.slice(0, 6)) {
    const r = el.getBoundingClientRect()
    const imgs = Array.from(el.querySelectorAll('img, image')).map((img) => {
      const ir = img.getBoundingClientRect()
      const src = img.getAttribute('src') || ''
      return { x: Math.round(ir.x), y: Math.round(ir.y), w: Math.round(ir.width), h: Math.round(ir.height), src: src.slice(0, 80) }
    })
    found.push({ tag: el.tagName, cls: el.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), imgs: imgs.slice(0, 5) })
  }
  return found
})
console.log('tabBar 元素:', JSON.stringify(info, null, 2))

// 截取第一个 tabbar 元素区域
if (info.length > 0) {
  const el = page.locator('taro-tabbar, .taro-tabbar, .taro-tabbar__container, [class*=tabbar], [class*=tab-bar]').first()
  await el.screenshot({ path: OUT })
  console.log('tabBar 截图:', OUT)
}

await browser.close()
server.close()
