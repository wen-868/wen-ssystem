// ============================================================================
// QODER-26 · H5 运行态取证 mock 后端（网络手术装置，非产品代码，不入库 src）
//
// 基座：docs/evidence/qoder-11r/mock-backend.mjs（登录/me/menus 三端点与 /__mock 控制台
// 逐字沿用），本文件只**追加**商品域三条维度的确定性夹具：
//   GET /api/admin/products            → 同一 SPU(7) 两个 SKU(41/42) 的 SKU 粒度记录
//   GET /api/admin/products/:spuId     → SPU 详情（skus[] 两条）
//   PUT /api/admin/products/:skuId/price → 逐条落日志（路径段即真实 skuId 的读数源）
//
// 用法（工作树根）：
//   MOCK_PORT=8461 node docs/evidence/qoder-26/h5/mock-backend-qoder26.mjs
//   H5 dev 侧：VITE_PROXY_TARGET=http://localhost:8461 npm --workspace app-mobile run dev:h5
// 读数：docs/evidence/qoder-26/h5/mock-backend-qoder26.log（每条请求一行）
// ============================================================================
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const LOG = path.join(DIR, 'mock-backend-qoder26.log')
const PORT = Number(process.env.MOCK_PORT || 8461)

const ALL_MENU_CODES = ['goods:price', 'goods:category', 'sale:bill', 'sale:record', 'goods:batch']
const ALL_PERM_CODES = [
  'sale:create', 'sale:void', 'sale:return', 'goods:create', 'goods:edit', 'goods:price', 'goods:delete',
]

const state = {
  login: { mode: 'ok', delayMs: 0, perms: 'full' },
  me: { mode: 'ok', delayMs: 0, perms: 'full' },
  menus: { mode: 'ok', delayMs: 0 },
  fallback: { mode: '200empty' },
}

/* ── 确定性夹具：一个 SPU(id=7) 两个 SKU(id=41/42)，字段名逐一对齐
      backend/src/services/admin/product.service.ts:258-301 的 SELECT 别名 ── */
function skuRecord(over) {
  return {
    spuId: 7,
    spuCode: 'SPU007',
    name: '取证可乐',
    categoryId: 3,
    categoryName: '饮料',
    brandName: '取证牌',
    status: 'ON_SALE',
    allowOnlineSale: 1,
    retailPrice: 100,
    wholesalePrice: 90,
    memberPrice: 95,
    storePrice: 92,
    miniappPrice: 98,
    costPrice: 60,
    unit: '瓶',
    specs: '500ml 瓶装',
    origin: '本地',
    warningThreshold: 5,
    availableQty: 10,
    skuCode: 'SPU007-500ML',
    skuName: '取证可乐 500ml 单瓶',
    barcode: '6901000000041',
    skuId: 41,
    ...over,
  }
}
const RECORDS = [
  skuRecord({}),
  skuRecord({
    skuId: 42,
    skuCode: 'SPU007-CASE6',
    skuName: '取证可乐 500ml*6 整箱',
    barcode: '6901000000042',
    unit: '箱',
    specs: '500ml*6 整箱',
    retailPrice: 560,
    wholesalePrice: 520,
    memberPrice: 545,
    storePrice: 535,
    miniappPrice: 550,
    costPrice: 350,
    warningThreshold: 2,
    availableQty: 8,
  }),
  // 第三条：后端 JOIN 放大/脏数据形态——有 skuCode 无正整数 skuId，映射层必须跳过它
  skuRecord({ skuId: null, skuCode: 'SPU007-BADROW', barcode: '6901000000043', skuName: '取证可乐 缺主键行' }),
]

const DETAIL = {
  id: 7,
  spuId: 7,
  skuId: 41,
  spuCode: 'SPU007',
  name: '取证可乐',
  categoryId: 3,
  categoryName: '饮料',
  brandName: '取证牌',
  status: 'ON_SALE',
  marketingTags: [],
  skus: RECORDS.slice(0, 2).map((r) => ({
    id: r.skuId,
    skuId: r.skuId,
    spuId: 7,
    skuCode: r.skuCode,
    skuName: r.skuName,
    barcode: r.barcode,
    retailPrice: r.retailPrice,
    wholesalePrice: r.wholesalePrice,
    costPrice: r.costPrice,
    availableQty: r.availableQty,
    warningThreshold: r.warningThreshold,
    baseUnit: r.unit,
  })),
}

/** 本次会话内收到的改价请求（浏览器侧读数的服务端对照，逐条含真实路径段） */
const priceHits = []

