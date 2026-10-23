/**
 * uni-app 网络请求适配层
 * 封装 uni.request，提供统一拦截、Token注入、错误处理
 */

import { API_BASE_H5, API_BASE_NATIVE } from '../config/env'

// uni-app 条件编译：H5 使用 Vite 环境变量（默认 /api 代理），其他平台（App）使用生产 API 域名
// 使用 IIFE 包裹避免 vue-tsc 误报重复声明（uni-app 编译器会按平台去除无用分支）
const BASE_URL: string = (() => {
  // #ifdef H5
  return API_BASE_H5
  // #endif
  // #ifndef H5
  // APP 端必须带 /api 路径前缀（nginx 仅反代 /api/* 到后端），否则所有请求 404 导致无法登录
  return API_BASE_NATIVE
  // #endif
})()

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  timeout?: number
  responseType?: 'text' | 'json' | 'arraybuffer' | 'blob'
  /** 静默失败：出错不弹 toast、不跳转，仅 reject（用于非关键/兜底请求） */
  silent?: boolean
  /** 内部标记：401 防误杀重试，只重试一次 */
  _retried401?: boolean
}

interface RequestResponse<T = any> {
  code: string
  msg: string
  data: T
  traceId: string
}

/**
 * 业务成功码（唯一判定值）
 *
 * 依据后端唯一真相源 `backend/src/shared/response.ts`：`ok()` 固定下发字符串 `code: "0"`，
 * `fail(msg, code="400")` 及其业务码（400/401/403/404/500、1001~2xxx）均非 `"0"`。
 * 项目标准 `docs/项目统一标准.md` 第三章 3.1 亦规定 `"0"=成功，非 0=错误`。
 * 故成功码集合不臆测、不自造，就是这一条 `"0"`（用 String() 归一，兼容个别接口族回数字 0）。
 * ★ QODER-29 MO-11：HTTP 2xx 但业务码非成功码，必须走错误分支，不得当成功数据返回。
 */
const BUSINESS_SUCCESS_CODE = '0'

/** 并发 401 去重锁
 *
 * token 失效时，首屏往往有多个请求同时返回 401。若每个都独立执行
 * 清存储 + toast + reLaunch，会造成重复弹窗与多次重定位（页面闪烁、登录页入栈多次）。
 * 这里只让首个 401 执行跳转动作，其余仅 reject。
 */
let unauthorizedHandling = false

function getToken(): string {
  return uni.getStorageSync('merchant_token') || ''
}

function getTenantId(): string {
  return uni.getStorageSync('merchant_tenant_id') || ''
}

function getCsrfToken(): string {
  // 走 storage.ts 拦截器：'merchant_csrf_token' 已加入 SENSITIVE_KEYS，自动解密返回
  return uni.getStorageSync('merchant_csrf_token') || ''
}

/**
 * 统一安全三头写入（★ QODER-29 MO-29：鉴权 / 租户头 / CSRF 的唯一出处）
 *
 * `buildJsonHeaders()` 与 `buildSecureHeaders()` 都复用本函数产出安全头，
 * 不得在别处再逐行 `getStorageSync('merchant_token')` 自行拼装
 * （公共逻辑只写一次，项目标准核心原则 3）。缺任一登录态时对应头自然省略，与旧行为一致。
 *
 * ★ MOBILE-29F1：安全头在 extra 之后写入，优先级最高（不可被调用方顶掉）。
 */
function writeSecureHeaders(headers: Record<string, string>): void {
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const tenantId = getTenantId()
  if (tenantId) headers['X-Tenant-Id'] = tenantId
  const csrfToken = getCsrfToken()
  if (csrfToken) headers['x-csrf-token'] = csrfToken
}

