import axios from 'axios'
import request from '../utils/request'

/** 登录（R101-S2-01 裁定 4.1：图形验证码为必填校验项） */
export function loginApi(data: {
  username: string
  password: string
  captchaId: string
  captcha: string
}) {
  return request.post('/platform/auth/login', data)
}

export function getAdminInfoApi() {
  return request.get('/platform/auth/me')
}

/**
 * 会话恢复专用（REHYDRATE-01）：绕过统一实例的响应拦截器。
 * 原因：统一实例对 401 会自动 logout 并改写 hash 跳登录页，而「恢复会话」场景
 * 需要 auth store 自主区分三类结果（成功 / 401 过期 fail-closed / 网络失败保留 token 可重试），
 * 拦截器的自动副作用会与守卫的 async 流程竞争。Authorization 显式传入而非依赖拦截器注入。
 * 注：'/api' 前缀与 request 实例 baseURL 同源（vite proxy 契约常量）。
 */
export function getAdminInfoRaw(token: string) {
  return axios.get('/api/platform/auth/me', {
    timeout: 15000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

/** 获取图形验证码（后端下发 SVG data URI，5 分钟有效、一次性） */
export function getCaptchaApi() {
  return request.get('/platform/auth/captcha')
}

/**
 * MFA 第二步：以挑战令牌换取正式登录结果（TOTAL-PLATFORM-MFA-CHALLENGE-UI-01）。
 * 契约与后端 POST /api/platform/auth/mfa/verify 一致：{ mfaToken, code } →
 * 成功 { token, admin, csrfToken }；400 验证码错误（mfaToken 仍有效可重试）；401 挑战令牌失效。
 */
export function verifyMfaApi(mfaToken: string, code: string) {
  return request.post('/platform/auth/mfa/verify', { mfaToken, code })
}

/* ════════ MFA 挑战域契约（纯函数，node 环境可测；组件与 store 共用真源） ════════ */

export type MfaStep = 'credentials' | 'challenge'

export interface MfaChallengeState {
  step: MfaStep
  /** MFA 挑战令牌：仅内存流转，绝不持久化（红线：不把 mfaToken 当正式 token） */
  mfaToken: string
  /** 提交进行中：true 期间再 submit 是 no-op（防连点/刷新重复消费验证码） */
  submitting: boolean
  /** 展示文案：分类生成，绝不含后端堆栈/敏感信息 */
  error: string | null
  attempts: number
}

export function initialMfaChallengeState(): MfaChallengeState {
  return { step: 'credentials', mfaToken: '', submitting: false, error: null, attempts: 0 }
}

/**
 * 登录响应是否进入 MFA 第二步。**严格判定**：
 * 必须 mfaRequired === true 且 mfaToken 为非空字符串——
 * 二者缺一即视为未进入挑战（绝不让 mfaToken 单独、或缺失令牌的 mfaRequired 冒充登录态）。
 */
export function mfaRequiredOf(loginData: unknown): boolean {
  const d = loginData as { mfaRequired?: unknown; mfaToken?: unknown } | null | undefined
  return d?.mfaRequired === true && typeof d.mfaToken === 'string' && d.mfaToken.length > 0
}

/** 动态码格式：恰好 6 位数字（与后端 TOTP 口径一致；前导零合法） */
export function mfaCodeIsValid(code: string): boolean {
  return /^\d{6}$/.test(code)
}

/**
 * MFA 错误文案（分类生成，不泄露敏感信息）：
 * - 400：验证码错误/过期（挑战令牌仍有效，可原地重试）
 * - 401：挑战令牌失效/过期（须返回第一步重新登录获取新挑战）
 * - 超时/网络：可重试
 * - 其余：统一兜底文案；**任何分支都不回传后端原始 msg/堆栈/令牌内容**
 */
export function mfaErrorText(err: unknown): string {
  const anyErr = err as { response?: { status?: number }; code?: string; message?: string } | null
  const status = anyErr?.response?.status
  if (status === 400) return '动态码错误或已过期，请核对后重试'
  if (status === 401) return '验证会话已过期，请返回重新登录'
  if (anyErr?.code === 'ECONNABORTED' || /timeout/i.test(String(anyErr?.message || ''))) {
    return '请求超时，请检查网络后重试'
  }
  if (!status && anyErr && anyErr instanceof Error) return '网络异常，请稍后重试'
  return '验证失败，请稍后重试'
}

const MFA_ERROR_FORBIDDEN = ['mfaToken', 'secret', 'Bearer', 'stack', 'password', 'token=']

/** 防线：文案本身绝不携带敏感片段（mutation MC 的判定依据） */
export function mfaErrorTextIsSafe(text: string): boolean {
  const lower = text.toLowerCase()
  return !MFA_ERROR_FORBIDDEN.some((k) => lower.includes(k.toLowerCase()))
}

export type MfaChallengeAction =
  | { type: 'enter'; mfaToken: string }
  | { type: 'submit'; code: string }
  | { type: 'fail'; err: unknown }
  | { type: 'success' }
  | { type: 'back' }

/**
 * MFA 挑战状态机（防重复消费/防冒充的核心真源）：
 * - enter：进入挑战步（mfaToken 仅内存），error/attempts 归零；
 * - submit：仅「challenge 步 + 未在提交中 + 6 位数字」才允许进入 submitting，
 *   其余情形维持原状态——连点/刷新重复提交不会产生第二次 verify 请求的窗口；
 * - fail：结束 submitting、记录分类文案、attempts+1，**保留 mfaToken**（400 可原地重试）；
 * - success：整体复位（调用方随即将正式 token 落盘）；
 * - back：回凭据步并丢弃挑战令牌与错误（账号密码上下文在组件 form 中不受影响）。
 */
export function mfaChallengeReduce(state: MfaChallengeState, action: MfaChallengeAction): MfaChallengeState {
  switch (action.type) {
    case 'enter':
      return { step: 'challenge', mfaToken: action.mfaToken, submitting: false, error: null, attempts: 0 }
    case 'submit': {
      if (state.step !== 'challenge' || state.submitting) return state
      if (!mfaCodeIsValid(action.code)) {
        return { ...state, error: '请输入 6 位数字动态码' }
      }
      return { ...state, submitting: true, error: null }
    }
    case 'fail':
      return {
        ...state,
        submitting: false,
        error: mfaErrorText(action.err),
        attempts: state.attempts + 1,
      }
    case 'success':
      return initialMfaChallengeState()
    case 'back':
      return { ...initialMfaChallengeState(), step: 'credentials' }
    default:
      return state
  }
}
