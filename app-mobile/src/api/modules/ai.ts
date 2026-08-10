/**
 * AI 助手 API 封装
 *
 * 对接后端 AI 底座（独立端口，全局前缀 /api，默认 http://localhost:3016）。
 * JWT 复用现有商户端登录态（merchant_token）。
 *
 * 接口契约（AI 底座，详见 docs/ai-base/）：
 *  - POST {AI_BASE_URL}/api/chat — SSE 流式对话（请求体 {message, conversationId?}）
 *  - POST {AI_BASE_URL}/api/chat/confirmations/:confirmationId/confirm — 确认执行
 *  - POST {AI_BASE_URL}/api/chat/confirmations/:confirmationId/cancel — 取消
 *
 * SSE 事件格式（每行 data: {JSON}\n\n）：
 *  - {"type":"text","content":"增量文本"}
 *  - {"type":"tool_start","tool":"工具名"}
 *  - {"type":"tool_result","tool":"工具名","success":true,"data":{...},"preview":{...},"confirmationId":"xxx"}
 *  - {"type":"done","conversationId":"xxx"}
 *  - {"type":"error","message":"错误描述"}
 *
 * 实现说明：
 *  - H5 端使用 fetch + ReadableStream 解析 SSE 流（POST 不能使用 EventSource）
 *  - 小程序/App 端 fetch 不可用，降级为 uni.request 一次性获取完整响应后本地解析 SSE
 *    （TODO：后续可接入 uni.connectSocket / 云函数中转实现真流式）
 *
 * @author 阿澈
 */

// H5 使用 Vite 环境变量（VITE_AI_BASE_URL=/ai-api），其他平台（App）使用生产 AI 代理地址
// 使用 IIFE 包裹避免 vue-tsc 误报重复声明（uni-app 编译器会按平台去除无用分支）
const AI_BASE_URL: string = (() => {
  // #ifdef H5
  return import.meta.env.VITE_AI_BASE_URL || 'https://m.onepan.cn/ai-api'
  // #endif
  // #ifndef H5
  return 'https://m.onepan.cn/ai-api'
  // #endif
})()

/** 读取当前登录态 JWT（与 request.ts 存储键一致） */
function getToken(): string {
  return uni.getStorageSync('merchant_token') || ''
}

/** 构造带鉴权的请求头（JWT 复用现有登录态） */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

// ====================== SSE 事件类型定义 ======================

/** 文本增量事件 */
export interface AiChatTextEvent {
  type: 'text'
  content: string
}

/** 工具开始调用事件 */
export interface AiChatToolStartEvent {
  type: 'tool_start'
  tool: string
}

/** 写操作预览结构（tool_result 事件携带，前端渲染确认卡片） */
export interface AiToolPreview {
  operation: string
  summary: string
  details: Record<string, unknown>
}

/** 工具执行结果事件（含写操作预览卡片数据） */
export interface AiChatToolResultEvent {
  type: 'tool_result'
  tool: string
  success: boolean
  data?: unknown
  preview?: AiToolPreview
  confirmationId?: string
}

/** 对话结束事件 */
export interface AiChatDoneEvent {
  type: 'done'
  conversationId: string
}

/** 错误事件 */
export interface AiChatErrorEvent {
  type: 'error'
  message: string
}

/** SSE 事件联合类型 */
export type AiChatEvent =
  | AiChatTextEvent
  | AiChatToolStartEvent
  | AiChatToolResultEvent
  | AiChatDoneEvent
  | AiChatErrorEvent

/** 对话请求参数 */
export interface AiChatParams {
  message: string
  conversationId?: string
}

/** SSE 事件回调集合 */
export interface AiChatHandlers {
  /** 文本增量 */
  onText: (content: string) => void
  /** 工具开始调用 */
  onToolStart: (tool: string) => void
  /** 工具执行结果（含写操作预览） */
  onToolResult: (event: AiChatToolResultEvent) => void
  /** 对话结束 */
  onDone: (conversationId: string) => void
  /** 错误 */
  onError: (message: string) => void
}

// ====================== SSE 解析工具 ======================

/**
 * 解析单个 SSE 数据行（data: {JSON}），解析失败返回 null
 */
export function parseSseData(line: string): AiChatEvent | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice(5).trim()
  if (!payload) return null
  try {
    return JSON.parse(payload) as AiChatEvent
  } catch {
    return null
  }
}

/**
 * 解析一段 SSE 文本（可能含多个 data 行），逐事件分发到回调
 * @param text 一段 SSE 原始文本（不含事件分隔空行）
 * @param handlers 事件回调集合
 */
export function dispatchSseText(text: string, handlers: AiChatHandlers): void {
  const lines = text.split('\n')
  for (const line of lines) {
    const event = parseSseData(line)
    if (!event) continue
    switch (event.type) {
      case 'text':
        handlers.onText(event.content)
        break
      case 'tool_start':
        handlers.onToolStart(event.tool)
        break
      case 'tool_result':
        handlers.onToolResult(event)
        break
      case 'done':
        handlers.onDone(event.conversationId)
        break
      case 'error':
        handlers.onError(event.message)
        break
    }
  }
}

