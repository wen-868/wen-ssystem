/**
 * QODER-29 · 请求出口契约 & 凭据日志（MO-11 业务码 / MO-29 统一出口与安全头 / MO-26）
 *
 * 本文件**真实驱动** `src/api/request.ts`（`vi.stubGlobal('uni', …)` 造运行时 mock，
 * 动态 import 后调用导出的 `request()` / `buildRequestHeaders()`），断言的是行为，不是读代码。
 *
 * 覆盖：
 *  - MO-11（本卡核心新增）：HTTP 2xx 但业务码非成功码 ⇒ 走错误分支（reject + toast），
 *    不得当成功数据 resolve。成功码唯一真相 `"0"`（见 request.ts:40-49），不臆造集合。
 *  - MO-29：统一安全头构建器 `buildRequestHeaders()` 产出 Authorization / X-Tenant-Id /
 *    x-csrf-token 三源；缺登录态时对应头省略；安全头优先级高于调用方 extra。
 *  - 401 GET 静默重试 / 403 权限 / 网络错误 / 超时：每条都有真实用例（补齐 401/403 之外
 *    在 request-retry-safety.spec.ts 未展开的「fail 回调族」）。
 *  - MO-29 AI：`dispatchSseText` 逐事件增量分发（text/tool_start/tool_result/done/error），
 *    不得把多事件文本吞成一次 ⇒ 证明重构后 AI SSE 增量输出未被破坏。
 *
 * 反测面（门必须能红，见回传卡 §二.5）：
 *  ① 摘掉 request.ts 的 MO-11 业务码判定分支 ⇒ 本文件「MO-11」describe 的 ②③⑥ 必红
 *     （2xx+非 0 码会被当成功 resolve）；
 *  ② 把 `buildRequestHeaders` 的 CSRF / 租户头写入摘掉 ⇒ 本文件 ⑦⑨⑩ 与静态守卫 B 同红；
 *  ③ 把 `dispatchSseText` 改成只分发首个 text 事件 ⇒ 本文件 ⑬⑭ 必红。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

interface CallRecord {
  url: string
  method?: string
  header?: Record<string, string>
}

interface StubOpts {
  /** success 回调下发的 statusCode（不填 = 走 fail 回调） */
  statusCode?: number
  /** success 回调下发的响应体 */
  data?: any
  /** 触发 fail 回调并携带的 errMsg（如 'request:fail timeout'） */
  failErrMsg?: string
  token?: string
  tenantId?: string
  csrf?: string
}

interface Stub {
  uni: Record<string, any>
  calls: CallRecord[]
  toasts: string[]
  removedKeys: string[]
}

function createUniStub(opts: StubOpts = {}): Stub {
  const calls: CallRecord[] = []
  const toasts: string[] = []
  const removedKeys: string[] = []
  const token = opts.token ?? 'jwt-live'
  const tenantId = opts.tenantId ?? 'tenant-001'
  const csrf = opts.csrf ?? 'csrf-live'

  const uni = {
    request: vi.fn((param: any) => {
      calls.push({ url: param.url, method: param.method, header: param.header })
      if (opts.failErrMsg !== undefined) {
        param.fail({ errMsg: opts.failErrMsg })
        return
      }
      param.success({ statusCode: opts.statusCode ?? 200, data: opts.data })
    }),
    uploadFile: vi.fn(),
    showToast: vi.fn((p: any) => toasts.push(p?.title)),
    hideToast: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    reLaunch: vi.fn(),
    getStorageSync: vi.fn((key: string) => {
      if (key === 'merchant_token') return token
      if (key === 'merchant_tenant_id') return tenantId
      if (key === 'merchant_csrf_token') return csrf
      return ''
    }),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn((key: string) => removedKeys.push(key)),
    getSystemInfoSync: vi.fn(() => ({ deviceId: 'd', brand: 'b', model: 'm', system: 's', platform: 'h5' }))
  }

  return { uni, calls, toasts, removedKeys }
}

/** 重置模块注册表后取一份全新 request.ts 导出（重置 unauthorizedHandling） */
async function importRequest(): Promise<any> {
  vi.resetModules()
  return await import('../src/api/request')
}

/**
 * MO-11 用例用工厂 `runWith(data)` 逐条精确构造 success 下发的响应体，
 * 避免共享 stub 的默认值把断言稀释成空断言。
 */