function log(line) {
  fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`)
}
function permsOf(spec) {
  if (spec.perms === 'missing') return undefined
  if (spec.perms === 'empty') return []
  return ALL_PERM_CODES
}
function userPayload(spec) {
  const u = { id: 1001, username: 'qoder26', realName: '取证门店', roles: ['STORE_ADMIN'], storeId: 1, tenantId: 'tenant-qoder26-mock' }
  const p = permsOf(spec)
  if (p !== undefined) u.permissions = p
  return u
}
function menuTree(codes) {
  return codes.map((c, i) => ({ id: i + 1, parentId: null, menuName: c, menuCode: c, menuType: 'menu', path: '', icon: '', sortNo: i + 1, status: 'ENABLED', children: [] }))
}

const server = http.createServer((req, res) => {
  const url = req.url || ''
  const u = new URL(url, 'http://mock.local')
  const send = (status, obj) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(obj))
  }
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (url.startsWith('/__mock')) {
      if (req.method === 'GET') return send(200, state)
      try {
        const patch = JSON.parse(body || '{}')
        for (const k of Object.keys(patch)) state[k] = { ...(state[k] || {}), ...(patch[k] || {}) }
        log(`CONTROL patch=${body}`)
        return send(200, state)
      } catch (e) {
        return send(400, { code: 400, msg: 'bad control json: ' + e.message })
      }
    }
    if (url.startsWith('/api/store/auth/login')) {
      log(`${req.method} ${url} -> 200 login`)
      return send(200, { code: 200, msg: 'ok', data: { token: 'mock.jwt.token.qoder26', csrfToken: 'mock-csrf', user: userPayload(state.login) } })
    }
    if (url.startsWith('/api/admin/auth/me')) {
      log(`${req.method} ${url} -> 200 me`)
      return send(200, { code: 200, msg: 'ok', data: userPayload(state.me) })
    }
    if (url.startsWith('/api/admin/menus/user')) {
      log(`${req.method} ${url} -> 200 menus`)
      return send(200, { code: 200, msg: 'ok', data: menuTree(ALL_MENU_CODES) })
    }
    // ── 商品列表（SKU 粒度，keyword 后端语义 = name/sku_name/sku_code/barcode LIKE） ──
    if (/^\/api\/admin\/products(\?|$)/.test(url)) {
      const kw = (u.searchParams.get('keyword') || '').trim()
      const rows = kw
        ? RECORDS.filter((r) => [r.name, r.skuName, r.skuCode, r.barcode].some((s) => String(s || '').includes(kw)))
        : RECORDS
      log(`GET ${url} -> 200 records=${RECORDS.length} matched=${rows.length} skuIds=[${rows.map((r) => r.skuId).join(',')}]`)
      return send(200, { code: 200, msg: 'ok', data: { records: rows, total: rows.length, page: 1, pageSize: 20 }, traceId: 'mock-trace' })
    }
    // ── 改价：路径段就是本卡要实证的真实 skuId ──
    const mPrice = url.match(/^\/api\/admin\/products\/(\d+)\/price$/)
    if (mPrice) {
      const hit = { at: new Date().toISOString(), method: req.method, path: url, pathSegment: Number(mPrice[1]), body: body || '{}' }
      priceHits.push(hit)
      log(`PUT_PRICE path=${url} segment=${mPrice[1]} body=${body} total_hits=${priceHits.length}`)
      fs.writeFileSync(path.join(DIR, 'price-hits.json'), JSON.stringify(priceHits, null, 2))
      return send(200, { code: 200, msg: 'ok', data: true, traceId: 'mock-trace' })
    }
    const mSku = url.match(/^\/api\/admin\/products\/skus\/(\d+)$/)
    if (mSku) {
      log(`PUT_SKU path=${url} segment=${mSku[1]} body=${body}`)
      return send(200, { code: 200, msg: 'ok', data: true })
    }
    const mDetail = url.match(/^\/api\/admin\/products\/(\d+)$/)
    if (mDetail) {
      const id = Number(mDetail[1])
      if (id === 7) {
        log(`GET_DETAIL path=${url} spuId=${id} skus=[${DETAIL.skus.map((s) => s.id).join(',')}]`)
        return send(200, { code: 200, msg: 'ok', data: DETAIL })
      }
      log(`GET_DETAIL path=${url} spuId=${id} -> 404（非夹具 SPU）`)
      return send(404, { code: 404, msg: '商品不存在(mock)', data: null })
    }
    if (/^\/api\/admin\/products\/\d+\/price-history/.test(url)) {
      log(`GET ${url} -> 200 []`)
      return send(200, { code: 200, msg: 'ok', data: { records: [], total: 0 } })
    }
    if (/^\/api\/admin\/categories/.test(url)) {
      return send(200, { code: 200, msg: 'ok', data: [{ id: 3, name: '饮料', parentId: null }] })
    }
    if (state.fallback.mode === '200empty') {
      log(`${req.method} ${url} -> FALLBACK 200 empty body=${body}`)
      return send(200, { code: 200, msg: 'ok', data: { list: [], total: 0, records: [], rows: [] }, traceId: 'mock-trace' })
    }
    log(`${req.method} ${url} -> FALLBACK 404`)
    send(404, { code: 404, msg: '资源不存在(mock兜底)', data: null })
  })
})

fs.writeFileSync(LOG, '')
log(`MOCK26 START port=${PORT} fixtureSpu=7 fixtureSkus=41,42(+1 缺主键脏行) state=${JSON.stringify(state)}`)
server.listen(PORT, () => log(`LISTENING ${PORT}`))