// ====================== H5 端：fetch + ReadableStream 流式实现 ======================

/**
 * H5 端：fetch + ReadableStream 解析 SSE 流
 * POST 请求无法使用 EventSource，只能通过 fetch 手动读取响应流并按行解析
 */
async function streamChatH5(
  params: AiChatParams,
  handlers: AiChatHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${AI_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(params),
    signal
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    const message = errorText || `对话请求失败（HTTP ${res.status}）`
    handlers.onError(message)
    throw new Error(message)
  }
  if (!res.body) {
    const message = '服务器未返回流式响应'
    handlers.onError(message)
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE 事件以空行（\n\n）分隔，逐个切分解析
      let sepIndex = buffer.indexOf('\n\n')
      while (sepIndex !== -1) {
        const chunk = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)
        dispatchSseText(chunk, handlers)
        sepIndex = buffer.indexOf('\n\n')
      }
    }
    // 处理末尾残留（响应无 \n\n 结尾的情况）
    if (buffer.trim()) {
      dispatchSseText(buffer, handlers)
    }
  } catch (err) {
    // 主动 abort 中断流不视为错误
    if (!(signal && signal.aborted)) {
      throw err
    }
  }
}

// ====================== 非 H5 端：uni.request 降级实现 ======================

/**
 * 非 H5 端：uni.request 一次性获取完整响应后本地解析 SSE（降级方案）
 *
 * TODO: 小程序/App 端如需真流式体验，可接入 uni.connectSocket(WebSocket 代理)
 *       或云函数中转 SSE，当前先保证功能可用
 */
function streamChatLegacy(params: AiChatParams, handlers: AiChatHandlers): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    uni.request({
      url: `${AI_BASE_URL}/api/chat`,
      method: 'POST',
      data: {
        message: params.message,
        ...(params.conversationId ? { conversationId: params.conversationId } : {})
      },
      header: buildHeaders(),
      success: (res) => {
        if (res.statusCode !== 200) {
          const message =
            typeof res.data === 'string' && res.data
              ? res.data
              : `对话请求失败（HTTP ${res.statusCode}）`
          handlers.onError(message)
          reject(new Error(message))
          return
        }
        const text =
          typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '')
        dispatchSseText(text, handlers)
        resolve()
      },
      fail: () => {
        const message = '网络连接失败，请检查网络'
        handlers.onError(message)
        reject(new Error(message))
      }
    })
  })
}

// ====================== 对外统一入口 ======================

/**
 * 发起 SSE 流式对话（平台自适应）
 *
 * @param params 对话参数（message / conversationId）
 * @param handlers 事件回调集合
 * @param signal 中止信号（H5 端用于停止流式请求）
 * @returns 对话结束或出错时 resolve/reject
 */
export function streamChat(
  params: AiChatParams,
  handlers: AiChatHandlers,
  signal?: AbortSignal
): Promise<void> {
  return (() => {
    // #ifdef H5
    return streamChatH5(params, handlers, signal)
    // #endif
    // #ifndef H5
    return streamChatLegacy(params, handlers)
    // #endif
  })()
}

// ====================== 写操作确认 / 取消 ======================

/** 确认/取消操作结果 */
export interface AiConfirmResult {
  success: boolean
  data?: unknown
  operationId?: string
  message?: string
  error?: string
  suggestion?: string
}

/**
 * 对写操作预览发起确认/取消请求（非流式，uni.request 即可，全平台可用）
 * @param confirmationId 待确认记录 ID（tool_result 事件下发）
 * @param action confirm（确认执行）/ cancel（取消）
 */
function requestConfirmation(
  confirmationId: string,
  action: 'confirm' | 'cancel'
): Promise<AiConfirmResult> {
  return new Promise<AiConfirmResult>((resolve, reject) => {
    uni.request({
      url: `${AI_BASE_URL}/api/chat/confirmations/${confirmationId}/${action}`,
      method: 'POST',
      header: buildHeaders(),
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve((res.data ?? {}) as AiConfirmResult)
          return
        }
        const data = res.data as AiConfirmResult | undefined
        const message = data?.error || data?.message || `请求失败（HTTP ${res.statusCode}）`
        reject(new Error(message))
      },
      fail: () => {
        reject(new Error('网络连接失败，请检查网络'))
      }
    })
  })
}

/** 确认执行写操作 */
export function confirmAiOperation(confirmationId: string): Promise<AiConfirmResult> {
  return requestConfirmation(confirmationId, 'confirm')
}

/** 取消写操作 */
export function cancelAiOperation(confirmationId: string): Promise<AiConfirmResult> {
  return requestConfirmation(confirmationId, 'cancel')
}

/** AI 助手 API 集合 */
export const aiApi = {
  streamChat,
  confirm: confirmAiOperation,
  cancel: cancelAiOperation
}
