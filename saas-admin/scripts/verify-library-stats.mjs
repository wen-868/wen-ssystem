#!/usr/bin/env node
/**
 * R101-C6-5 运行期装置：商品库「调取统计」三块 + 审核流水（页面级）
 *
 * 目的（对应派单卡 C6-5 交付物 ③④）：
 *   ③ 三个统计块确实接了 stats / stats/rank / stats/trend，且至少一段可见数据或诚实空态；
 *   ④ 「把已接线端点路径故意改错 ⇒ 页面必须显示错误态（而不是静默显示 0 / 空态）」——
 *      装置用 `--data` / `--empty` / `--error` 三态做判别：错误态与空态必须是两种可区分的呈现。
 *
 * 用法（先 `npm --workspace saas-admin run build`，装置读 saas-admin/dist）：
 *   node saas-admin/scripts/verify-library-stats.mjs --logic-only   # 只跑 A 段纯逻辑（无需构建/浏览器）
 *   node saas-admin/scripts/verify-library-stats.mjs --data         # 页面：三块有数据 + 审核流水有记录
 *   node saas-admin/scripts/verify-library-stats.mjs --empty        # 页面：诚实空态（无数据不补 0）
 *   node saas-admin/scripts/verify-library-stats.mjs --error        # 页面：错误态（反测用）
 *   node saas-admin/scripts/verify-library-stats.mjs --all          # data + empty + error 全跑
 * 可选：--out <目录>（截图输出，默认 saas-admin/scripts/evidence-c6-5）、--port <端口>（默认 5199）
 *
 * 🔴 反测步骤（改坏路径 ⇒ 红 / 复原 ⇒ 绿，卡面 ④）：
 *   1) 绿：`npm --workspace saas-admin run build && node saas-admin/scripts/verify-library-stats.mjs --data` ⇒ 全 PASS
 *   2) 改坏：把 src/api/library.ts 的 `/platform/library/stats` 改成 `/platform/library/statss`，重新 build
 *   3) 红：再跑 `--data` ⇒ 装置 FAIL（该端点 404 未登记 ⇒ 页面显示"加载失败"，取不到 `42 次`）
 *   4) 复原：改回原路径、重新 build，`--data` 恢复全 PASS
 *
 * 说明：`--logic-only` 依赖 Node 原生 TS 类型擦除（Node ≥ 22.18 / 23.6 默认开启），
 *   它只校验纯逻辑；`--data/--empty/--error` 需要 dist + Playwright chromium。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SAAS_DIR = path.resolve(HERE, '..')
const DIST_DIR = path.join(SAAS_DIR, 'dist')

const args = process.argv.slice(2)
const hasFlag = (flag) => args.includes(flag)
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const OUT_DIR = path.resolve(argValue('--out', path.join(HERE, 'evidence-c6-5')))
const PORT = Number(argValue('--port', '5199'))
const BASE = `http://127.0.0.1:${PORT}`

let failed = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ← ${detail}` : ''}`)
  if (!ok) failed += 1
}
function section(title) {
  console.log(`\n── ${title} ──`)
}

/* ════════════ 1. 纯逻辑模式（无需构建，本沙箱可跑） ════════════ */

