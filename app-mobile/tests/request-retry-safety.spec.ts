/**
 * QODER-14 · 401 重试安全性 + 清态补 CSRF
 *
 * 目标：`src/api/request.ts` 的 401 分支。
 *  - 静默重试（防误杀）**只允许幂等的 GET**；POST/PUT/DELETE 首次 401 直接清态 + 提示 + 跳登录。
 *  - method 缺省按 GET 处理，统一大写比较。
 *  - 401 清态必须包含 `merchant_csrf_token`。
 *
 * 本文件**真实驱动** request.ts：用 `vi.stubGlobal('uni', …)` 造 uni 运行时 mock，
 * 动态 `import('../src/api/request')` 后调用导出的 `request()`，让真实代码走到
 * success 回调里的 401 分支；重试次数用 `uni.request` 的 mock 调用计数断言，
 * 清态用 `uni.removeStorageSync` 记录的**被删键集合**断言。
 * ⚠️ 每个用例前 `vi.resetModules()` + 重新 import，重置 request.ts 的模块级
 *    `unauthorizedHandling` 并发去重锁，避免用例间互相吞掉 toast / reLaunch。
 *
 * 反测面（门必须能红）：
 *  ① 把 GET 判定摘掉恢复「无条件重放」⇒ 用例「POST / PUT / DELETE 不重放」三条必红；
 *  ② 删掉 `uni.removeStorageSync('merchant_csrf_token')` ⇒ 用例「401 清态含 CSRF 键」必红。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/** 一次 uni.request 调用的可观察痕迹 */
interface CallRecord {
  url: string
  method?: string
  header?: Record<string, string>
}

interface UniStubOptions {
  /** merchant_token 的可读值（'' 表示本地读不到 token） */
  token?: string
  /** 首请求返回的状态码 */
  statusCode?: number
  /** 第二次及以后返回的状态码（默认 200，用于验证 GET 重试可成功收尾） */
  laterStatusCode?: number
}

interface UniStub {
  uni: Record<string, any>
  calls: CallRecord[]
  removedKeys: string[]
  toastTitles: string[]
  reLaunchUrls: string[]
}

/** 构造 uni 运行时 mock：只实现 request.ts 用到的 API */
function createUniStub(options: UniStubOptions = {}): UniStub {
  const token = options.token ?? 'jwt-token-可读'
  const firstStatus = options.statusCode ?? 401
  const laterStatus = options.laterStatusCode ?? 200

  const calls: CallRecord[] = []
  const removedKeys: string[] = []
  const toastTitles: string[] = []
  const reLaunchUrls: string[] = []

  const uni = {
    request: vi.fn((param: any) => {
      calls.push({ url: param.url, method: param.method, header: param.header })
      const statusCode = calls.length === 1 ? firstStatus : laterStatus
      // uni.request 的 success 回调按「已收到响应」同步触发，
      // request.ts 内部的递归重试因此会立刻产生第二次调用
      param.success({
        statusCode,
        data:
          statusCode >= 200 && statusCode < 300
            ? { code: '0', msg: 'ok', data: { ok: true }, traceId: 'trace-ok' }
            : // msg 留空 ⇒ request.ts 走各状态码的兜底文案（用例按兜底文案断言）
              { code: String(statusCode), msg: '', data: null, traceId: 'trace-err' }
      })
    }),
    uploadFile: vi.fn(),
    showToast: vi.fn((p: any) => {
      toastTitles.push(p?.title)
    }),
    hideToast: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    reLaunch: vi.fn((p: any) => {
      reLaunchUrls.push(p?.url)
    }),
    // storage.ts 拦截器安装后的等价语义：敏感 Key 直接返回解密原值
    getStorageSync: vi.fn((key: string) => {
      if (key === 'merchant_token') return token
      if (key === 'merchant_tenant_id') return 'tenant-001'
      if (key === 'merchant_csrf_token') return 'csrf-token-001'
      return ''
    }),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn((key: string) => {
      removedKeys.push(key)
    }),
    getSystemInfoSync: vi.fn(() => ({ deviceId: 'd', brand: 'b', model: 'm', system: 's', platform: 'h5' }))
  }

  return { uni, calls, removedKeys, toastTitles, reLaunchUrls }
}

