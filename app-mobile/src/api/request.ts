/**
 * uni-app 网络请求适配层
 * 封装 uni.request，提供统一拦截、Token注入、错误处理
 */

// #ifdef H5
const BASE_URL = import.meta.env.VITE_API_BASE || '/api'
// #endif
// #ifndef H5
const BASE_URL = 'https://api.zhixiang-chain.com'
// #endif

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  timeout?: number
}

interface RequestResponse<T = any> {
  code: string
  msg: string
  data: T
  traceId: string
  apiCost: number
}

function getToken(): string {
  return uni.getStorageSync('merchant_token') || ''
}

function getTenantId(): string {
  return uni.getStorageSync('merchant_tenant_id') || ''
}

export async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, timeout = 30000 } = options

  const token = getToken()
  const tenantId = getTenantId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...header
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: headers,
      timeout,
      success: (res: any) => {
        const { statusCode, data: resData } = res

        // 401: 未认证，清除登录态并跳转登录页
        if (statusCode === 401) {
          uni.removeStorageSync('merchant_token')
          uni.removeStorageSync('merchant_user')
          uni.removeStorageSync('merchant_tenant_id')
          uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
          uni.reLaunch({ url: '/pages/login/login' })
          reject(new Error('登录已过期，请重新登录'))
          return
        }

        // 403: 权限不足
        if (statusCode === 403) {
          const msg = resData?.msg || '权限不足，无法访问'
          uni.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
          return
        }

        // 404: 资源不存在
        if (statusCode === 404) {
          const msg = resData?.msg || '资源不存在'
          uni.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
          return
        }

        // 500: 服务器内部错误
        if (statusCode === 500) {
          const msg = resData?.msg || '服务器繁忙，请稍后重试'
          uni.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
          return
        }

        // 2xx: 成功
        if (statusCode >= 200 && statusCode < 300) {
          if (resData && typeof resData === 'object' && 'data' in resData) {
            resolve(resData.data as T)
          } else {
            resolve(resData as T)
          }
        } else {
          // 400 及其他错误
          const msg = resData?.msg || `请求失败 (${statusCode})`
          uni.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
        }
      },
      fail: (err: any) => {
        // 超时错误
        if (err.errMsg?.includes('timeout')) {
          uni.showToast({ title: '网络请求超时，请重试', icon: 'none' })
          reject(new Error('网络请求超时，请重试'))
        } else {
          // 网络错误
          uni.showToast({ title: '网络连接失败，请检查网络', icon: 'none' })
          reject(new Error('网络连接失败，请检查网络'))
        }
      }
    })
  })
}

export function get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  return request<T>({ url, method: 'GET', data: params })
}

export function post<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'POST', data })
}

export function put<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'PUT', data })
}

export function del<T = any>(url: string): Promise<T> {
  return request<T>({ url, method: 'DELETE' })
}

export function upload<T = any>(url: string, filePath: string, name = 'file', formData?: Record<string, any>): Promise<T> {
  const token = getToken()
  const tenantId = getTenantId()

  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenantId) headers['X-Tenant-Id'] = tenantId

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}${url}`,
      filePath,
      name,
      formData,
      header: headers,
      success: (res: any) => {
        try {
          const data = JSON.parse(res.data)
          if (data && 'data' in data) {
            resolve(data.data as T)
          } else {
            resolve(data as T)
          }
        } catch {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail: () => {
        reject(new Error('上传失败，请检查网络'))
      }
    })
  })
}