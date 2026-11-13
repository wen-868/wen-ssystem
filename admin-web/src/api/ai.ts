/**
 * AI 底座 API 封装
 *
 * AI 底座为独立 NestJS 服务（默认端口 3016），通过环境变量 VITE_AI_BASE_URL 配置地址。
 * 端点前缀与底座一致（底座全局前缀 /api）：
 *   - POST /api/chat                          SSE 流式对话
 *   - GET  /api/admin/session-archive         真实历史会话 / 对话找回
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
// 待确认列表解析器（三形态 + unknown）的唯一实现位于 shared/workbench/task-center.ts
// （父审计 D05：{ total, items } / { confirmations } / 裸数组；未知形态归 unknown 不硬猜）。
// 该模块顶层零依赖，node 原生测试可直载测解析函数。
import { parseConfirmationsPayload } from "../shared/workbench/task-center";

// ==================== AI 底座基础配置 ====================

/** 解析 AI 底座服务地址：优先读 VITE_AI_BASE_URL，未配置时默认本地 3016 端口 */
function resolveAiBase(): string {
  // Electron 桌面环境：通过 preload 获取 AI 底座地址
  if (typeof window !== "undefined" && (window as any).electronAPI?.aiBase) {
    return String((window as any).electronAPI.aiBase).replace(/\/+$/, "");
  }
  const configured = import.meta.env.VITE_AI_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  // 生产构建默认指向 admin.onepan.cn 的 AI 底座反代（与 nginx /ai-api/ 一致，SSE+WS 同源承载）
  if (import.meta.env.PROD) return "https://admin.onepan.cn/ai-api";
  return "http://localhost:3016";
}

export const AI_BASE_URL = resolveAiBase();

/** 新对话立即使用的客户端会话 ID；服务端首条消息会沿用该 ID 写入记忆与归档。 */
export function createAiConversationId(): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `sess_${Date.now()}_${random}`;
}

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

// ==================== 会话归档 ====================

export interface AiSessionArchiveItem {
  id?: string | number;
  sessionId?: string;
  session_id?: string;
  tenantId?: string;
  tenant_id?: string;
  userId?: string | null;
  user_id?: string | null;
  messagesJson?: unknown;
  messages_json?: unknown;
  messageCount?: number;
  message_count?: number;
  startedAt?: string | null;
  started_at?: string | null;
  endedAt?: string | null;
  ended_at?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
}

export interface AiSessionArchiveResponse {
  total?: number;
  items?: AiSessionArchiveItem[];
}

/**
 * 查询 AI 底座真实会话归档。
 *
 * GET /api/admin/session-archive
 * - sessionId 为空时返回当前租户最近会话；
 * - sessionId 有值时返回该会话的完整归档消息；
 * - 该端点是历史会话与“找回对话”的唯一真源，不得用本地缓存冒充。
 */
export async function fetchAiSessionArchive(options?: {
  sessionId?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<AiSessionArchiveResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.max(1, Math.min(options?.limit ?? 40, 100))));
  if (options?.sessionId) params.set("sessionId", options.sessionId);
  const resp = await fetch(`${AI_BASE_URL}/api/admin/session-archive?${params.toString()}`, {
    method: "GET",
    headers: aiHeaders(),
    signal: options?.signal,
  });
  if (!resp.ok) throw await readError(resp, `获取历史会话失败（HTTP ${resp.status}）`);
  const json: unknown = await resp.json();
  if (!json || typeof json !== "object") {
    throw new Error("历史会话返回形状异常（非对象）");
  }
  return json as AiSessionArchiveResponse;
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
  model?: string,
  image?: string,
  employeeUid?: string,
): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(`${AI_BASE_URL}/api/chat`, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        message,
        conversationId,
        ...(model ? { model } : {}),
        ...(image ? { image } : {}),
        ...(employeeUid ? { employeeUid } : {}),
      }),
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

// ==================== 对话级模型切换 ====================

/** 可用模型选项 */
export interface AiModelOption {
  value: string;
  label: string;
  type: "builtin" | "external";
}

/** 模型列表响应 */
export interface AiModelsResponse {
  default: string;
  models: AiModelOption[];
}

export interface AiEmployeeCreateInput {
  name: string;
  post: string;
  department: string;
  personaPrompt?: string;
  toolCategories?: string[];
  replyStyle?: string;
  dispatchUids?: string[];
}

/** 新建数字员工；成功后由调用方刷新联系人目录。 */
export async function createAiEmployee(
  input: AiEmployeeCreateInput,
): Promise<Record<string, unknown>> {
  const resp = await fetch(`${AI_BASE_URL}/api/ai/employees`, {
    method: "POST",
    headers: aiHeaders(),
    body: JSON.stringify(input),
  });
  if (!resp.ok) throw await readError(resp, `创建数字员工失败（HTTP ${resp.status}）`);
  const json: unknown = await resp.json();
  return json && typeof json === "object"
    ? (json as Record<string, unknown>)
    : { success: true };
}

