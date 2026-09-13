/**
 * HTTP 状态码 / 业务码 → 中文文案（全站唯一来源）
 *
 * 背景（R101-S2-01 凌舟裁定 2）：
 *  - 后端统一响应信封是 { code, msg, data, traceId }（backend/src/shared/response.ts），
 *    错误文案本身已是中文；但少数非 platform 控制器会直发 `message` 字段，
 *    因此取原因时 `msg` 优先、`message` 兜底，两者都兼容。
 *  - 前端原先在 axios 失败分支直出英文原文（如 "Request failed with status code 500"），
 *    运营与商户看不懂。本模块保证：英文原文一律不上屏。
 *
 * 使用方（两处共用同一份，禁止另写一套文案）：
 *  - src/utils/request.ts（新客户端，读 pinia 令牌）
 *  - src/api.ts（旧客户端，读 localStorage 令牌）
 */

/** HTTP 状态码 → 面向运营与商户的中文文案 */
export const HTTP_STATUS_TEXT: Record<number, string> = {
  400: '请求参数有误，请检查后重试',
  401: '登录状态已失效，请重新登录',
  403: '当前账号没有该操作权限',
  404: '请求的数据不存在或已被删除',
  405: '请求方式不被支持',
  408: '请求超时，请稍后重试',
  409: '数据存在冲突，请刷新后重试',
  413: '上传的内容过大',
  415: '不支持的数据格式',
  422: '提交的数据未通过校验，请检查后重试',
  429: '操作过于频繁，请稍后再试',
  500: '服务暂时不可用，请稍后重试',
  501: '该功能暂未开放',
  502: '服务网关异常，请稍后重试',
  503: '服务维护中，请稍后重试',
  504: '服务响应超时，请稍后重试',
}

/** 兜底文案（任何情况下都不会是英文） */
export const DEFAULT_ERROR_TEXT = '请求失败，请稍后重试'

const TIMEOUT_TEXT = '请求超时，请检查网络后重试'
const NETWORK_TEXT = '网络连接失败，请检查网络设置'

/** 纯 ASCII（即不含中文）判据：后端个别分支会漏出 'fail' 之类英文，不能上屏 */
const PURE_ASCII = /^[\x20-\x7E]+$/

/**
 * 从后端响应体里取中文原因。
 * 只认中文（或含中文）文案；纯英文返回空串，交由状态码文案兜底。
 */
export function pickBackendMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const d = data as Record<string, unknown>
  const raw =
    typeof d.msg === 'string' ? d.msg : typeof d.message === 'string' ? d.message : ''
  const text = raw.trim()
  if (!text) return ''
  return PURE_ASCII.test(text) ? '' : text
}

/**
 * 后端「成功」业务码白名单。
 *
 * 标准约定是 `ok()` 的 code = "0"（backend/src/shared/response.ts:4），
 * 但存量代码里存在不守约定的成功响应，若不认这些值就会被误判成失败、弹假报错：
 *  - "200"：services/admin/instant-retail.service.ts:259
 *           services/instant-retail/platform-integration.service.ts:55
 *           （同一函数 261/57 行的另一分支用的是 "0"/"1"，两处口径并存）
 *  - "SUCCESS"：services/admin/payment.service.ts:183（同时带 success: true）
 * 新增非 "0" 成功码时必须同步登记到此处，并注明来源文件行号。
 */
const SUCCESS_CODES = new Set<unknown>(['0', 0, '200', 200, 'SUCCESS'])

/**
 * 业务码是否被判为失败。
 * 判据与原新客户端逻辑一致（code 为空 / '0' / 0 视为成功），
 * 另补：显式 success:true 与白名单成功码一律视为成功，避免误报。
 */
export function isBizFailure(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  // 显式 success: true —— 后端个别接口以此为准（如 payment.service.ts:183）
  if (d.success === true) return false
  const code = d.code
  if (code === undefined || code === null || code === '') return false
  if (SUCCESS_CODES.has(code)) return false
  return true
}

/** 业务码非 0 时的展示文案：优先后端中文原因，没有则兜底 */
export function resolveBizErrorText(
  data: unknown,
  fallback: string = DEFAULT_ERROR_TEXT
): string {
  return pickBackendMessage(data) || fallback
}

/**
 * 解析 axios 异常 → 中文文案。
 * 顺序：超时 → 断网（无响应）→ 后端中文原因 → 状态码映射 → 兜底。
 */
export function resolveHttpErrorText(
  error: unknown,
  fallback: string = DEFAULT_ERROR_TEXT
): string {
  const e = (error || {}) as {
    response?: { status?: number; data?: unknown }
    code?: string
    message?: string
  }

  // 1) 超时：axios timeout 或底层 ETIMEDOUT
  if (
    e.code === 'ECONNABORTED' ||
    e.code === 'ETIMEDOUT' ||
    /timeout/i.test(e.message || '')
  ) {
    return TIMEOUT_TEXT
  }

  const status = e.response?.status

  // 2) 完全没有响应 = 断网 / 服务不可达
  if (!status) return NETWORK_TEXT

  // 3) 有响应：优先后端中文原因，其次状态码文案
  return (
    pickBackendMessage(e.response?.data) ||
    HTTP_STATUS_TEXT[status] ||
    `${fallback}（${status}）`
  )
}
