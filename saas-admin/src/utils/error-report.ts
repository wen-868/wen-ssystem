import { useAuthStore } from '../stores/auth'

/**
 * S3-179 ②：平台端前端错误上报（打「同端」端点）
 *
 * 背景：saas-admin 的 `main.ts`（Vue/全局错误）与 `utils/request.ts`（HTTP 错误）此前都打
 * `/api/admin/error-report` —— 那是**商家端**鉴权端点（requireAuthWithTenant），平台总后台只有平台令牌
 * ⇒ 恒 401，且原实现 `.catch(() => {})` 把失败一并吞掉 ⇒ 平台端线上错误一条都没上报成功（排障少一只眼睛）。
 *
 * 现在：打平台端自己的 `/api/platform/error-report`（requirePlatformAuth + CSRF），
 * 并带上平台令牌与 x-csrf-token；**失败不再静默** —— 至少 console.warn 出 HTTP 状态与原文。
 *
 * 只做这一件事：调用方各自保留自己的节流（main.ts 1s + 并发标记、request.ts 1s），本函数不重复节流。
 */
export interface FrontendErrorPayload {
  error_type: string
  message: string
  stack?: string
  url?: string
  method?: string
  status_code?: number
}

/** 上报平台端前端错误；返回值可用于 `.finally()`（内部已吞异常并告警，永不 reject） */
export function reportPlatformError(payload: FrontendErrorPayload): Promise<void> {
  const body = {
    ...payload,
    source: 'saas-admin',
    timestamp: new Date().toISOString(),
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    // pinia 未就绪（应用极早期错误）时会抛错 ⇒ 不带凭据上报，服务端 401 由下方状态告警兜住
    const authStore = useAuthStore()
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
    if (authStore.csrfToken) headers['x-csrf-token'] = authStore.csrfToken
  } catch {
    /* 无可用登录态：继续上报，失败会在下面 console.warn */
  }

  return fetch('/api/platform/error-report', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(`[error-report] 上报失败：HTTP ${res.status}`, body)
      }
    })
    .catch((err) => {
      console.warn('[error-report] 上报失败：', err, body)
    })
}