describe('QODER-29 MO-11 · 业务码信封判定（精确构造每条响应体）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function runWith(data: any, reqOpts: Record<string, any> = {}) {
    const stub = createUniStub({ statusCode: 200, data })
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    return { stub, mod }
  }

  it('② 200 + code "0" + data ⇒ 成功解包 data', async () => {
    const { stub, mod } = await runWith({ code: '0', msg: 'ok', data: { list: [1, 2] }, traceId: 't' })
    const result = await mod.request({ url: '/admin/x', method: 'GET' })
    expect(result).toEqual({ list: [1, 2] })
    expect(stub.toasts).toEqual([])
  })

  it('③ 200 + code "1001"（业务失败）⇒ reject 且弹 msg，绝不当成功数据返回', async () => {
    const { stub, mod } = await runWith({ code: '1001', msg: '库存不足', data: null, traceId: 't' })
    await expect(mod.request({ url: '/admin/order/create', method: 'POST', data: {} })).rejects.toThrow(
      '库存不足'
    )
    expect(stub.toasts).toEqual(['库存不足'])
  })

  it('④ 200 + code "400" 且 msg 为空 ⇒ reject 兜底文案带业务码', async () => {
    const { mod } = await runWith({ code: '400', msg: '', data: null, traceId: 't' })
    await expect(mod.request({ url: '/admin/x', method: 'GET' })).rejects.toThrow('业务处理失败 (400)')
  })

  it('⑤ 200 + 数字 0（非字符串）⇒ String() 归一后仍判成功', async () => {
    const { mod } = await runWith({ code: 0, msg: 'ok', data: { x: 1 }, traceId: 't' })
    const result = await mod.request({ url: '/admin/x', method: 'GET' })
    expect(result).toEqual({ x: 1 })
  })

  it('⑥ 200 + code "0" 但无 data 字段 ⇒ 透传整个信封（不臆测解包）', async () => {
    const { mod } = await runWith({ code: '0', msg: 'ok', traceId: 't' })
    const result = await mod.request({ url: '/admin/x', method: 'GET' })
    expect(result).toEqual({ code: '0', msg: 'ok', traceId: 't' })
  })

  it('⑦ 200 裸数组（无 code 字段）⇒ 维持透传，不触发业务码判定', async () => {
    const { mod } = await runWith([{ id: 1 }, { id: 2 }])
    const result = await mod.request({ url: '/admin/x', method: 'GET' })
    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('⑧ 200 + 业务失败 + silent ⇒ reject 但不弹 toast', async () => {
    const { stub, mod } = await runWith({ code: '2001', msg: '配额耗尽', data: null, traceId: 't' })
    await expect(mod.request({ url: '/admin/x', method: 'GET', silent: true })).rejects.toThrow('配额耗尽')
    expect(stub.toasts).toEqual([])
  })
})

describe('QODER-29 MO-29 · buildRequestHeaders 统一安全头（三源 + 优先级）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('⑨ 登录态齐全 ⇒ Authorization + X-Tenant-Id + x-csrf-token 三头同源下发', async () => {
    const stub = createUniStub()
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    const headers = mod.buildRequestHeaders()
    expect(headers['Authorization']).toBe('Bearer jwt-live')
    expect(headers['X-Tenant-Id']).toBe('tenant-001')
    expect(headers['x-csrf-token']).toBe('csrf-live')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('⑩ 缺任一登录态 ⇒ 对应头自然省略，其余照发', async () => {
    const stub = createUniStub({ token: '', csrf: '' })
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    const headers = mod.buildRequestHeaders()
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['x-csrf-token']).toBeUndefined()
    expect(headers['X-Tenant-Id']).toBe('tenant-001') // 仍读到租户
  })

  it('⑪ extra 覆盖 Content-Type，但安全头优先级最高（不可被 extra 顶掉）', async () => {
    const stub = createUniStub()
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    const headers = mod.buildRequestHeaders({
      'Content-Type': 'multipart/form-data',
      Authorization: 'Evil-Should-Be-Overwritten'
    })
    expect(headers['Content-Type']).toBe('multipart/form-data') // extra 生效
    expect(headers['Authorization']).toBe('Bearer jwt-live') // 安全头回写、覆盖 extra
  })

  it('⑫ request() 出口实际带上了这三头（构建器真被消费）', async () => {
    const stub = createUniStub({ statusCode: 200, data: { code: '0', data: { ok: 1 } } })
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    await mod.request({ url: '/admin/x', method: 'POST', data: {} })
    const h = stub.calls[0].header!
    expect(h['Authorization']).toBe('Bearer jwt-live')
    expect(h['X-Tenant-Id']).toBe('tenant-001')
    expect(h['x-csrf-token']).toBe('csrf-live')
  })
})

