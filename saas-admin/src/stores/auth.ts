import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginApi, getAdminInfoApi } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('platform_token') || '')
  // CSRF 防护令牌：后端登录/ME 接口下发，写操作需注入 x-csrf-token header
  const csrfToken = ref(localStorage.getItem('platform_csrf_token') || '')
  const adminInfo = ref<{ id: number; username: string; realName: string } | null>(null)

  async function login(username: string, password: string) {
    const res = await loginApi({ username, password })
    token.value = res.data.token
    localStorage.setItem('platform_token', res.data.token)
    // 登录接口下发 csrfToken，持久化以供后续写操作注入
    const loginCsrfToken = (res.data as any)?.csrfToken
    if (loginCsrfToken) {
      csrfToken.value = loginCsrfToken
      localStorage.setItem('platform_csrf_token', loginCsrfToken)
    }
    await fetchAdminInfo()
  }

  async function fetchAdminInfo() {
    try {
      const res = await getAdminInfoApi()
      adminInfo.value = res.data
      // /me 接口也会下发 csrfToken，刷新页面后同步最新 token
      const meCsrfToken = (res.data as any)?.csrfToken
      if (meCsrfToken) {
        csrfToken.value = meCsrfToken
        localStorage.setItem('platform_csrf_token', meCsrfToken)
      }
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = ''
    csrfToken.value = ''
    adminInfo.value = null
    localStorage.removeItem('platform_token')
    localStorage.removeItem('platform_csrf_token')
  }

  return { token, csrfToken, adminInfo, login, fetchAdminInfo, logout }
})