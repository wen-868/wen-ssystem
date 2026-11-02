/**
 * 页面反馈域契约（TOTAL-PLATFORM-UI-FEEDBACK-POLISH-01）
 *
 * 目标：统一总台八页（运营大盘/租户管理/租户详情/套餐管理/账单计费/
 * 监控告警/日志中心/工单系统）的 loading / empty / timeout / offline /
 * HTTP 500 / forbidden / recovered 反馈，使操作者能区分
 * 「没数据」「加载失败」「仍在处理」「需要重试」。
 *
 * 设计约束（卡面红线）：
 *  - 失败态不得与空态同形（phase 'error' 与 'empty' 是不同状态）；
 *  - 不得吞 403（'forbidden' 独立分类、独立文案、独立动作）；
 *  - 不得把 500 写成「无数据」（server 文案固定为服务不可用语义）；
 *  - 已有数据刷新失败保留旧数据（stale=true），明确「刷新失败/数据可能已过期」；
 *  - 恢复后清残留（success 后 kind/message/stale 全部归零）；
 *  - loading 期间 retry 是 no-op（防重复点击产生并发请求）；
 *  - 文案不泄漏内部权限码/表名/堆栈（feedbackTextIsSafe 锁定）。
 *
 * 纯函数实现，node 环境可测（与 mfa-challenge 契约同风格）。
 */

/** 失败分类：timeout 超时 / offline 断网 / server 5xx / forbidden 403 / http 其他 4xx / biz 业务失败 */
export type FeedbackKind = 'timeout' | 'offline' | 'server' | 'forbidden' | 'http' | 'biz'

/** 反馈阶段：loading 处理中 / ready 有数据 / empty 无数据 / error 加载失败 */
export type FeedbackPhase = 'loading' | 'ready' | 'empty' | 'error'

export interface LoadFeedbackState {
  phase: FeedbackPhase
  kind: FeedbackKind | null
  /** 展示文案：分类生成，绝不含后端堆栈/表名/权限码 */
  message: string | null
  /**
   * 数据可能已过期：刷新失败但页面仍展示旧数据时为 true。
   * begin（发起新请求）不清除该标记——「数据可能过期」这一性质在
   * success（取到新数据）或 fail（确认失败）时才重新裁决。
   */
  stale: boolean
}

/** axios 异常形状（只读需要的字段） */
interface AxiosLikeError {
  response?: { status?: number }
  code?: string
  message?: string
}

/**
 * axios 异常 → 反馈分类。
 * 顺序：超时（ECONNABORTED/ETIMEDOUT/timeout 文案）→ 无响应（断网）→
 * 403（forbidden）→ ≥500（server）→ 其他带响应（http）→ 业务失败（biz）。
 */
export function classifyFeedbackError(err: unknown): FeedbackKind {
  const e = (err || {}) as AxiosLikeError
  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || /timeout/i.test(String(e.message || ''))) {
    return 'timeout'
  }
  const status = e.response?.status
  if (!status) {
    // 业务失败经 request.ts 拦截器 reject new Error(中文文案)，无 response；
    // 但「纯 Error 无 response」在网络层同样无 response。二者靠类型区分：
    // axios 网络错误带 code（ERR_NETWORK 等），业务 Error 无 code。
    return typeof e.code === 'string' && e.code ? 'offline' : 'biz'
  }
  if (status === 403) return 'forbidden'
  if (status >= 500) return 'server'
  return 'http'
}

/** 各分类固定文案：语义互斥且可区分（超时≠断网≠服务故障≠无权限≠通用失败） */
export const FEEDBACK_ERROR_TEXT: Record<FeedbackKind, string> = {
  timeout: '请求超时，数据未加载完成，请重试',
  offline: '网络连接失败，请检查网络后重试',
  server: '服务暂时不可用，请稍后重试',
  forbidden: '当前账号没有该页面的访问权限，请联系平台管理员开通',
  http: '请求失败，请稍后重试',
  biz: '加载失败，请稍后重试',
}

/** 兜底文案（biz 类取不到中文原因时使用） */
export const FEEDBACK_FALLBACK_TEXT = '加载失败，请稍后重试'

/** 文案安全红线：内部权限码/表名/令牌/堆栈关键字一律不得上屏 */
const FEEDBACK_TEXT_FORBIDDEN = ['t_platform', 'role=', 'Bearer', 'stack', 'password', 'token=', 'SELECT ', 'permission_code']

