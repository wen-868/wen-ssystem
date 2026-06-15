import axios from 'axios'
import { showToast } from 'vant'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('merchant_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('merchant_token')
      window.dispatchEvent(new Event('auth:logout'))
      showToast('登录已过期，请重新登录')
    }
    return Promise.reject(error)
  }
)
