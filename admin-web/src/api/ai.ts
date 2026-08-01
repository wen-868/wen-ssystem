/**
 * AI 底座 API 封装
 *
 * AI 底座为独立 NestJS 服务（默认端口 3016），通过环境变量 VITE_AI_BASE_URL 配置地址。
 * 端点前缀与底座一致（底座全局前缀 /api）：
 *   - POST /api/chat                          SSE 流式对话
 *   - GET  /api/admin/tools                   工具列表
 *   - GET  /api/chat/confirmations            当前租户待确认列表
 *   - POST /api/chat/confirmations/:id/confirm 确认执行（返回 operationId）
 *   - POST /api/chat/confirmations/:id/cancel  取消
 *   - POST /api/chat/operations/:id/revoke     撤销（3 分钟内）
 *
 * 所有请求携带 Authorization: Bearer <JWT>，AI 底座通过 JWT 解析租户上下文。
 * SSE 流式对话必须使用 fetch + ReadableStream（POST 场景 EventSource 不支持）。
 */
import { useAuthStore } from "../stores/auth";
import { parseSseChunk, type SseEvent } from "./sse";

// ==================== AI 底座基础配置 ====================

/** 解析 AI 底座服务地址：优先读 VITE_AI_BASE_URL，未配置时默认本地 3016 端口 */
function resolveAiBase(): string {
  const configured = import.meta.env.VITE_AI_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "http://localhost:3016";
}

export const AI_BASE_URL = resolveAiBase();

/** 从当前登录态获取 JWT（AI 底座通过 Authorization 注入租户上下文） */
function getAiAuthToken(): string {
  return useAuthStore().token || "";
}

/** 构造统一请求头（携带 JWT + JSON 内容类型） */
function aiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAiAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** 从非 2xx 响应中提取可读错误信息 */
async function readError(resp: Response, fallback: string): Promise<Error> {
  let message = fallback;
  try {
    const text = await resp.text();
    if (text) {
      try {
        const json = JSON.parse(text) as { message?: string; msg?: string; error?: string };
        message = json.message || json.msg || json.error || text;
      } catch {
        message = text;
      }
    }
  } catch {
    // 读取响应体失败时使用兜底文案
  }
  return new Error(message);
}

/** 判断是否为用户主动中断（AbortController.abort 触发） */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

// ==================== SSE 流式对话 ====================

/** 写操作预览信息（tool_result 事件携带） */
export interface AiPreviewPayload {
  operation: string;
  summary: string;
  details: Record<string, unknown>;
}

/** tool_result 事件载荷 */
export interface AiToolResultPayload {
  tool: string;
  success: boolean;
  data?: unknown;
  preview?: AiPreviewPayload;
  confirmationId?: string;
}

/** SSE 事件回调集合 */
export interface AiSseHandlers {
  /** 增量文本 */
  onText: (content: string) => void;
  /** 工具开始调用 */
  onToolStart: (tool: string) => void;
  /** 工具执行结果（可能携带写操作预览 + confirmationId） */
  onToolResult: (payload: AiToolResultPayload) => void;
  /** 本轮对话结束（携带会话 ID，用于多轮上下文） */
  onDone: (conversationId: string) => void;
  /** 服务端错误 */
  onError: (message: string) => void;
}

/** 将单个 SSE 事件分发到对应回调 */
function dispatchSseEvent(event: SseEvent, handlers: AiSseHandlers): void {
  switch (event.type) {
    case "text":
      handlers.onText(String(event.content ?? ""));
      break;
    case "tool_start":
      handlers.onToolStart(String(event.tool ?? ""));
      break;
    case "tool_result":
      handlers.onToolResult({
        tool: String(event.tool ?? ""),
        success: event.success === true,
        data: event.data,
        preview: event.preview as AiPreviewPayload | undefined,
        confirmationId: event.confirmationId ? String(event.confirmationId) : undefined,
      });
      break;
    case "done":
      handlers.onDone(String(event.conversationId ?? ""));
      break;
    case "error":
      handlers.onError(String(event.message ?? "AI 服务返回错误"));
      break;
    default:
      break;
  }
}

/** 创建 SSE 流式解析器：维护残留缓冲，消费流块并分发事件 */
function createSseParser(handlers: AiSseHandlers): (chunk: string, flush?: boolean) => void {
  let buffer = "";
  return (chunk: string, flush = false): void => {
    buffer += chunk;
    const { events, rest } = parseSseChunk(buffer, flush);
    buffer = rest;
    for (const event of events) dispatchSseEvent(event, handlers);
  };
}

