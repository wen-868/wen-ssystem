import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * S3-179 ② 反测（前端侧）：平台端错误上报必须打「同端」端点，且失败**不得静默**。
 *
 * 背景：原实现 `fetch("/api/admin/error-report").catch(() => {})` —— 端点属商家端鉴权（平台令牌恒 401），
 * 又用空 catch 把失败一并吞掉，结果平台端线上错误一条都没上报成功且无人知晓。
 * 本用例把两件事都钉成机械判据：① 请求 URL/凭据；② 非 2xx 或网络失败必须 console.warn。
 */
const authStore = { token: 'platform-token', csrfToken: 'csrf-token' }
vi.mock('../stores/auth', () => ({ useAuthStore: () => authStore }))

import { reportPlatformError } from './error-report'

describe('S3-179 ② · 平台端错误上报（同端端点 + 失败不静默）', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  const fetchMock = vi.fn()

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('打平台端端点 /api/platform/error-report，并带平台令牌与 x-csrf-token', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    await reportPlatformError({ error_type: 'vue', message: 'boom', url: 'https://saas.onepan.cn/x' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }]
    expect(url).toBe('/api/platform/error-report')
    expect(url).not.toContain('/api/admin/')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer platform-token')
    expect(init.headers['x-csrf-token']).toBe('csrf-token')

    const body = JSON.parse(init.body)
    expect(body.error_type).toBe('vue')
    expect(body.source).toBe('saas-admin')
    expect(typeof body.timestamp).toBe('string')
    // 成功路径不得告警
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('端点打错（HTTP 非 2xx）⇒ console.warn，不静默', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 })

    await reportPlatformError({ error_type: 'window_error', message: 'x' })

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String((warnSpy.mock.calls[0] as unknown[])[0])).toContain('404')
  })

  it('网络失败 ⇒ console.warn，不静默、也不向上抛', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    await expect(reportPlatformError({ error_type: 'unhandled_rejection', message: 'x' })).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