async function runLogicOnly() {
  section('A 段纯逻辑（node 原生 TS 类型擦除）')
  let mod
  try {
    mod = await import(pathToFileURL(path.join(SAAS_DIR, 'src/views/library/library-stats.ts')).href)
  } catch (e) {
    console.log(`无法加载纯逻辑模块（需 Node ≥ 22.18 的类型擦除）：${e.message}`)
    failed += 1
    return
  }

  check('unwrapApiData 解包 { code, msg, data }', mod.unwrapApiData({ code: '0', data: { a: 1 } }).a === 1)
  check('unwrapApiData 裸数据原样返回', Array.isArray(mod.unwrapApiData([1, 2])))
  check('toNumberOrNull 区分 0 与取不到', mod.toNumberOrNull(0) === 0 && mod.toNumberOrNull(undefined) === null)

  const statsView = mod.normalizeCallStats({
    monthCallCount: 42,
    tenantRank: [{ tenantId: 't1', tenantDisplayName: '甲租户', callCount: 40 }],
    unavailable: [{ key: 'categoryDist', reason: '公共类目树不存在' }],
  })
  check('normalizeCallStats 取出当月次数', statsView.monthCallCount === 42)
  check('normalizeCallStats 排行按 1 起编号', statsView.tenantRank[0].rank === 1 && statsView.tenantRank[0].callCount === 40)
  check('normalizeCallStats 缺字段回落 null（不是 0）', mod.normalizeCallStats({}).monthCallCount === null)

  const rankRows = mod.normalizeTenantRank({
    items: [
      { tenantId: 't1', tenantDisplayName: '甲', callCount: 9 },
      { tenantId: 't2', tenantDisplayName: '乙', callCount: 'N/A' },
    ],
  })
  check('normalizeTenantRank 丢弃计数不可解析的行', rankRows.length === 1 && rankRows[0].callCount === 9)

  const trend = mod.normalizeCallTrend({
    days: 30,
    items: [
      { date: '2026-10-02', count: 4 },
      { date: 'bad', count: 1 },
      { date: '2026-10-01', count: 2 },
    ],
  })
  check('normalizeCallTrend 过滤非法点并按日期升序', trend.length === 2 && trend[0].date === '2026-10-01')

  check('formatMonthCallText：null/0 ⇒ 暂无数据', mod.formatMonthCallText(null) === '暂无数据' && mod.formatMonthCallText(0) === '暂无数据')
  check('formatMonthCallText：正数 ⇒ N 次', mod.formatMonthCallText(42) === '42 次')
  check('formatRankSummary 无分母不给占比', mod.formatRankSummary([{ rank: 1, tenantId: 't', tenantName: '甲', callCount: 3 }], null) === 'Top1 合计 3 次')
  check(
    'toTrendPolyline 两点落在 40/620 边界',
    mod.toTrendPolyline([
      { date: '2026-10-01', count: 0 },
      { date: '2026-10-02', count: 10 },
    ]) === '40,129 620,18'
  )
  check('resolveBlockState 错误态优先于空态', mod.resolveBlockState({ loading: false, error: 'x', hasData: false }) === 'error')
  check('resolveBlockState 无错误无数据 ⇒ 空态', mod.resolveBlockState({ loading: false, error: null, hasData: false }) === 'empty')

  const logs = mod.normalizeReviewLogs({
    logs: [{ id: 2, action: 'APPROVE', fromStatus: 'PENDING', toStatus: 'APPROVED', operatorName: '陈默', createdAt: '2026-10-03T09:30:00.000Z' }],
  })
  check('normalizeReviewLogs 动作中文 + 状态流转', logs[0].actionLabel === '审核通过' && logs[0].statusText === 'PENDING → APPROVED')
  check('normalizeReviewLogs 空集 ⇒ []', mod.normalizeReviewLogs({ logs: [] }).length === 0)
}

/* ════════════ 2. 页面模式（dist + Playwright） ════════════ */

const SPU_ROW = {
  id: 1,
  spuCode: '6900000000001',
  name: '装置测试商品',
  brandId: 7,
  brandName: '装置测试品牌',
  specs: '550ml×24',
  unit: '箱',
  mainImage: '',
  status: 'APPROVED',
  source: 'MANUAL',
  hitCount: 0,
  skuCount: 1,
  createdAt: '2026-10-03T09:00:00.000Z',
  updatedAt: '2026-10-03T09:00:00.000Z',
}

const RANK_DATA = [
  { tenantId: 't1', tenantDisplayName: '甲租户', callCount: 40 },
  { tenantId: 't2', tenantDisplayName: '乙租户', callCount: 2 },
]