/**
 * JSON 请求头构建器（★ MOBILE-29F1：与安全头构建器拆分，专用于 JSON 请求体场景）
 *
 * 只用于请求体为 JSON 的场景：统一入口 `request()` 与 AI 底座的 fetch / uni.request。
 * 产出 `Content-Type: application/json` + 安全三头。
 *
 * ⚠️ 绝不用于 `uni.uploadFile` / `uni.downloadFile`：multipart 的 boundary 必须由
 * uni / 微信 / 浏览器自行生成，前端下发 `application/json` 会直接破坏 multipipart
 * （QODER-29 驳回根因）。那两个场景只能用 `buildSecureHeaders()`。
 *
 * @param extra 调用方自定义头；安全头在其后写入，优先级最高。
 */
export function buildJsonHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra || {})
  }
  writeSecureHeaders(headers)
  return headers
}

/**
 * 安全头构建器（★ MOBILE-29F1：只含安全三头，绝不含 Content-Type）
 *
 * 只用于"确需直接调用"的 `uni.uploadFile`（multipart 表单）与 `uni.downloadFile`
 * （二进制流）：这两种场景的 Content-Type / boundary 由 uni / 微信 / 浏览器自行生成，
 * 前端任何形式的 Content-Type 下发都会破坏请求（QODER-29 驳回根因）。
 *
 * 产出且仅产出 Authorization / X-Tenant-Id / x-csrf-token（+ 调用方 extra，
 * 如 Accept）；缺登录态时对应头自然省略，与旧行为一致。
 *
 * @param extra 调用方自定义头（不得含 Content-Type）；安全头在其后写入，优先级最高。
 */
export function buildSecureHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) }
  writeSecureHeaders(headers)
  return headers
}

