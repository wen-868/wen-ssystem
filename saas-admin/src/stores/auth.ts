import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginApi, getAdminInfoApi, getAdminInfoRaw } from '../api/auth'

/**
 * 平台管理员身份（REHYDRATE-01）。
 * 后端 /platform/auth/me 现下发 { id, username, realName, mfaEnabled, csrfToken }；
 * role 为前端预留字段（后端 t_platform_admin.role 已存在但暂未透出），缺省时
 * 身份文案只显示姓名，绝不虚构「超级管理员」尾缀。
 */
export interface PlatformAdminInfo {
  id: number
  username: string
  realName: string
  mfaEnabled?: boolean
  role?: string
}

/** 角色码 → 展示名（枚举见 backend middleware/platform-rbac.ts：全通 {PLATFORM_SUPER_ADMIN, SUPER_ADMIN}，普通 PLATFORM_ADMIN） */
const PLATFORM_ROLE_LABELS: Record<string, string> = {
  PLATFORM_SUPER_ADMIN: '超级管理员',
  SUPER_ADMIN: '超级管理员',
  PLATFORM_ADMIN: '平台管理员',
  PLATFORM_SUPPORT: '平台支持',
}

/**
 * 顶栏身份文案（REHYDRATE-01，修复 PlatformLayout 硬编码「· 超级管理员」的伪造身份问题）：
 * 真实姓名 + 真实角色；角色缺失时只显示姓名。
 */
export function platformUserLabel(info: PlatformAdminInfo | null): string {
  if (!info) return '未登录'
  const name = info.realName || info.username
  const roleLabel = info.role ? PLATFORM_ROLE_LABELS[info.role] : undefined
  return roleLabel ? `${name} · ${roleLabel}` : name
}

/** 会话恢复结果（REHYDRATE-01） */
export type RehydrateResult = 'ok' | 'no-token' | 'expired' | 'network-error'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('platform_token') || '')
  // CSRF 防护令牌：后端登录/ME 接口下发，写操作需注入 x-csrf-token header
  const csrfToken = ref(localStorage.getItem('platform_csrf_token') || '')
  const adminInfo = ref<PlatformAdminInfo | null>(null)
  /** 恢复进行中标记：供顶栏显示「身份恢复中…」，避免误显示「未登录」 */
  const rehydrating = ref(false)

  // single-flight：并发恢复只发一次 /auth/me（REHYDRATE-01 防重复请求）
  let rehydrateInflight: Promise<RehydrateResult> | null = null

  async function login(username: string, password: string, captchaId: string, captcha: string) {
    const res = await loginApi({ username, password, captchaId, captcha })
    token.value = res.data.token
    localStorage.setItem('platform_token', res.data.token)
    // 登录接口下发 csrfToken，持久化以供后续写操作注入
    const loginCsrfToken = (res.data as any)?.csrfToken
    if (loginCsrfToken) {
      csrfToken.value = loginCsrfToken
      localStorage.setItem('platform_csrf_token', loginCsrfToken)
    }
    try {
      await fetchAdminInfo()
    } catch {
      // me 失败不阻断登录（REHYDRATE-01）：token 已落盘，守卫会在下次导航 rehydrate 补拉
    }
  }

  /** /me 返回数据落库 + 同步下发的 csrfToken（登录与恢复两条链路共用） */
  function applyMeData(data: PlatformAdminInfo) {
    adminInfo.value = data
    const meCsrfToken = (data as any)?.csrfToken
    if (meCsrfToken) {
      csrfToken.value = meCsrfToken
      localStorage.setItem('platform_csrf_token', meCsrfToken)
    }
  }

  async function fetchAdminInfo() {
    try {
      const res = await getAdminInfoApi()
      applyMeData(res.data)
    } catch (err: any) {
      // 401 = 后端明确判定身份无效 ⇒ fail-closed 清会话（REHYDRATE-01）；
      // 其他错误（网络失败/5xx/超时）不清 token —— 网络抖动 ≠ 身份无效。
      if (err?.response?.status === 401) logout()
      throw err
    }
  }

  /**
   * 会话恢复（REHYDRATE-01）：token 有效但 adminInfo 为空时（刷新页面/重开浏览器）恢复身份。
   * - 成功 → 'ok'，adminInfo 填充；
   * - 401 → fail-closed：清会话返回 'expired'（守卫跳登录页）；
   * - 网络失败 → 'network-error'：保留 token 可重试（清 token 会把一次抖动变成强制登出）；
   * - single-flight：并发调用复用进行中的请求，保证一次恢复只发一个 /auth/me；
   * - 走 getAdminInfoRaw 绕过统一实例拦截器，避免其 401 自动登出/跳转与守卫 async 流程竞争。
   */
  async function rehydrate(force = false): Promise<RehydrateResult> {
    if (!force && adminInfo.value) return 'ok'
    if (!token.value) return 'no-token'
    if (rehydrateInflight) return rehydrateInflight
    rehydrating.value = true
    rehydrateInflight = (async () => {
      try {
        const resp = await getAdminInfoRaw(token.value)
        if (resp.data?.code === '0' && resp.data?.data) {
          applyMeData(resp.data.data)
          return 'ok'
        }
        // 后端返回业务失败：无法确认身份 ⇒ fail-closed
        logout()
        return 'expired'
      } catch (err: any) {
        if (err?.response?.status === 401) {
          logout()
          return 'expired'
        }
        return 'network-error'
      } finally {
        rehydrating.value = false
        rehydrateInflight = null
      }
    })()
    return rehydrateInflight
  }

  function logout() {
    token.value = ''
    csrfToken.value = ''
    adminInfo.value = null
    localStorage.removeItem('platform_token')
    localStorage.removeItem('platform_csrf_token')
  }

  return { token, csrfToken, adminInfo, rehydrating, login, fetchAdminInfo, rehydrate, logout }
})
