/**
 * QODER-1 门 3 · 测试③ API 基址解析（`src/config/env.ts`）：
 *  · 设置了 VITE_API_BASE ⇒ 必须原样采用；
 *  · **未设置** ⇒ 只能落到"可判定"的兜底：H5 走相对路径 `/api`（开发代理），
 *    App 走**具名占位域名**（文件头明示不得硬编码真实生产域名）；
 *  · 解析结果为空/非法（不以 `/` 开头、或不是合法绝对 URL）⇒ **即失败**（本用例抛红并点名）。
 * 反测面：把兜底改成空串、或把 H5 兜底改成绝对域名等口径漂移 ⇒ 本用例必红。
 * ⚠️ 口径说明见回传卡 §七（任务书"环境变量缺失即失败"的落地解释）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

async function loadEnvModule() {
  vi.resetModules()
  return import('../src/config/env')
}

function assertUsableBase(label: string, base: string) {
  if (!base || typeof base !== 'string') {
    throw new Error(`API 基址缺失：${label} 解析为空 ⇒ 失败关闭（禁止空基址发请求）`)
  }
  const isRelative = base.startsWith('/')
  const isAbsolute = /^https?:\/\/[^\s]+$/.test(base)
  if (!isRelative && !isAbsolute) {
    throw new Error(`API 基址非法：${label} = ${JSON.stringify(base)}（既不是以 / 开头的相对路径，也不是 http(s) 绝对地址）`)
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('API 基址解析（VITE_API_BASE）', () => {
  it('设置了 VITE_API_BASE ⇒ H5 与 App 均原样采用', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://127.0.0.1:8080/api')
    const m = await loadEnvModule()
    expect(m.API_BASE_H5).toBe('http://127.0.0.1:8080/api')
    expect(m.API_BASE_NATIVE).toBe('http://127.0.0.1:8080/api')
    assertUsableBase('API_BASE_H5', m.API_BASE_H5)
    assertUsableBase('API_BASE_NATIVE', m.API_BASE_NATIVE)
  })

  it('环境变量缺失 ⇒ H5 兜底必须是相对 /api（走代理，不得静默指到某域名）', async () => {
    vi.stubEnv('VITE_API_BASE', undefined)
    const m = await loadEnvModule()
    expect(m.API_BASE_H5).toBe('/api')
    assertUsableBase('API_BASE_H5', m.API_BASE_H5)
    assertUsableBase('API_BASE_NATIVE', m.API_BASE_NATIVE)
  })

  it('基址解析为空 ⇒ 判据即失败（抛错点名，不允许空基址继续跑）', () => {
    expect(() => assertUsableBase('API_BASE_H5', '')).toThrow(/缺失/)
    expect(() => assertUsableBase('API_BASE_NATIVE', 'not-a-url')).toThrow(/非法/)
  })
})