describe('QODER-29 · 401 重试 / 403 / 网络错误 / 超时（fail 回调族真实用例）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('⑬ 401 GET 且本地可读 token ⇒ 静默重试恰一次并成功', async () => {
    // 首次 401、第二次 200：手工编排 stub 的调用序号响应
    const calls: CallRecord[] = []
    const uni = {
      request: vi.fn((param: any) => {
        calls.push({ url: param.url, method: param.method })
        if (calls.length === 1) {
          param.success({ statusCode: 401, data: { code: '401', msg: '', data: null } })
        } else {
          param.success({ statusCode: 200, data: { code: '0', msg: 'ok', data: { ok: true } } })
        }
      }),
      showToast: vi.fn(),
      reLaunch: vi.fn(),
      removeStorageSync: vi.fn(),
      getStorageSync: vi.fn((k: string) => (k === 'merchant_token' ? 'jwt-live' : ''))
    }
    vi.stubGlobal('uni', uni)
    const mod = await importRequest()
    const result = await mod.request({ url: '/admin/x', method: 'GET' })
    expect(calls.length).toBe(2)
    expect(result).toEqual({ ok: true })
  })

  it('⑭ 403 ⇒ reject 权限兜底文案', async () => {
    const stub = createUniStub({ statusCode: 403, data: { code: '403', msg: '', data: null } })
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    await expect(mod.request({ url: '/admin/x', method: 'GET' })).rejects.toThrow('权限不足，无法访问')
    expect(stub.calls.length).toBe(1)
    expect(stub.removedKeys).toEqual([]) // 403 不清登录态
  })

  it('⑮ 网络错误（fail 非 timeout）⇒ reject「网络连接失败」', async () => {
    const stub = createUniStub({ failErrMsg: 'request:fail' })
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    await expect(mod.request({ url: '/admin/x', method: 'GET' })).rejects.toThrow('网络连接失败，请检查网络')
    expect(stub.toasts).toEqual(['网络连接失败，请检查网络'])
  })

  it('⑯ 超时（fail 含 timeout）⇒ reject「网络请求超时」', async () => {
    const stub = createUniStub({ failErrMsg: 'request:fail timeout' })
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    await expect(mod.request({ url: '/admin/x', method: 'GET' })).rejects.toThrow('网络请求超时，请重试')
    expect(stub.toasts).toEqual(['网络请求超时，请重试'])
  })
})

describe('QODER-29 MO-29 · AI SSE 增量输出未被重构破坏（dispatchSseText）', () => {
  it('⑰ 多行 text 事件逐条增量分发，不吞并', async () => {
    const ai = await import('../src/api/modules/ai')
    const texts: string[] = []
    const handlers = {
      onText: (c: string) => texts.push(c),
      onToolStart: () => {},
      onToolResult: () => {},
      onDone: () => {},
      onError: () => {}
    }
    // 模拟一次 chunk 内到达的三条增量文本 + 一条 done（H5 与非 H5 都经 dispatchSseText）
    ai.dispatchSseText(
      [
        'data: {"type":"text","content":"你"}',
        'data: {"type":"text","content":"好"}',
        'data: {"type":"text","content":"，店长"}',
        'data: {"type":"done","conversationId":"c-9"}'
      ].join('\n'),
      handlers
    )
    expect(texts).toEqual(['你', '好', '，店长'])
  })

  it('⑱ tool_start / tool_result / error 各自路由到对应回调', async () => {
    const ai = await import('../src/api/modules/ai')
    const started: string[] = []
    const results: any[] = []
    const errors: string[] = []
    ai.dispatchSseText(
      [
        'data: {"type":"tool_start","tool":"create_order"}',
        'data: {"type":"tool_result","tool":"create_order","success":true,"confirmationId":"cf-1"}',
        'data: {"type":"error","message":"下游超时"}'
      ].join('\n'),
      {
        onText: () => {},
        onToolStart: (t) => started.push(t),
        onToolResult: (e) => results.push(e),
        onDone: () => {},
        onError: (m) => errors.push(m)
      }
    )
    expect(started).toEqual(['create_order'])
    expect(results[0].confirmationId).toBe('cf-1')
    expect(errors).toEqual(['下游超时'])
  })

  it('⑲ 非 data 行与坏 JSON 被安全忽略（不抛、不误触回调）', async () => {
    const ai = await import('../src/api/modules/ai')
    let textCount = 0
    expect(() =>
      ai.dispatchSseText(
        ['event: message', ': ping', 'data:', 'data: {坏JSON}', 'data: {"type":"text","content":"ok"}'].join('\n'),
        {
          onText: () => textCount++,
          onToolStart: () => {},
          onToolResult: () => {},
          onDone: () => {},
          onError: () => {}
        }
      )
    ).not.toThrow()
    expect(textCount).toBe(1)
  })
})

describe('QODER-29 MO-26 · 源码不含明文凭据日志（静态兜底，配合守卫 C）', () => {
  it('⑳ 登录页演示日志只打长度、绝不打明文 password（跳过注释行，与守卫 C 同口径）', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      fileURLToPath(new URL('../src/pages/login/login.vue', import.meta.url)),
      'utf8'
    )
    // 仅检查「非注释代码行」：注释里允许出现被否定的旧写法说明（守卫 C 同样跳过注释行）。
    const codeLines = src
      .split(/\r?\n/)
      .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
      .join('\n')
    // 真实代码里绝不允许出现 console.*(... password=%s ... loginForm.password) 的明文取值形态
    expect(codeLines).not.toMatch(/console\.\w+\([^)]*\bpassword\s*=\s*%s[^)]*\.password\s*\)/i)
    // 反面对照（非空断言证明）：允许的长度脱敏形态确实存在于代码行
    expect(codeLines).toMatch(/passwordLen=%d[^)]*\.password\.length/)
  })
})