/**
 * 发起 SSE 流式对话。
 *
 * 通过 fetch + ReadableStream 逐块读取响应体，解析 data: 事件并触发对应回调。
 * 传入 AbortSignal 可随时中断（组件卸载 / 用户停止时使用）。
 */
export async function sendChatMessage(
  message: string,
  conversationId: string | undefined,
  handlers: AiSseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(`${AI_BASE_URL}/api/chat`, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({ message, conversationId }),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err; // 用户主动中断，不视为错误
    throw new Error("无法连接 AI 服务，请检查 AI 底座（VITE_AI_BASE_URL）是否已启动");
  }

  if (!resp.ok || !resp.body) {
    throw await readError(resp, `AI 服务响应异常（HTTP ${resp.status}）`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const consume = createSseParser(handlers);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      consume(decoder.decode(value, { stream: true }));
    }
    consume("", true); // 冲刷尾部残留
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw err;
  } finally {
    reader.releaseLock();
  }
}

// ==================== 工具列表 / 待确认 / 确认 / 取消 / 撤销 ====================

/** AI 工具信息（用于展示助手能力，非核心依赖） */
export interface AiToolInfo {
  name: string;
  description?: string;
  category?: string;
  isWriteOperation?: boolean;
  parameters?: unknown;
}

/** 获取当前租户可用的 AI 工具列表 */
export async function fetchAiTools(): Promise<AiToolInfo[]> {
  const resp = await fetch(`${AI_BASE_URL}/api/admin/tools`, { headers: aiHeaders() });
  if (!resp.ok) throw await readError(resp, `获取工具列表失败（HTTP ${resp.status}）`);
  const json = (await resp.json()) as { tools?: AiToolInfo[] };
  return json.tools ?? [];
}

/** 待确认操作项 */
export interface AiConfirmationItem {
  confirmationId?: string;
  id?: string;
  operation?: string;
  summary?: string;
  details?: Record<string, unknown>;
  preview?: AiPreviewPayload;
  createdAt?: string;
  expiresAt?: string;
}

/** 获取当前租户的待确认操作列表（兼容 { confirmations } 包装与裸数组两种返回形态） */
export async function fetchAiConfirmations(): Promise<AiConfirmationItem[]> {
  const resp = await fetch(`${AI_BASE_URL}/api/chat/confirmations`, { headers: aiHeaders() });
  if (!resp.ok) throw await readError(resp, `获取待确认列表失败（HTTP ${resp.status}）`);
  const json: unknown = await resp.json();
  if (Array.isArray(json)) return json as AiConfirmationItem[];
  const wrapped = json as { confirmations?: AiConfirmationItem[] } | null;
  return wrapped?.confirmations ?? [];
}

/** 确认执行写操作，返回 operationId（用于 3 分钟内撤销） */
export async function confirmAiOperation(confirmationId: string): Promise<string> {
  const resp = await fetch(
    `${AI_BASE_URL}/api/chat/confirmations/${encodeURIComponent(confirmationId)}/confirm`,
    { method: "POST", headers: aiHeaders() },
  );
  if (!resp.ok) throw await readError(resp, `确认操作失败（HTTP ${resp.status}）`);
  const json = (await resp.json()) as { operationId?: string };
  return json.operationId ?? "";
}

/** 取消待确认的写操作 */
export async function cancelAiOperation(confirmationId: string): Promise<void> {
  const resp = await fetch(
    `${AI_BASE_URL}/api/chat/confirmations/${encodeURIComponent(confirmationId)}/cancel`,
    { method: "POST", headers: aiHeaders() },
  );
  if (!resp.ok) throw await readError(resp, `取消操作失败（HTTP ${resp.status}）`);
}

/** 撤销已执行的写操作（创建后 3 分钟内有效） */
export async function revokeAiOperation(operationId: string): Promise<void> {
  const resp = await fetch(
    `${AI_BASE_URL}/api/chat/operations/${encodeURIComponent(operationId)}/revoke`,
    { method: "POST", headers: aiHeaders() },
  );
  if (!resp.ok) throw await readError(resp, `撤销失败（HTTP ${resp.status}）`);
}
