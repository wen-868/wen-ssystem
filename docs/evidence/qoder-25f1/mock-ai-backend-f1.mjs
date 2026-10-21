// ============================================================================
// QODER-25F1 · AI Chat H5 实开取证用 mock SSE 后端（网络装置，非产品代码，不入库 src）
//
// 形态来源：docs/evidence/qoder-25/mock-ai-backend.mjs（上一轮 QODER-25 已在册夹具），
// 本文件按同一实现落到本卡端口口径：**MOCK_PORT 固定 8488**（派单并发隔离要求，
// 8388 是上一轮 QODER-25 用过的端口，本卡禁止使用，也未使用）。
//
// 配合 app-mobile/.env（.env 在根 .gitignore 内，不入库）：
//   VITE_PROXY_TARGET=http://localhost:8488   # H5 主 API 相对路径 /api 走 vite dev proxy
//   VITE_AI_BASE_URL=http://localhost:8488    # AI 底座基址（ai.ts:33 的 ${AI_BASE_URL}/api/chat）
//
// 取证点：
//   1) /api/chat 以 intervalMs 节奏逐片推 text 事件，收满 events 片后推 done；
//   2) req 'close' 分支打印 `SSE CLIENT CLOSE after i events (remaining N events NOT sent)`
//      ⇒ 与前端 DOM 读数互证「停止生成」真的掐断了底层 fetch；
//   3) /__mock 控制场景（改 intervalMs / events）。
//
// 用法：MOCK_PORT=8488 MOCK_LOG=<日志路径> node mock-ai-backend-f1.mjs
//       curl http://localhost:8488/__mock
//       curl -X POST http://localhost:8488/__mock -d '{"chat":{"intervalMs":300,"events":200}}'
// ============================================================================
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const LOG = process.env.MOCK_LOG ? path.resolve(process.env.MOCK_LOG) : path.join(HERE, 'mock-ai-backend-f1.log')
const PORT = Number(process.env.MOCK_PORT || 8488)

const state = {
  chat: { intervalMs: 350, events: 60, closeEarly: 0 },
  models: { mode: 'ok' },
  tts: { mode: 'ok' }
}

let logLines = 0
function log(s) {
  logLines += 1
  const line = `[${new Date().toISOString()}] ${s}`
  fs.appendFileSync(LOG, line + '\n')
  console.log(line)
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Max-Age': '600'
}

const USER = {
  id: 1001,
  username: 'qoder25f1',
  realName: '取证门店',
  roles: ['STORE_ADMIN'],
  storeId: 1,
  tenantId: 'tenant-qoder25f1-mock',
  permissions: ['*']
}

const MODELS = {
  default: 'builtin-general',
  models: [
    { value: 'builtin-general', label: '经营助手（内置）', type: 'builtin' },
    { value: 'external-deep', label: '外部深度模型', type: 'external' }
  ]
}

const server = http.createServer((req, res) => {
  const url = req.url || ''

  const send = (status, obj, extra = {}) => {
    res.writeHead(status, {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      ...extra
    })
    res.end(typeof obj === 'string' ? obj : JSON.stringify(obj))
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
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

  // ---------- 登录链（供 H5 实开进入受保护页面；与 11R / QODER-25 夹具同形） ----------
  if (url.startsWith('/api/store/auth/login')) {
    log('POST /api/store/auth/login -> 200 token')
    return send(200, { code: 200, msg: 'ok', data: { token: 'mock.jwt.qoder25f1', csrfToken: 'mock-csrf', user: USER }, traceId: 'mock-trace' })
  }
  if (url.startsWith('/api/admin/auth/me')) {
    log('GET /api/admin/auth/me -> 200')
    return send(200, { code: 200, msg: 'ok', data: USER, traceId: 'mock-trace' })
  }
  if (url.startsWith('/api/admin/menus/user')) {
    log('GET /api/admin/menus/user -> 200 ([])')
    return send(200, { code: 200, msg: 'ok', data: [], traceId: 'mock-trace' })
  }

  // ---------- AI 底座 ----------
  if (url.startsWith('/api/chat/models')) {
    log('GET /api/chat/models -> 200 models=' + MODELS.models.length)
    return send(200, MODELS)
  }

  if (url.startsWith('/api/voice/tts')) {
    log('POST /api/voice/tts -> 200 audio(占位 base64)')
    return send(200, { code: '0', msg: 'ok', data: { audio: 'quEffgAAAAAAAP//gA==', format: 'mp3' } })
  }

  if (url.startsWith('/api/chat')) {
    const cfg = state.chat
    log(`POST /api/chat -> SSE stream interval=${cfg.intervalMs}ms events=${cfg.events}`)
    res.writeHead(200, {
      ...CORS,
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    })
    let i = 0
    const timer = setInterval(() => {
      i += 1
      if (i > cfg.events) {
        clearInterval(timer)
        res.write(`data: ${JSON.stringify({ type: 'done', conversationId: 'convo-mock-' + Date.now() })}\n\n`)
        log(`SSE DONE after ${cfg.events} events (client stayed until the end)`)
        return res.end()
      }
      res.write(`data: ${JSON.stringify({ type: 'text', content: `第${i}片经营分析数据。` })}\n\n`)
      if (i % 10 === 0) log(`SSE sent ${i}/${cfg.events}`)
    }, cfg.intervalMs)

    // 客户端真的把请求掐掉了 ⇒ 这里能看到 close（用于证明「停止生成」不是只改 UI）
    req.on('close', () => {
      clearInterval(timer)
      log(`SSE CLIENT CLOSE after ${i} events (remaining ${Math.max(0, cfg.events - i)} events NOT sent)`)
    })
    return
  }

  log(`${req.method} ${url} -> FALLBACK 200 empty`)
  send(200, { code: 200, msg: 'ok', data: { list: [], total: 0 }, traceId: 'mock-trace' })
})

fs.writeFileSync(LOG, '')
log(`MOCK AI BACKEND START port=${PORT} state=${JSON.stringify(state)}`)
server.listen(PORT, () => log(`LISTENING ${PORT}`))