const MODES = {
  data: {
    stats: {
      monthCallCount: 42,
      tenantRank: RANK_DATA,
      unavailable: [{ key: 'categoryDist', reason: '公共类目树不存在（118 迁移不建表）' }],
    },
    rank: { items: RANK_DATA },
    trend: {
      days: 30,
      items: [
        { date: '2026-10-01', count: 3 },
        { date: '2026-10-02', count: 11 },
        { date: '2026-10-03', count: 7 },
      ],
    },
    reviewLogs: {
      logs: [
        {
          id: 2,
          action: 'APPROVE',
          fromStatus: 'PENDING',
          toStatus: 'APPROVED',
          operatorId: 1,
          operatorName: '陈默',
          reason: null,
          createdAt: '2026-10-03T09:30:00.000Z',
        },
      ],
    },
  },
  empty: {
    stats: {
      monthCallCount: 0,
      tenantRank: [],
      unavailable: [{ key: 'categoryDist', reason: '公共类目树不存在（118 迁移不建表）' }],
    },
    rank: { items: [] },
    trend: { days: 30, items: [] },
    reviewLogs: { logs: [] },
  },
  // error 模式：只把三个统计端点注入 500（其余端点沿用 data 载荷，页面骨架仍可见）
}

const STATS_PATHS = new Set([
  '/api/platform/library/stats',
  '/api/platform/library/stats/rank',
  '/api/platform/library/stats/trend',
])

function envelope(data) {
  return JSON.stringify({ code: '0', msg: '成功', data })
}

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? '/index.html' : pathname
  const file = path.join(DIST_DIR, decodeURIComponent(rel))
  if (file.startsWith(DIST_DIR) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file)
    const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream'
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8` })
    fs.createReadStream(file).pipe(res)
    return
  }
  // SPA 兜底：非 /api 的未知路径回 index.html
  const index = path.join(DIST_DIR, 'index.html')
  if (fs.existsSync(index)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    fs.createReadStream(index).pipe(res)
    return
  }
  res.writeHead(404).end('not found')
}

export function createMockServer(mode) {
  const payload = MODES[mode] ?? MODES.data
  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url, BASE)
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
      res.end(body)
    }
    if (!pathname.startsWith('/api/')) return serveStatic(pathname, res)
    if (mode === 'error' && STATS_PATHS.has(pathname)) {
      return json(500, JSON.stringify({ code: '500', msg: '统计数据加载失败（装置注入的 500）' }))
    }
    if (pathname === '/api/platform/auth/me') return json(200, envelope({ id: 1, username: 'c65', realName: 'C65 装置' }))
    if (pathname === '/api/platform/library/stats') return json(200, envelope(payload.stats))
    if (pathname === '/api/platform/library/stats/rank') return json(200, envelope(payload.rank))
    if (pathname === '/api/platform/library/stats/trend') return json(200, envelope(payload.trend))
    if (pathname === '/api/platform/library/spus') {
      return json(200, envelope({ total: 1, page: 1, pageSize: 20, records: [SPU_ROW] }))
    }
    if (pathname === '/api/platform/library/spus/1') return json(200, envelope({ ...SPU_ROW, skus: [] }))
    if (pathname === '/api/platform/library/spus/1/review-logs') return json(200, envelope(payload.reviewLogs))
    if (pathname === '/api/platform/library/brands') return json(200, envelope({ total: 0, page: 1, pageSize: 20, records: [] }))
    if (pathname === '/api/platform/library/categories') return json(200, envelope([]))
    // 未登记路径 ⇒ 404：**反测（改坏路径）就落在这里**，页面必须显示错误态而不是空态
    return json(404, JSON.stringify({ code: '404', msg: '接口不存在（装置未登记该路径）' }))
  })
}

async function withPage(mode, fn) {
  const { chromium } = await import('playwright')
  const server = createMockServer(mode)
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve))
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
    // 注入令牌：router 守卫只判 localStorage.platform_token 存在与否（非 JWT 也放行）
    await context.addInitScript(() => window.localStorage.setItem('platform_token', 'c65-device-token'))
    const page = await context.newPage()
    await page.goto(`${BASE}/#/library/spus`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=商品库', { timeout: 20000 })
    await page.getByText('④ 调取统计').first().click()
    await page.waitForTimeout(1200)
    await fn(page)
    fs.mkdirSync(OUT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(OUT_DIR, `c6-5-stats-${mode}.png`), fullPage: true })
    console.log(`截图：${path.join(OUT_DIR, `c6-5-stats-${mode}.png`)}`)
  } finally {
    await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }
}

