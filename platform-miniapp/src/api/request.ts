import Taro from '@tarojs/taro'

// API 地址由构建期环境变量注入（TARO_APP_API_BASE），源码不写死域名
const BASE_URL = process.env.TARO_APP_API_BASE || ''

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
  timeout?: number
}

// 后端统一返回体：{ code: "0", msg, data, traceId, apiCost }
interface ApiResponse<T = unknown> {
  code: string | number
  msg?: string
  message?: string
  data: T
}

const request = async <T = unknown>(options: RequestOptions): Promise<T> => {
  const { url, method = 'GET', data = {}, header = {}, timeout = 30000 } = options

  const defaultHeader: Record<string, string> = {
    'Content-Type': 'application/json'
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

    if (statusCode >= 200 && statusCode < 300) {
      const { code, msg, message, data: result } = responseData
      const messageText = msg || message || '请求失败'
      if (code === 0 || code === '0') {
        return result
      }
      Taro.showToast({ title: messageText, icon: 'none' })
      throw new Error(messageText)
    }

    Taro.showToast({ title: `请求失败 ${statusCode}`, icon: 'none' })
    throw new Error(`HTTP ${statusCode}`)
  } catch (error) {
    console.error('Request error:', error)
    throw error
  }
}

const get = <T = unknown>(url: string, params?: Record<string, unknown>): Promise<T> => {
  return request<T>({ url, method: 'GET', data: params })
}

const post = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<T> => {
  return request<T>({ url, method: 'POST', data })
}

export { request, get, post }
