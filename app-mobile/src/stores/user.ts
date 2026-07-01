import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, type LoginParams, type LoginResult, type ProfileResult } from '@/api/modules/auth'
import { setToken, removeToken, setUser, removeUser, setTenant, removeTenant, getUser, getTenant } from '@/api/storage'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(uni.getStorageSync('merchant_token') || '')
  const user = ref<ProfileResult | null>(getUser())
  const tenant = ref(getTenant())
  const initialized = ref(false)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.roles?.includes('SUPER_ADMIN') ?? false)
  const storeId = computed(() => user.value?.storeId ?? null)
  const storeName = computed(() => user.value?.storeName ?? '')

  async function login(account: string, password: string) {
    const result = await authApi.login({ account, password })
    token.value = result.token
    setToken(result.token)

    user.value = {
      id: result.user.id,
      name: result.user.name,
      account: result.user.account,
      avatar: result.user.avatar,
      roles: result.user.roles,
      storeId: result.user.storeId,
      storeName: result.user.storeName
    }
    setUser(user.value)

    tenant.value = result.tenant
    setTenant(result.tenant)

    initialized.value = true
  }

  async function fetchProfile() {
    try {
      const profile = await authApi.getProfile()
      user.value = profile
      setUser(profile)
      initialized.value = true
    } catch (err) {
      // 如果 token 失效，执行登出
      logout()
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
    fetchProfile,
    init,
    logout
  }
})