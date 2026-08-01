import Taro from '@tarojs/taro'
import { useUserStore } from '@/stores/user'

// API 地址由构建期环境变量注入（TARO_APP_API_BASE），源码不写死域名
const BASE_URL = process.env.TARO_APP_API_BASE || ''

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
  timeout?: number
}

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

const request = async <T = unknown>(options: RequestOptions): Promise<T> => {
  const { url, method = 'GET', data = {}, header = {}, timeout = 30000 } = options

  const userStore = useUserStore()
  const token = userStore.token

  const defaultHeader: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }

  try {
    const response = await Taro.request<ApiResponse<T>>({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: { ...defaultHeader, ...header },
      timeout
    })

    const { statusCode, data: responseData } = response

    if (statusCode === 200) {
      const { code, message, data: result } = responseData

      if (code === 0) {
        return result
      } else if (code === 401) {
        userStore.logout()
        Taro.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
        setTimeout(() => {
          Taro.navigateTo({ url: '/pages/login/index' })
        }, 1500)
        throw new Error(message || '登录已过期')
      } else {
        Taro.showToast({ title: message || '请求失败', icon: 'none' })
        throw new Error(message || '请求失败')
      }
    } else {
      Taro.showToast({ title: `请求失败 ${statusCode}`, icon: 'none' })
      throw new Error(`HTTP ${statusCode}`)
    }
  } catch (error) {
    console.error('Request error:', error)
    if (!(error instanceof Error) || !error.message.includes('登录已过期')) {
      Taro.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    }
    throw error
  }
}

const get = <T = unknown>(url: string, params?: Record<string, unknown>): Promise<T> => {
  return request<T>({ url, method: 'GET', data: params })
}

const post = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> => {
  return request<T>({ url, method: 'POST', data })
}

const put = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> => {
  return request<T>({ url, method: 'PUT', data })
}

const del = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> => {
  return request<T>({ url, method: 'DELETE', data })
}

export { request, get, post, put, del }