/** 断言文案不泄漏内部信息（mutation MD 的判定依据） */
export function feedbackTextIsSafe(text: string): boolean {
  const lower = String(text || '').toLowerCase()
  return !FEEDBACK_TEXT_FORBIDDEN.some((k) => lower.includes(k.toLowerCase()))
}

/**
 * 异常 → 展示文案。
 * - 固定分类用固定文案（timeout/offline/server/forbidden/http）；
 * - biz 类经拦截器 reject 的 Error.message 通常是后端中文原因，截断至 120 字符；
 *   但纯 ASCII（英文原文，如 "Request failed"）不上屏——与 utils/http-error.ts
 *   的 PURE_ASCII 全站口径一致，交由兜底文案；
 * - 任何分支产物都过 feedbackTextIsSafe 防线，不安全即换兜底文案。
 */
export function feedbackErrorText(err: unknown): string {
  const kind = classifyFeedbackError(err)
  let text: string
  if (kind === 'biz') {
    const e = (err || {}) as { message?: string }
    const raw = String(e.message || '').trim()
    const isPureAscii = raw ? /^[\x20-\x7E]+$/.test(raw) : true
    text = raw && !isPureAscii ? raw.slice(0, 120) : FEEDBACK_FALLBACK_TEXT
  } else {
    text = FEEDBACK_ERROR_TEXT[kind]
  }
  return feedbackTextIsSafe(text) ? text : FEEDBACK_FALLBACK_TEXT
}

export function initialLoadFeedbackState(): LoadFeedbackState {
  return { phase: 'loading', kind: null, message: null, stale: false }
}

export type LoadFeedbackAction =
  | { type: 'begin' }
  | { type: 'retry' }
  | { type: 'success'; hasData: boolean }
  | { type: 'fail'; err: unknown; hasStaleData: boolean }
  | { type: 'reset' }

/**
 * 反馈状态机（防重复点击 / 保留旧数据 / 恢复清残留的核心真源）：
 * - begin：发起新请求 → loading（保留 stale，见 LoadFeedbackState.stale 注释）；
 * - retry：**仅 error 态或 stale（刷新失败）态可重试**；loading 期间 retry 是
 *   no-op（结构性防重复点击——重试中按钮由调用方按 phase 隐藏/禁用）；
 * - success：hasData → ready；!hasData → empty。**恢复后清残留**：
 *   kind/message/stale 全部归零（recovered）；
 * - fail：无旧数据（hasStaleData=false）→ error + 分类文案；
 *   有旧数据（hasStaleData=true）→ **保留旧数据语义**：phase 回 ready +
 *   stale=true + 刷新失败文案，由调用方保证不清空已渲染数据；
 * - reset：整体复位（切换页面/查询条件时使用）。
 */
export function loadFeedbackReduce(state: LoadFeedbackState, action: LoadFeedbackAction): LoadFeedbackState {
  switch (action.type) {
    case 'begin':
      return { phase: 'loading', kind: null, message: null, stale: state.stale }
    case 'retry': {
      if (state.phase !== 'error' && !state.stale) return state
      return { phase: 'loading', kind: null, message: null, stale: state.stale }
    }
    case 'success':
      return action.hasData
        ? { phase: 'ready', kind: null, message: null, stale: false }
        : { phase: 'empty', kind: null, message: null, stale: false }
    case 'fail': {
      const kind = classifyFeedbackError(action.err)
      const message = feedbackErrorText(action.err)
      if (action.hasStaleData) {
        return { phase: 'ready', kind, message, stale: true }
      }
      return { phase: 'error', kind, message, stale: false }
    }
    case 'reset':
      return initialLoadFeedbackState()
    default:
      return state
  }
}

/** 是否允许发起重试（error 态或刷新失败态）——页面 onRetry 的发令枪 */
export function canRetryFeedback(state: LoadFeedbackState): boolean {
  return state.phase === 'error' || state.stale
}

/** aria-busy：处理中为 true（加载可感知，不闪烁假空态） */
export function feedbackBusyOf(state: LoadFeedbackState): boolean {
  return state.phase === 'loading'
}

/** aria-live 取值：错误态/刷新失败横幅用 assertive（打断播报）；刷新中/首载/空态用 polite。
 *  （aria-live 合法值只有 off/assertive/polite；「alert」语义由 role=alert 承担。） */
export function feedbackLiveRoleOf(state: LoadFeedbackState): 'assertive' | 'polite' {
  return state.phase === 'error' || (state.phase === 'ready' && state.stale) ? 'assertive' : 'polite'
}