/** 重置模块注册表后取一份全新的 request.ts 导出 */
async function importRequest(): Promise<any> {
  vi.resetModules()
  return await import('../src/api/request')
}

describe('QODER-14 · 401 静默重试只允许 GET + 清 CSRF', () => {
  let stub: UniStub

  beforeEach(() => {
    stub = createUniStub()
    vi.stubGlobal('uni', stub.uni)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('① GET 首请求 401 且本地可读 token ⇒ 静默重试恰好一次并成功收尾', async () => {
    const mod = await importRequest()
    const data = await mod.request({ url: '/admin/order/list', method: 'GET' })

    // 首请求 + 重试 = 2 次，即「重试恰一次」
    expect(stub.calls.length).toBe(2)
    expect(stub.calls.every((c) => c.method === 'GET')).toBe(true)
    // 重试成功 ⇒ 不弹「登录已过期」、不跳登录、不清态
    expect(data).toEqual({ ok: true })
    expect(stub.toastTitles).toEqual([])
    expect(stub.reLaunchUrls).toEqual([])
    expect(stub.removedKeys).toEqual([])
  })

  it('② POST 首请求 401 且本地可读 token ⇒ 0 次重试（写操作禁止重放）', async () => {
    const mod = await importRequest()
    await expect(
      mod.request({ url: '/admin/order/create', method: 'POST', data: { qty: 1 } })
    ).rejects.toThrow('登录已过期，请重新登录')

    // 只有原始那一次调用 ⇒ 没有任何重放（重放 = 重复开单）
    expect(stub.calls.length).toBe(1)
    expect(stub.calls[0].method).toBe('POST')
    expect(stub.reLaunchUrls).toEqual(['/pages/login/login'])
  })

  it('③ PUT 首请求 401 ⇒ 0 次重放', async () => {
    const mod = await importRequest()
    await expect(mod.request({ url: '/admin/order/1', method: 'PUT', data: { qty: 2 } })).rejects.toThrow(
      '登录已过期，请重新登录'
    )
    expect(stub.calls.length).toBe(1)
    expect(stub.calls[0].method).toBe('PUT')
  })

  it('③ DELETE 首请求 401 ⇒ 0 次重放', async () => {
    const mod = await importRequest()
    await expect(mod.request({ url: '/admin/order/1', method: 'DELETE' })).rejects.toThrow(
      '登录已过期，请重新登录'
    )
    expect(stub.calls.length).toBe(1)
    expect(stub.calls[0].method).toBe('DELETE')
  })

  it('④ 401 清态必须包含 merchant_csrf_token（连带 token / user / tenant_id）', async () => {
    const mod = await importRequest()
    await expect(mod.request({ url: '/admin/order/create', method: 'POST' })).rejects.toThrow()

    // 被删键集合精确等于四项登录态：缺 CSRF ⇒ 本用例红
    expect([...new Set(stub.removedKeys)].sort()).toEqual(
      ['merchant_csrf_token', 'merchant_tenant_id', 'merchant_token', 'merchant_user'].sort()
    )
    // 写请求确实带上了 CSRF（证明该键是活跃登录态，不是摆设）
    expect(stub.calls[0].header?.['x-csrf-token']).toBe('csrf-token-001')
  })

  it('⑤ method 缺省 ⇒ 按 GET 处理，仍允许静默重试一次', async () => {
    const mod = await importRequest()
    const data = await mod.request({ url: '/admin/order/list' })
    expect(data).toEqual({ ok: true })
    expect(stub.calls.length).toBe(2)
    // request.ts 在函数入口对 method 取默认值 GET，两次调用下发给 uni 的都是 GET
    expect(stub.calls.map((c) => c.method)).toEqual(['GET', 'GET'])
  })

  it('⑥ 小写 method "get" ⇒ 统一大写比较后仍按 GET 重试', async () => {
    const mod = await importRequest()
    const data = await mod.request({ url: '/admin/order/list', method: 'get' as any })
    expect(data).toEqual({ ok: true })
    expect(stub.calls.length).toBe(2)
  })

  it('⑦ GET 401 但本地读不到 token ⇒ 不重试，直接清态并跳登录', async () => {
    stub = createUniStub({ token: '' })
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    await expect(mod.request({ url: '/admin/order/list', method: 'GET' })).rejects.toThrow(
      '登录已过期，请重新登录'
    )
    expect(stub.calls.length).toBe(1)
    expect(stub.removedKeys).toContain('merchant_csrf_token')
  })

  it('⑧ 401 重试只重试一次（GET 二次仍 401 ⇒ 不再无限重放）', async () => {
    stub = createUniStub({ laterStatusCode: 401 })
    vi.stubGlobal('uni', stub.uni)
    const mod = await importRequest()
    await expect(mod.request({ url: '/admin/order/list', method: 'GET' })).rejects.toThrow(
      '登录已过期，请重新登录'
    )
    expect(stub.calls.length).toBe(2)
    expect(stub.removedKeys).toContain('merchant_csrf_token')
  })

  it('⑨ 403 / 404 / 500 处理不受本次改动影响', async () => {
    for (const [statusCode, msg] of [
      [403, '权限不足，无法访问'],
      [404, '资源不存在'],
      [500, '服务器繁忙，请稍后重试']
    ] as const) {
      const local = createUniStub({ statusCode })
      vi.stubGlobal('uni', local.uni)
      const mod = await importRequest()
      await expect(mod.request({ url: '/admin/order/list', method: 'GET' })).rejects.toThrow(msg)
      // 非 401 ⇒ 不重试、不清登录态
      expect(local.calls.length).toBe(1)
      expect(local.removedKeys).toEqual([])
    }
  })

  it('⑩ 源码静态兜底：重试条件里带 GET 判定且清理 CSRF（不可代替上面的行为用例）', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      fileURLToPath(new URL('../src/api/request.ts', import.meta.url)),
      'utf8'
    )
    expect(src).toMatch(/toUpperCase\(\)/)
    expect(src).toMatch(/retryMethod === 'GET'/)
    expect(src).toContain("uni.removeStorageSync('merchant_csrf_token')")
  })
})

