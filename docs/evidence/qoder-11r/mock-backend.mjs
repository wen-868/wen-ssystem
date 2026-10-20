// ============================================================================
// QODER-11 H5 手动验收 · 本地 mock 后端（网络手术装置，非产品代码）
//
// 背景：验收环境无 API 后端（vite dev 代理目标 http://localhost:8080 空置）。
// 清单指定的手术工具（whistle/Charles）本机不可用，故以等价装置替代：
// 在本机 8080 起一个可控 mock 服务，直接实现清单 §一.3 需拦截的 3 个请求
// （POST /store/auth/login、GET /admin/auth/me、GET /admin/menus/user），
// 支持改写响应体、状态码、abort（socket 销毁）、延迟——覆盖清单全部 mock 手段。
// 浏览器/网络路径保持真实：H5 页面 → vite /api 代理 → 本服务，与 whistle 同构。
//
// 用法：
//   node mock-backend.mjs                      # 起服（日志写 mock-backend.log）
//   curl http://localhost:8080/__mock          # 读当前场景配置
//   curl -X POST http://localhost:8080/__mock -H 'content-type: application/json' \
//        -d '{"menus":{"mode":"500"}}'         # 改场景配置（增量合并）
// 配置字段（每项 {mode, delayMs}；mode：ok|empty|500|abort|401；me/login 另有 perms：full|missing|empty）
// ============================================================================
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const LOG = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'mock-backend.log')
// QODER-11R：与并发代理错开端口，改由环境变量 MOCK_PORT 指定（默认 8288），其余装置逻辑与上一轮 mock-backend.mjs 逐字一致。
const PORT = Number(process.env.MOCK_PORT || 8288)

const ALL_MENU_CODES = [
  'sale:bill', 'sale:record',
  'goods:category', 'goods:price', 'goods:batch', 'goods:inventory', 'goods:stock-warning', 'goods:stock-check', 'goods:loss-gain', 'goods:trace',
  'purchase:order', 'purchase:inbound', 'purchase:supplier',
  'customer:list', 'customer:level', 'customer:points', 'customer:stored-card', 'customer:address',
  'marketing:coupon', 'marketing:activities', 'marketing:seckill', 'marketing:group-buy', 'marketing:bargain', 'marketing:community',
  'finance:receipt', 'finance:receivable', 'finance:reconciliation', 'finance:expenses', 'finance:statement', 'finance:transfer',
  'report:dashboard', 'report:sales', 'report:inventory', 'report:purchase', 'report:customer', 'report:finance-report',
  'store:list', 'store:employees', 'store:roles',
  'system:print', 'system:config', 'system:operation-log', 'system:permission', 'system:more',
]
const ALL_PERM_CODES = [
  'sale:create', 'sale:void', 'sale:return', 'purchase:create', 'inventory:inbound', 'inventory:create',
  'inventory:adjust', 'store:transfer', 'goods:create', 'goods:edit', 'goods:price', 'goods:delete',
  'system:user:create', 'system:user:edit', 'system:role:create', 'system:role:edit',
  'marketing:create', 'finance:create', 'finance:payment', 'report:finance',
]

const state = {
  login: { mode: 'ok', delayMs: 0, perms: 'full' },
  me: { mode: 'ok', delayMs: 0, perms: 'full' },
  menus: { mode: 'ok', delayMs: 0 },
  fallback: { mode: '404' },
}

function log(line) {
  const ts = new Date().toISOString()
  fs.appendFileSync(LOG, `[${ts}] ${line}\n`)
}

function permsOf(spec) {
  if (spec.perms === 'missing') return undefined
  if (spec.perms === 'empty') return []
  return ALL_PERM_CODES
}

function userPayload(spec) {
  const u = { id: 1001, username: 'qoder11', realName: '验收测试门店', roles: ['STORE_ADMIN'], storeId: 1, tenantId: 'tenant-qoder11-mock' }
  const p = permsOf(spec)
  if (p !== undefined) u.permissions = p
  return u
}

function menuTree(codes) {
  return codes.map((c, i) => ({ id: i + 1, parentId: null, menuName: c, menuCode: c, menuType: 'menu', path: '', icon: '', sortNo: i + 1, status: 'ENABLED', children: [] }))
}

const server = http.createServer((req, res) => {
  const url = req.url || ''
  const send = (status, obj) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(obj))
  }

  if (url.startsWith('/__mock')) {
    if (req.method === 'GET') {
      log(`CONTROL GET state=${JSON.stringify(state)}`)
      return send(200, state)
    }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      try {
        const patch = JSON.parse(body || '{}')
        for (const k of Object.keys(patch)) state[k] = { ...(state[k] || {}), ...(patch[k] || {}) }
        log(`CONTROL POST patch=${body} -> state=${JSON.stringify(state)}`)
        send(200, state)
      } catch (e) {
        send(400, { code: 400, msg: 'bad control json: ' + e.message })
      }
    })
    return
  }

  const respond = (spec, makeBody) => {
    const act = () => {
      if (spec.mode === 'abort') {
        log(`${req.method} ${url} -> ABORT(socket destroy)`)
        req.socket.destroy()
        return
      }
      if (spec.mode === '500') {
        log(`${req.method} ${url} -> 500`)
        return send(500, { code: 500, msg: '服务器繁忙，请稍后重试(mock)', data: null })
      }
      if (spec.mode === '401') {
        log(`${req.method} ${url} -> 401`)
        return send(401, { code: 401, msg: '登录已过期', data: null })
      }
      log(`${req.method} ${url} -> 200 mode=${spec.mode} perms=${spec.perms || '-'}`)
      send(200, { code: 200, msg: 'ok', data: makeBody(), traceId: 'mock-trace' })
    }
    if (spec.delayMs > 0) setTimeout(act, spec.delayMs)
    else act()
  }

  if (url.startsWith('/api/store/auth/login')) {
    return respond(state.login, () => ({ token: 'mock.jwt.token.qoder11', csrfToken: 'mock-csrf-token', user: userPayload(state.login) }))
  }
  if (url.startsWith('/api/admin/auth/me')) {
    return respond(state.me, () => {
      const u = { id: 1001, username: 'qoder11', realName: '验收测试门店', roles: ['STORE_ADMIN'], storeId: 1, tenantId: 'tenant-qoder11-mock' }
      const p = permsOf(state.me)
      if (p !== undefined) u.permissions = p
      return u
    })
  }
  if (url.startsWith('/api/admin/menus/user')) {
    return respond(state.menus, () => (state.menus.mode === 'empty' ? [] : menuTree(ALL_MENU_CODES)))
  }
  // 其余 /api/*：按配置回 404 或空 200（页面自身业务数据不在本清单验收面内）
  if (state.fallback.mode === '200empty') {
    log(`${req.method} ${url} -> FALLBACK 200 empty`)
    return send(200, { code: 200, msg: 'ok', data: { list: [], total: 0, records: [], rows: [] }, traceId: 'mock-trace' })
  }
  log(`${req.method} ${url} -> FALLBACK 404`)
  send(404, { code: 404, msg: '资源不存在(mock兜底)', data: null })
})

fs.writeFileSync(LOG, '')
log(`MOCK BACKEND START port=${PORT} state=${JSON.stringify(state)}`)
server.listen(PORT, () => log(`LISTENING ${PORT}`))