/** 获取当前租户可用模型列表（内置 + 启用外部模型）与默认模型 */
export async function fetchAiModels(): Promise<AiModelsResponse> {
  const resp = await fetch(`${AI_BASE_URL}/api/chat/models`, {
    headers: aiHeaders(),
  });
  if (!resp.ok) throw await readError(resp, `获取模型列表失败（HTTP ${resp.status}）`);
  return (await resp.json()) as AiModelsResponse;
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

/** 待确认列表请求超时（毫秒）；超时由调用方按 timeout 语义降级（与 error 区分） */
const CONFIRMATIONS_TIMEOUT_MS = 8_000;

/**
 * 获取当前租户的待确认操作列表。
 *
 * 返回形态兼容三类（WORKBENCH-PROTOTYPE-12-S1 修复：旧实现只认裸数组与
 * `{ confirmations }` 包装，对底座现行的 `{ total, items }`（chat.controller.ts:256）
 * 会静默返回空数组——把"解析不了"伪装成"没有待确认"的假 0）：
 *   1. `{ total, items }` —— 现行底座契约（空租户同形态）；
 *   2. `{ confirmations }` —— 历史包装形态；
 *   3. 裸数组 —— 旧假设形态。
 * 其余未知形态 ⇒ 抛错（error 态），绝不返回空数组冒充真实空列表。
 * 总数以解析器按 ID 去重后的真实记录为准（同源，见 task-center.parseConfirmationsPayload）。
 */
export async function fetchAiConfirmations(): Promise<AiConfirmationItem[]> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), CONFIRMATIONS_TIMEOUT_MS) : null;
  try {
    const resp = await fetch(`${AI_BASE_URL}/api/chat/confirmations`, {
      headers: aiHeaders(),
      signal: controller?.signal,
    });
    if (!resp.ok) throw await readError(resp, `获取待确认列表失败（HTTP ${resp.status}）`);
    const json: unknown = await resp.json();
    const parsed = parseConfirmationsPayload(json);
    if (parsed.kind === "unknown") {
      // 未知形态 = 不知道，不是没有 ⇒ 抛错让调用方进 error 态（不显示假 0）
      throw new Error("待确认列表响应形状异常（既非数组也无 items/confirmations 包装）");
    }
    return parsed.items as AiConfirmationItem[];
  } finally {
    if (timer) clearTimeout(timer);
  }
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

// ==================== AI 主动推送 WebSocket ====================

/** AI 主动推送载荷（对齐 ai-base PushPayload / ProactivePush） */
export interface AiProactivePayload {
  /** 推送标题（如"⚠️ 库存预警"） */
  title: string;
  /** 推送内容（markdown 表格，卡片内按纯文本展示） */
  content: string;
  /** 推送类型（system/order/inventory/marketing） */
  type: string;
  /** 优先级（urgent/important/reminder/suggestion） */
  priority: string;
  /** 附加数据（任务名、数量等） */
  extras?: Record<string, unknown>;
  /** 服务端落库时间（ISO 字符串） */
  pushedAt: string;
}

/** 推送连接回调集合 */
export interface AiPushHandlers {
  /** 收到一条 AI 主动推送 */
  onMessage: (payload: AiProactivePayload) => void;
  /** 连接状态变化（重连/断开时触发） */
  onStatusChange?: (connected: boolean) => void;
}

/** 断线自动重连间隔（毫秒） */
const PUSH_RECONNECT_DELAY_MS = 5_000;

/**
 * 连接 AI 主动推送 WebSocket（/api/ai/ws?token=xxx）
 *
 * - 携带当前登录 JWT 认证，服务端按租户广播巡检推送
 * - 断线后自动重连（5 秒），调用返回的断开函数可彻底关闭
 * - 仅处理 event=ai_proactive_push 帧，其余帧忽略
 *
 * @returns 断开函数（组件卸载时调用）
 */
export function connectAiPushSocket(handlers: AiPushHandlers): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: number | undefined;

  const teardown = (): void => {
    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    socket?.close();
    socket = null;
  };

  const connect = (): void => {
    if (closed) return;
    const token = getAiAuthToken();
    if (!token) {
      handlers.onStatusChange?.(false);
      return;
    }

    const wsBase = AI_BASE_URL.replace(/^http/, "ws");
    const url = `${wsBase}/api/ai/ws?token=${encodeURIComponent(token)}`;
    socket = new WebSocket(url);

    socket.onopen = () => handlers.onStatusChange?.(true);
    socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(String(event.data)) as {
          event?: string;
          data?: AiProactivePayload;
        };
        if (frame.event === "ai_proactive_push" && frame.data) {
          handlers.onMessage(frame.data);
        }
      } catch {
        // 忽略非 JSON 帧（心跳等）
      }
    };
    socket.onclose = () => {
      handlers.onStatusChange?.(false);
      socket = null;
      // 自动重连（已手动关闭则跳过）
      if (!closed) {
        reconnectTimer = window.setTimeout(connect, PUSH_RECONNECT_DELAY_MS);
      }
    };
    socket.onerror = () => socket?.close();
  };

  connect();

  return (): void => {
    closed = true;
    teardown();
  };
}