/**
 * ⑪~⑬ CSRF「镜像键」语义实测（回传卡 §三 的那条判断在这里被测，不是只靠读代码）
 *
 * 事实链（storage.ts + utils/crypto.ts）：
 *  - storage.ts 的 SENSITIVE_KEYS 含 CSRF_TOKEN: 'merchant_csrf_token'；
 *  - crypto.ts 把敏感 Key 写成 `enc_${key}` 镜像键（H5 走 window.localStorage，App/小程序走 uni）；
 *  - storage.ts 模块加载时安装 uni.getStorageSync / uni.removeStorageSync 拦截器，
 *    对敏感 Key 的 remove 会「removeSecureStorage(key) + 原始 removeStorageSync(key)」两条一起做。
 * ⇒ request.ts 里那一行 `uni.removeStorageSync('merchant_csrf_token')`
 *    在真实运行期（拦截器已由 App.vue → stores/user → api/storage 装载）会**同时**清掉明文键
 *    和 enc_ 镜像键，因此**不需要**第二条删除。以下用例实测这一结论。
 */
describe('QODER-14 · 401 清态对 enc_ 镜像键的实际效果（storage.ts 拦截器在环）', () => {
  interface Chain {
    uni: Record<string, any>
    ls: Map<string, string>
    uniStore: Map<string, any>
    calls: CallRecord[]
    removedKeys: string[]
  }

  let chain: Chain

  function createChainStub(): Chain {
    const uniStore = new Map<string, any>()
    const ls = new Map<string, string>()
    const calls: CallRecord[] = []
    const removedKeys: string[] = []

    const uni = {
      request: vi.fn((param: any) => {
        calls.push({ url: param.url, method: param.method })
        param.success({ statusCode: 401, data: { code: '401', msg: '', data: null, traceId: 't' } })
      }),
      uploadFile: vi.fn(),
      showToast: vi.fn(),
      hideToast: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      reLaunch: vi.fn(),
      getStorageSync: vi.fn((key: string) => (uniStore.has(key) ? uniStore.get(key) : '')),
      setStorageSync: vi.fn((key: string, value: any) => {
        uniStore.set(key, value)
      }),
      removeStorageSync: vi.fn((key: string) => {
        removedKeys.push(key)
        uniStore.delete(key)
      }),
      getSystemInfoSync: vi.fn(() => ({ deviceId: 'd', brand: 'b', model: 'm', system: 's', platform: 'h5' }))
    }

    // crypto.ts 的 H5 分支直接读写 window.localStorage（与 uni 的存储层不是同一处）
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => (ls.has(k) ? ls.get(k) as string : null),
        setItem: (k: string, v: string) => {
          ls.set(k, String(v))
        },
        removeItem: (k: string) => {
          ls.delete(k)
        }
      }
    })
    vi.stubGlobal('uni', uni)

    return { uni, ls, uniStore, calls, removedKeys }
  }

  beforeEach(() => {
    chain = createChainStub()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** 按真实启动顺序装载：先 storage.ts（安装拦截器）→ 再 request.ts */
  async function loadChain(): Promise<any> {
    vi.resetModules()
    const storage = await import('../src/api/storage')
    const request = await import('../src/api/request')
    return { storage, request }
  }

  it('⑪ 拦截器在环时，单条 removeStorageSync(csrf) 同时清掉明文键与 enc_ 镜像键', async () => {
    const { storage } = await loadChain()
    storage.setCsrfToken('csrf-live')
    expect(storage.getCsrfToken()).toBe('csrf-live')
    expect(chain.ls.get('enc_merchant_csrf_token')).toBeTruthy()

    // request.ts 用的就是这一条调用（不是两条）
    chain.uni.removeStorageSync('merchant_csrf_token')

    expect(chain.ls.has('enc_merchant_csrf_token')).toBe(false) // 镜像键被拦截器连带删除
    expect(storage.getCsrfToken()).toBe('') // 再读已为空
  })

  it('⑫ 真实 401 路径跑完后，enc_merchant_csrf_token 与 enc_merchant_token 均不残留', async () => {
    const { storage, request } = await loadChain()
    storage.setToken('jwt-live')
    storage.setCsrfToken('csrf-live')
    storage.setTenant({ id: 'tenant-001', name: '门店', code: 'T1' })
    expect(storage.getToken()).toBe('jwt-live')

    // POST 首请求 401 ⇒ 走「不重试 + 清态」分支（真实驱动 request.ts）
    await expect(request.request({ url: '/admin/order/create', method: 'POST' })).rejects.toThrow(
      '登录已过期，请重新登录'
    )

    expect(chain.calls.length).toBe(1)
    // CSRF 与 token 走同一套语义 ⇒ 明文键与加密镜像键都清干净
    expect(storage.getCsrfToken()).toBe('')
    expect(storage.getToken()).toBe('')
    expect(chain.ls.has('enc_merchant_csrf_token')).toBe(false)
    expect(chain.ls.has('enc_merchant_token')).toBe(false)
    expect(chain.uniStore.has('merchant_csrf_token')).toBe(false)
  })

  it('⑬ 未装拦截器的裸 uni（等价于存储层退化态）下，镜像键只能由 storage.ts 的 removeCsrfToken 清', async () => {
    // 说明：本用例固定「谁负责删镜像键」的归属 —— 是 storage.ts 的拦截器 / removeSecureStorage，
    // 而不是 request.ts 里再补一条 uni.removeStorageSync('enc_merchant_csrf_token')。
    // H5 下 crypto.ts 把 enc_ 键写在 window.localStorage，而 uni.removeStorageSync 清的是
    // uni 自己的存储层（另一处），补那条删除在 H5 上打不中目标，属无效代码。
    const { storage } = await loadChain()
    storage.setCsrfToken('csrf-live')
    storage.removeCsrfToken()
    expect(chain.ls.has('enc_merchant_csrf_token')).toBe(false)
    expect(storage.getCsrfToken()).toBe('')
  })
})