export async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, timeout = 30000, responseType, silent = false } = options

  // 统一 JSON 请求头：Content-Type + Authorization / X-Tenant-Id / x-csrf-token 全部走同一构建器（★ QODER-29 MO-29 / ★ MOBILE-29F1）
  const headers = buildJsonHeaders(header)

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: headers,
      timeout,
      responseType,
      success: (res: any) => {
        const { statusCode, data: resData } = res

        // 401: 未认证，清除登录态并跳转登录页
        if (statusCode === 401) {
          // 防误杀：本地仍能读到 token 时先静默重试一次。
          // 页面刷新后的最初几百毫秒内，存储读取链路偶发返回空（时序问题），
          // 导致本应带 token 的请求裸奔 401；重试时读取已恢复，可直接成功。
          // ★ QODER-14：静默重试只对幂等的 GET 开放。POST/PUT/DELETE 的首请求可能已经在
          // 后端落库（网络抖动后才收到 401），原样重放 ⇒ 重复开单 / 重复扣减等不可逆副作用，
          // 因此非 GET 首次 401 一律走下面的清态 + 提示 + 跳登录，由用户重新发起。
          // method 缺省按 GET 处理（uni.request 默认即 GET），并统一大写比较避免 'get' 漏判。
          const retryToken = getToken()
          const retryMethod = String(options.method || 'GET').toUpperCase()
          if (retryToken && retryMethod === 'GET' && !(options as any)._retried401) {
            request({ ...options, _retried401: true } as RequestOptions)
              .then(resolve)
              .catch(reject)
            return
          }
          uni.removeStorageSync('merchant_token')
          uni.removeStorageSync('merchant_user')
          // ★ QODER-14F1：merchant_tenant 与 merchant_tenant_id 是 storage.ts SENSITIVE_KEYS 里
          // 两个**不同**的敏感键（TENANT / TENANT_ID，见 storage.ts:75-80）：setTenant() 会同时写
          // 这两个键（storage.ts:319-322），此前 401 只清 tenant_id ⇒ 重新登录前旧租户对象
          // （enc_merchant_tenant）仍可被读出，属登录态残留。本键同样在 SENSITIVE_KEYS 内，
          // uni.removeStorageSync 拦截器（storage.ts:196-203）会把这一条调用连带转成
          // removeSecureStorage（删加密镜像键 enc_merchant_tenant）+ 原始 removeStorageSync
          // （删历史明文残留），与其余四行完全同一套语义，因此一条即够，不补第二条删除。
          uni.removeStorageSync('merchant_tenant')
          uni.removeStorageSync('merchant_tenant_id')
          // ★ QODER-14：CSRF 令牌也是登录态的一部分，此前漏清会在重新登录前留下
          // 可用的旧写操作凭据。'merchant_csrf_token' 在 storage.ts 的 SENSITIVE_KEYS 里，
          // 拦截器会把这一条调用同时转成 removeSecureStorage（删加密镜像键
          // enc_merchant_csrf_token）+ 原始 removeStorageSync（删历史明文残留），
          // 与上面 token / user / tenant_id 三行走完全同一套语义，无需再补第二条删除。
          uni.removeStorageSync('merchant_csrf_token')
          if (!silent && !unauthorizedHandling) {
            // 并发去重：仅首个 401 弹提示并跳转，避免重复 reLaunch 与重复弹窗
            unauthorizedHandling = true
            uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
            uni.reLaunch({ url: '/pages/login/login' })
            // 跳转完成后释放锁，保证下次真正过期时仍能正常触发
            setTimeout(() => { unauthorizedHandling = false }, 1500)
          }
          reject(new Error('登录已过期，请重新登录'))
          return
        }

        // 403: 权限不足
        if (statusCode === 403) {
          const msg = resData?.msg || '权限不足，无法访问'
          if (!silent) uni.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
          return
        }

        // 404: 资源不存在
        if (statusCode === 404) {
          const msg = resData?.msg || '资源不存在'
          if (!silent) uni.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
          return
        }

        // 500: 服务器内部错误
        if (statusCode === 500) {
          const msg = resData?.msg || '服务器繁忙，请稍后重试'
          if (!silent) uni.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
          return
        }

        // 2xx: 成功
        if (statusCode >= 200 && statusCode < 300) {
          // ★ QODER-29 MO-11：HTTP 2xx 但业务码表示失败，必须走错误分支，不得当成功数据返回。
          // 只对"带 code 字段的响应信封"生效；不带 code 的裸响应维持原透传语义（不臆测成功码集合）。
          if (resData && typeof resData === 'object' && 'code' in resData) {
            if (String(resData.code) !== BUSINESS_SUCCESS_CODE) {
              const msg = resData.msg || `业务处理失败 (${String(resData.code)})`
              if (!silent) uni.showToast({ title: msg, icon: 'none' })
              reject(new Error(msg))
              return
            }
            // 业务码成功：信封带 data 则解包，否则透传（与旧行为逐字节一致）
            if ('data' in resData) {
              resolve(resData.data as T)
            } else {
              resolve(resData as T)
            }
            return
          }
          // 无响应信封（裸数组 / 裸对象）：维持原透传
          if (resData && typeof resData === 'object' && 'data' in resData) {
            resolve(resData.data as T)
          } else {
            resolve(resData as T)
          }
        } else {
          // 400 及其他错误
          const msg = resData?.msg || `请求失败 (${statusCode})`
          if (!silent) uni.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
        }
      },
      fail: (err: any) => {
        // 超时错误
        if (err.errMsg?.includes('timeout')) {
          if (!silent) uni.showToast({ title: '网络请求超时，请重试', icon: 'none' })
          reject(new Error('网络请求超时，请重试'))
        } else {
          // 网络错误
          if (!silent) uni.showToast({ title: '网络连接失败，请检查网络', icon: 'none' })
          reject(new Error('网络连接失败，请检查网络'))
        }
      }
    })
  })
}

export function get<T = any>(url: string, params?: Record<string, any>, options?: { responseType?: 'text' | 'json' | 'arraybuffer' | 'blob' }): Promise<T> {
  // 过滤空值参数：uni.request 会把 undefined/null/'' 序列化成 `key=` 空串，
  // 后端 Zod 枚举校验（如盘点列表 status）收到 '' 会直接 400 参数校验失败。
  // 缺参数与空字符串在后端语义一致（均为"不筛选"），故统一丢弃更安全。
  const cleanParams = params
    ? Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      )
    : params
  return request<T>({ url, method: 'GET', data: cleanParams, ...options })
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
