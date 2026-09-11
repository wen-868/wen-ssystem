import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, type LoginParams, type LoginResult, type ProfileResult } from '@/api/modules/auth'
import {
  setToken, removeToken,
  setUser, removeUser,
  setTenant, removeTenant,
  getUser, getTenant,
  setCsrfToken, removeCsrfToken
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

  async function login(username: string, password: string) {
    const result = await authApi.login({ username, password })
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

  function logout() {
    token.value = ''
    user.value = null
    tenant.value = null
    initialized.value = false
    removeToken()
    removeUser()
    removeTenant()
    removeCsrfToken()
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
