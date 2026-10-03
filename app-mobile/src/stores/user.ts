import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, type LoginParams, type LoginResult, type ProfileResult } from '@/api/modules/auth'
import {
  setToken, removeToken,
  setUser, removeUser,
  setTenant, removeTenant,
  getUser, getTenant,
  setCsrfToken, removeCsrfToken,
  clearSavedCredentials, setRememberMe
} from '@/api/storage'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(uni.getStorageSync('merchant_token') || '')
  const user = ref<ProfileResult | null>(getUser())
  const tenant = ref(getTenant())
  const initialized = ref(false)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.roles?.includes('SUPER_ADMIN') ?? false)
  const storeId = computed(() => user.value?.storeId ?? null)
  const storeName = computed(() => user.value?.realName ?? '')

  /**
   * 登录
   * @param rememberMe 「记住我」：透传后端（S3-160 ⇒ 30 天长效 token），缺省 false 维持 4h
   */
  async function login(username: string, password: string, rememberMe: boolean = false) {
    const result = await authApi.login({ username, password, rememberMe })
    applyLoginResult(result)
  }

  /** 应用登录结果（正常登录 / MFA 二次验证共用） */
  function applyLoginResult(result: LoginResult) {
    token.value = result.token
    setToken(result.token)

    // 存储 CSRF 令牌（后端 R52-01 登录接口下发，写操作需注入 x-csrf-token header）
    if (result.csrfToken) {
      setCsrfToken(result.csrfToken)
    }

    user.value = {
      id: result.user.id,
      username: result.user.username,
      realName: result.user.realName,
      avatar: result.user.avatar,
      roles: result.user.roles,
      storeId: result.user.storeId,
      tenantId: result.user.tenantId,
      csrfToken: result.csrfToken
    }
    setUser(user.value)

    // 从登录结果构造 tenant 信息
    // R102-06：tenantId 是 UUID 字符串，原先 Number(...)||0 会得到 NaN→0，
    // 并把 merchant_tenant_id 落库为 "0"、请求头下发 X-Tenant-Id: 0（与 R96-07 缓存键 NaN 同源）。
    // 直接保留字符串 UUID。
    if (result.user.tenantId) {
      tenant.value = { id: result.user.tenantId, name: '', code: result.user.tenantId }
      setTenant(tenant.value)
    }

    initialized.value = true
  }

  async function fetchProfile() {
    try {
      const profile = await authApi.getProfile()
      user.value = profile
      setUser(profile)
      // 如果 profile 返回 csrfToken，同步更新加密存储（供刷新页面后恢复）
      if (profile.csrfToken) {
        setCsrfToken(profile.csrfToken)
      }
      initialized.value = true
    } catch (err: any) {
      // 仅后端确认 401（token 真失效）才登出。
      // 限流 429 / 网络抖动 / 超时等错误不能误判为登录过期，否则会被反复踢回登录页。
      const msg = String(err?.message || '')
      if (msg.includes('登录已过期') || msg.includes('登录已失效') || msg.includes('未登录')) {
        logout()
      }
      throw err
    }
  }

  async function init() {
    if (token.value && !initialized.value) {
      await fetchProfile()
    }
  }

  /**
   * 退出登录 ＝ **退出凭证的唯一出口**（S3-162 口径，覆盖 S3-161 的「按勾选态决定」）
   *
   * 业主当轮口径：退出帐号即退出凭证。因此**无论「记住我」是否勾选**：
   *   ① 始终清 token / 用户态 / 租户 / CSRF；
   *   ② **无条件**清掉本机已记住的账号与口令；
   *   ③ 把「记住我」勾选态**复位为默认（勾选）并落盘**，
   *      使下次打开登录页是「干净的默认态」而非上一次的残留选择。
   *
   * 「记住我」的语义因此收窄为：**只表示"登录时把账号口令记在本机、下次自动带出"**，
   * 不再表示"勾了就不用再登录"（会话长度由后端签发策略决定）。
   */
  function logout() {
    token.value = ''
    user.value = null
    tenant.value = null
    initialized.value = false
    removeToken()
    removeUser()
    removeTenant()
    removeCsrfToken()
    // ② 无条件清已记住的账号口令（与勾选态无关）
    clearSavedCredentials()
    // ③ 勾选态复位为默认（勾选）并落盘
    setRememberMe(true)
    uni.reLaunch({ url: '/pages/login/login' })
  }

  return {
    token,
    user,
    tenant,
    initialized,
    isLoggedIn,
    isAdmin,
    storeId,
    storeName,
    login,
    applyLoginResult,
    fetchProfile,
    init,
    logout
  }
})
