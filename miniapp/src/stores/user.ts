import { defineStore } from 'pinia'
import { ref } from 'vue'
import Taro from '@tarojs/taro'

export interface UserInfo {
  id: number
  nickname: string
  avatar: string
  phone: string
  points: number
  level: string
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>('')
  // S3-196（总清单第 58 项）：后端消费者端写端点校验 x-csrf-token，令牌随登录响应下发
  // （客户端无法自行计算 HMAC），故与 token 一起保存/清理，并由 api/request.ts 统一携带。
  const csrfToken = ref<string>('')
  const userInfo = ref<UserInfo | null>(null)
  const isLogin = ref(false)

  const login = (newToken: string, info: UserInfo, newCsrfToken = '') => {
    token.value = newToken
    csrfToken.value = newCsrfToken
    userInfo.value = info
    isLogin.value = true
    Taro.setStorageSync('token', newToken)
    Taro.setStorageSync('csrfToken', newCsrfToken)
    Taro.setStorageSync('userInfo', JSON.stringify(info))
  }

  const logout = () => {
    token.value = ''
    csrfToken.value = ''
    userInfo.value = null
    isLogin.value = false
    Taro.removeStorageSync('token')
    Taro.removeStorageSync('csrfToken')
    Taro.removeStorageSync('userInfo')
  }

  const loadFromStorage = () => {
    try {
      const savedToken = Taro.getStorageSync('token')
      const savedCsrfToken = Taro.getStorageSync('csrfToken')
      const savedUserInfo = Taro.getStorageSync('userInfo')
      if (savedToken && savedUserInfo) {
        token.value = savedToken
        csrfToken.value = savedCsrfToken || ''
        userInfo.value = JSON.parse(savedUserInfo)
        isLogin.value = true
      }
    } catch (error) {
      console.error('Failed to load user from storage:', error)
      logout()
    }
  }

  const updateUserInfo = (info: Partial<UserInfo>) => {
    if (userInfo.value) {
      userInfo.value = { ...userInfo.value, ...info }
      Taro.setStorageSync('userInfo', JSON.stringify(userInfo.value))
    }
  }

  return {
    token,
    csrfToken,
    userInfo,
    isLogin,
    login,
    logout,
    loadFromStorage,
    updateUserInfo
  }
})
