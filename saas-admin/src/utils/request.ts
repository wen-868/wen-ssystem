import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
// R101-S2-01 裁定 2：错误文案集中一处，与旧客户端 src/api.ts 共用同一份
import { isBizFailure, resolveBizErrorText, resolveHttpErrorText } from './http-error'

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
let lastReportTime = 0
/** 401 提示节流时间戳：并发请求同时 401 时只提示一次 */
let lastAuthTipTime = 0

function reportHttpError(payload: {
  error_type: string
  message: string
  url: string
  method: string
  status_code: number
}) {
  const now = Date.now()
  // 纯时间节流：1秒内最多上报1次，不依赖 fetch 完成状态
  if (now - lastReportTime < 1000) return
  lastReportTime = now
  fetch('/api/admin/error-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      source: 'saas-admin',
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => { })
}

request.interceptors.response.use(
  (response) => {
    const data = response.data
    // 业务码非 0：后端中文原因优先；后端未给中文则兜底，绝不直出英文原文
    if (isBizFailure(data)) {
      const text = resolveBizErrorText(data, '请求失败')
      ElMessage.error(text)
      return Promise.reject(new Error(text))
    }
    return data
  },
  (error) => {
    if (error.response?.status === 401) {
      // 401 的真实原因对运营有意义（登录页是「用户名或密码错误」，普通页面是「未登录」），
      // 不能静默踢走。先给中文提示再跳转；并发请求在 1.5s 内只提示一次，避免刷屏。
      if (Date.now() - lastAuthTipTime > 1500) {
        lastAuthTipTime = Date.now()
        ElMessage.error(resolveHttpErrorText(error))
      }
      const authStore = useAuthStore()
      authStore.logout()
      window.location.hash = '#/login'
      return Promise.reject(error)
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

    // 统一中文文案：覆盖 4xx/5xx/超时/断网，禁止 axios 英文原文上屏
    ElMessage.error(resolveHttpErrorText(error))
    return Promise.reject(error)
  }
)

export default request