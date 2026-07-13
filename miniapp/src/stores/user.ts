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
  const userInfo = ref<UserInfo | null>(null)
  const isLogin = ref(false)

  const login = (newToken: string, info: UserInfo) => {
    token.value = newToken
    userInfo.value = info
    isLogin.value = true
    Taro.setStorageSync('token', newToken)
    Taro.setStorageSync('userInfo', JSON.stringify(info))
  }

  const logout = () => {
    token.value = ''
    userInfo.value = null
    isLogin.value = false
    Taro.removeStorageSync('token')
    Taro.removeStorageSync('userInfo')
  }

  const loadFromStorage = () => {
    try {
      const savedToken = Taro.getStorageSync('token')
      const savedUserInfo = Taro.getStorageSync('userInfo')
      if (savedToken && savedUserInfo) {
        token.value = savedToken
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
    userInfo,
    isLogin,
    login,
    logout,
    loadFromStorage,
    updateUserInfo
  }
})
