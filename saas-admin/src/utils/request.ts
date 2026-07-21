import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  // CSRF 防护：写操作需注入 x-csrf-token header（后端登录/ME 接口下发，存于 authStore.csrfToken）
  if (authStore.csrfToken) {
    config.headers['x-csrf-token'] = authStore.csrfToken
  }
  return config
})

// ==================== HTTP 错误上报 ====================
let isReportingError = false
let lastReportTime = 0

function reportHttpError(payload: {
  error_type: string
  message: string
  url: string
  method: string
  status_code: number
}) {
  const now = Date.now()
  if (isReportingError || now - lastReportTime < 1000) return
  isReportingError = true
  lastReportTime = now
  fetch('/api/admin/error-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      source: 'saas-admin',
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => { }).finally(() => {
    isReportingError = false
  })
}

request.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data.code && data.code !== '0' && data.code !== 0) {
      ElMessage.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      window.location.hash = '#/login'
    }

    // 上报 HTTP 错误（状态码 >= 400）
    if (error.response && error.response.status >= 400) {
      reportHttpError({
        error_type: 'http_error',
        message: error.message || '网络请求失败',
        url: error.config?.url || '',
        method: error.config?.method?.toUpperCase() || 'GET',
        status_code: error.response.status,
      })
    }

    ElMessage.error(error.message || '网络错误')
    return Promise.reject(error)
  }
)

export default request