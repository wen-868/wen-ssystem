/**
 * REHYDRATE-01 · 会话恢复契约测试（TOTAL-PLATFORM-SESSION-REHYDRATE-01）
 *
 * 防线：
 *  R1 恢复成功链路（token 有效 + adminInfo 空 → /auth/me → 填充身份）
 *  R2 no-token 短路（不发请求）
 *  R3 缓存命中短路（adminInfo 已有则不重复请求）
 *  R4 fail-closed（401/业务失败 ⇒ 清会话返回 'expired'）
 *  R5 网络失败保留 token（'network-error'，可重试，不清会话）
 *  R6 single-flight（并发恢复只发一个 /auth/me）
 *  R7 force 绕过缓存
 *  R8 csrfToken 同步
 *  R9 身份文案真实化（platformUserLabel 不虚构「超级管理员」）
 *
 * 环境：node（无 DOM）。api/auth 为 mock；localStorage 为 stub。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const getAdminInfoRawMock = vi.fn()
const getAdminInfoApiMock = vi.fn()
const loginApiMock = vi.fn()

vi.mock('../api/auth', () => ({
  getAdminInfoRaw: (...args: unknown[]) => getAdminInfoRawMock(...args),
  getAdminInfoApi: (...args: unknown[]) => getAdminInfoApiMock(...args),
  loginApi: (...args: unknown[]) => loginApiMock(...args),
}))

type LS = Record<string, string>
let ls: LS

function makeLS() {
  ls = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in ls ? ls[k] : null),
    setItem: (k: string, v: string) => { ls[k] = v },
    removeItem: (k: string) => { delete ls[k] },
  })
}

/** 固定 JWT（守卫解析 exp 用，但 store 层测试不经过守卫，仅作 token 字面量） */
const TOKEN = 'header.eyJleHAiOjk5OTk5OTk5OTl9.sig'
const ME_BODY = {
  code: '0',
  msg: '成功',
  data: { id: 1, username: 'cja_super', realName: '审计超管', mfaEnabled: false, csrfToken: 'csrf-me-1' },
}

async function freshStore() {
  // 动态 import：确保 mock 与 localStorage stub 先于模块顶层读取 localStorage 生效
  const mod = await import('./auth')
  setActivePinia(createPinia())
  const store = mod.useAuthStore()
  return { mod, store }
}

beforeEach(() => {
  vi.resetModules()
  makeLS()
  getAdminInfoRawMock.mockReset()
  getAdminInfoApiMock.mockReset()
  loginApiMock.mockReset()
})

describe('R1/R2/R3 · rehydrate 基本链路', () => {
  it('R1-1 token 有效且 adminInfo 空 → ok 且身份填充真实姓名', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoRawMock.mockResolvedValue({ data: ME_BODY })
    const { store } = await freshStore()
    const state = await store.rehydrate()
    expect(state).toBe('ok')
    expect(store.adminInfo).toMatchObject({ id: 1, username: 'cja_super', realName: '审计超管' })
  })

  it('R2-1 无 token → no-token 且不发起 /auth/me', async () => {
    const { store } = await freshStore()
    const state = await store.rehydrate()
    expect(state).toBe('no-token')
    expect(getAdminInfoRawMock).not.toHaveBeenCalled()
  })

  it('R3-1 adminInfo 已有 → ok 且缓存命中不重复请求', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoRawMock.mockResolvedValue({ data: ME_BODY })
    const { store } = await freshStore()
    expect(await store.rehydrate()).toBe('ok')
    expect(await store.rehydrate()).toBe('ok')
    expect(getAdminInfoRawMock).toHaveBeenCalledTimes(1)
  })
})

describe('R4 · fail-closed（后端明确拒绝）', () => {
  it('R4-1 401 → expired 且清内存会话（token/csrf/adminInfo）', async () => {
    ls['platform_token'] = TOKEN
    ls['platform_csrf_token'] = 'csrf-old'
    getAdminInfoRawMock.mockRejectedValue({ response: { status: 401 } })
    const { store } = await freshStore()
    const state = await store.rehydrate()
    expect(state).toBe('expired')
    expect(store.token).toBe('')
    expect(store.csrfToken).toBe('')
    expect(store.adminInfo).toBeNull()
  })

  it('R4-2 401 → localStorage 的 token/csrf 全部移除（无残留）', async () => {
    ls['platform_token'] = TOKEN
    ls['platform_csrf_token'] = 'csrf-old'
    getAdminInfoRawMock.mockRejectedValue({ response: { status: 401 } })
    const { store } = await freshStore()
    await store.rehydrate()
    expect(ls['platform_token']).toBeUndefined()
    expect(ls['platform_csrf_token']).toBeUndefined()
  })

  it('R4-3 业务失败（code != 0）→ 同样 fail-closed 返回 expired', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoRawMock.mockResolvedValue({ data: { code: '500', msg: '管理员不存在' } })
    const { store } = await freshStore()
    expect(await store.rehydrate()).toBe('expired')
    expect(store.token).toBe('')
  })
})