async function kpiText(page) {
  return (await page.locator('.kpi', { hasText: '本月租户调取' }).locator('.kv').innerText()).trim()
}

async function runBrowser(mode) {
  section(`页面模式：${mode}`)
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.log('缺少 saas-admin/dist —— 请先 `npm --workspace saas-admin run build`')
    failed += 1
    return
  }
  await withPage(mode, async (page) => {
    const kpi = await kpiText(page)
    const body = await page.locator('body').innerText()
    const polyline = await page.locator('.chart-box svg polyline').count()
      ? await page.locator('.chart-box svg polyline').first().getAttribute('points')
      : null

    if (mode === 'data') {
      check('数据态：KPI 显示 42 次', kpi === '42 次', kpi)
      check('数据态：排行出现甲租户 / 40', body.includes('甲租户') && body.includes('40'))
      check('数据态：趋势折线有点', Boolean(polyline && polyline.trim().length > 0), String(polyline))
      check('数据态：未误报空态', !body.includes('暂无调取排行数据') && !body.includes('暂无调取趋势数据'))
      check('数据态：类目分布为「本期不提供」', body.includes('本期不提供'))
    }
    if (mode === 'empty') {
      check('空态：KPI 显示暂无数据（不是 0 次）', kpi === '暂无数据', kpi)
      check('空态：排行 / 趋势 / 审核流水均诚实空态', body.includes('暂无调取排行数据') && body.includes('暂无调取趋势数据'))
      check('空态：未误报错误态', !body.includes('数据加载失败'))
    }
    if (mode === 'error') {
      check('错误态：KPI 显示加载失败', kpi === '加载失败', kpi)
      check('错误态：排行 / 趋势块显示「数据加载失败」', body.includes('数据加载失败'))
      check('错误态 ≠ 空态：不出现「暂无调取排行数据」', !body.includes('暂无调取排行数据'))
    }

    // 审核流水（详情弹窗）
    await page.getByText('查看').first().click()
    await page.waitForTimeout(800)
    const modal = await page.locator('.modal').first().innerText()
    if (mode === 'data') check('审核流水：出现「审核通过」', modal.includes('审核通过'))
    if (mode === 'empty') check('审核流水：诚实空态「暂无审核记录」', modal.includes('暂无审核记录'))
    if (mode === 'error') check('审核流水：错误态「数据加载失败」', modal.includes('数据加载失败'))
  })
}

/* ════════════ 入口（被 import 时不自动执行，便于单测 mock server） ════════════ */

export const MODE_PAYLOADS = MODES
export const STATS_ENDPOINTS = STATS_PATHS

async function main() {
  const modes = []
  if (hasFlag('--all')) modes.push('data', 'empty', 'error')
  if (hasFlag('--data')) modes.push('data')
  if (hasFlag('--empty')) modes.push('empty')
  if (hasFlag('--error')) modes.push('error')

  if (hasFlag('--logic-only') || modes.length === 0) {
    await runLogicOnly()
  }
  for (const mode of modes) {
    await runBrowser(mode)
  }

  console.log(`\n${failed === 0 ? '全部通过' : `失败 ${failed} 项`}`)
  process.exit(failed === 0 ? 0 : 1)
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (invokedDirectly) {
  await main()
}
