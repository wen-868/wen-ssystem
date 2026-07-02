import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginApi, getAdminInfoApi } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('platform_token') || '')
  const adminInfo = ref<{ id: number; username: string; realName: string } | null>(null)

  async function login(username: string, password: string) {
    const res = await loginApi({ username, password })
    token.value = res.data.token
    localStorage.setItem('platform_token', res.data.token)
    await fetchAdminInfo()
  }

  async function fetchAdminInfo() {
    try {
      const res = await getAdminInfoApi()
      adminInfo.value = res.data
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = ''
    adminInfo.value = null
    localStorage.removeItem('platform_token')
  }

  return { token, adminInfo, login, fetchAdminInfo, logout }
})