describe('R5 · 网络失败保留 token（可重试）', () => {
  it('R5-1 无 response 的网络错误 → network-error 且内存 token 保留', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoRawMock.mockRejectedValue(new Error('Network Error'))
    const { store } = await freshStore()
    const state = await store.rehydrate()
    expect(state).toBe('network-error')
    expect(store.token).toBe(TOKEN)
    expect(ls['platform_token']).toBe(TOKEN)
  })

  it('R5-2 5xx 也不是身份失效 → network-error 保留 token', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoRawMock.mockRejectedValue({ response: { status: 502 } })
    const { store } = await freshStore()
    expect(await store.rehydrate()).toBe('network-error')
    expect(ls['platform_token']).toBe(TOKEN)
  })

  it('R5-3 登录链路 fetchAdminInfo：网络失败 rethrow 但不清 token', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoApiMock.mockRejectedValue(new Error('timeout'))
    const { store } = await freshStore()
    await expect(store.fetchAdminInfo()).rejects.toThrow('timeout')
    expect(store.token).toBe(TOKEN)
    expect(ls['platform_token']).toBe(TOKEN)
  })

  it('R5-4 登录链路 fetchAdminInfo：401 → 清会话（fail-closed）', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoApiMock.mockRejectedValue({ response: { status: 401 } })
    const { store } = await freshStore()
    await expect(store.fetchAdminInfo()).rejects.toBeTruthy()
    expect(store.token).toBe('')
    expect(ls['platform_token']).toBeUndefined()
  })
})

describe('R6/R7/R8 · single-flight、force、csrf 同步', () => {
  it('R6-1 并发 3 次 rehydrate → 只发 1 个 /auth/me，结果一致', async () => {
    ls['platform_token'] = TOKEN
    let resolveMe: (v: unknown) => void
    getAdminInfoRawMock.mockReturnValue(new Promise((r) => { resolveMe = r }))
    const { store } = await freshStore()
    const p1 = store.rehydrate()
    const p2 = store.rehydrate()
    const p3 = store.rehydrate()
    resolveMe!({ data: ME_BODY })
    const results = await Promise.all([p1, p2, p3])
    expect(results).toEqual(['ok', 'ok', 'ok'])
    expect(getAdminInfoRawMock).toHaveBeenCalledTimes(1)
  })

  it('R7-1 force=true → adminInfo 已有仍重新请求并刷新', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoRawMock
      .mockResolvedValueOnce({ data: ME_BODY })
      .mockResolvedValueOnce({ data: { ...ME_BODY, data: { ...ME_BODY.data, realName: '审计超管2' } } })
    const { store } = await freshStore()
    await store.rehydrate()
    const state = await store.rehydrate(true)
    expect(state).toBe('ok')
    expect(getAdminInfoRawMock).toHaveBeenCalledTimes(2)
    expect(store.adminInfo?.realName).toBe('审计超管2')
  })

  it('R8-1 me 下发 csrfToken → 同步到 store 与 localStorage', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoRawMock.mockResolvedValue({ data: ME_BODY })
    const { store } = await freshStore()
    await store.rehydrate()
    expect(store.csrfToken).toBe('csrf-me-1')
    expect(ls['platform_csrf_token']).toBe('csrf-me-1')
  })

  it('R8-2 恢复期间 rehydrating=true，结束后 false', async () => {
    ls['platform_token'] = TOKEN
    let resolveMe: (v: unknown) => void
    getAdminInfoRawMock.mockReturnValue(new Promise((r) => { resolveMe = r }))
    const { store } = await freshStore()
    const p = store.rehydrate()
    expect(store.rehydrating).toBe(true)
    resolveMe!({ data: ME_BODY })
    await p
    expect(store.rehydrating).toBe(false)
  })
})

describe('R9 · 身份文案真实化（platformUserLabel）', () => {
  it('R9-1 info 为 null → 未登录', async () => {
    const { mod } = await freshStore()
    expect(mod.platformUserLabel(null)).toBe('未登录')
  })

  it('R9-2 真实姓名优先，role 可映射时显示真实角色', async () => {
    const { mod } = await freshStore()
    expect(mod.platformUserLabel({ id: 1, username: 'cja_super', realName: '审计超管', role: 'PLATFORM_SUPER_ADMIN' }))
      .toBe('审计超管 · 超级管理员')
    expect(mod.platformUserLabel({ id: 2, username: 'cja_support', realName: '平台支持员', role: 'PLATFORM_SUPPORT' }))
      .toBe('平台支持员 · 平台支持')
  })

  it('R9-3 后端未透出 role（当前 /me 实际形态）→ 只显示姓名，绝不虚构「超级管理员」', async () => {
    const { mod } = await freshStore()
    const label = mod.platformUserLabel({ id: 2, username: 'cja_support', realName: '平台支持员' })
    expect(label).toBe('平台支持员')
    expect(label).not.toContain('超级管理员')
  })

  it('R9-4 realName 缺失回退 username；未知 role 码不虚构角色', async () => {
    const { mod } = await freshStore()
    expect(mod.platformUserLabel({ id: 3, username: 'ops01', realName: '' })).toBe('ops01')
    expect(mod.platformUserLabel({ id: 4, username: 'x', realName: '某人', role: 'UNKNOWN_ROLE' })).toBe('某人')
  })
})

describe('双账号切换（logout 后旧身份不残留）', () => {
  it('X1 logout 后 rehydrate → no-token，且不携带旧身份发请求', async () => {
    ls['platform_token'] = TOKEN
    getAdminInfoRawMock.mockResolvedValue({ data: ME_BODY })
    const { store } = await freshStore()
    await store.rehydrate()
    store.logout()
    expect(await store.rehydrate()).toBe('no-token')
    expect(getAdminInfoRawMock).toHaveBeenCalledTimes(1)
    expect(store.adminInfo).toBeNull()
  })
})
