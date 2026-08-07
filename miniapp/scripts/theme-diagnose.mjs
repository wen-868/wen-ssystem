/**
 * H5 预览诊断脚本（R96-01）
 * 加载首页并输出：控制台全部消息、DOM 内容、window 关键变量、网络失败请求。
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(
  pathToFileURL('D:/Users/ZXQL/ZXQL-MS/wen-ssystem/.playwright-cli/pw-run/node_modules/playwright-core/index.mjs').href
)

const DIST = resolve(process.argv[2] || 'D:/Users/ZXQL/ZXQL-MS/wen-ssystem/miniapp/dist')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const filePath = urlPath === '/' ? join(DIST, 'index.html') : join(DIST, urlPath)
    console.log('[请求]', req.url, '→', filePath)
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text()))
page.on('pageerror', (e) => console.log('[pageerror]', e.message, '\n', (e.stack || '').split('\n').slice(0, 5).join('\n')))
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText))
page.on('response', (r) => {
  if (r.status() >= 400) console.log('[http' + r.status() + ']', r.url())
})

await page.goto(`http://127.0.0.1:${port}/#/pages/index/index`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(5000)

const state = await page.evaluate(() => {
  const el = document.getElementById('app')
  const tabbarEls = Array.from(document.querySelectorAll('.weui-tabbar, .weui-tabbar__item'))
  const textEls = Array.from(document.querySelectorAll('*')).filter((e) => {
    const t = (e.textContent || '').trim()
    return t === '首页' || t === '分类' || t === '购物车' || t === '我的'
  })
  return {
    htmlLen: document.documentElement.outerHTML.length,
    appChildren: el ? el.children.length : -1,
    appText: el ? el.textContent.slice(0, 300) : null,
    bodyHtml: document.body.innerHTML.slice(0, 500),
    hasTaro: typeof window !== 'undefined' && !!document.querySelector('taro-view-root, .taro_router, #app *'),
    tabbarEls: tabbarEls.map((e) => ({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 60), rect: (() => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })() })),
    tabbarImgs: Array.from(document.querySelectorAll('.weui-tabbar__item img, .weui-tabbar__item image')).map((img) => {
      const r = img.getBoundingClientRect()
      const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), src: src.slice(0, 90) }
    }),
    tabTextEls: textEls.slice(0, 8).map((e) => ({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 60), text: e.textContent.trim() }))
  }
})
console.log('DOM 状态:', JSON.stringify(state, null, 2))

await browser.close()
server.close()
