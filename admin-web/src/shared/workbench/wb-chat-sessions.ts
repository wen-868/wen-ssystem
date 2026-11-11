/**
 * AI 会话管理数据适配（WORKBENCH-10 · 区域 C：会话切换 / 归档 / 删除 / 重命名 / 归档区恢复）
 *
 * **现状核对（2026-11，与 agent-directory.ts 同口径，不是猜测）**：
 * `admin-web/src/api/ai.ts` 现有导出只覆盖四类：发起对话（POST /api/chat，SSE）、
 * 模型与工具枚举、操作确认链（含撤销 / 作废）、服务端推送连接。
 * ⇒ **没有**「历史会话列表」「归档会话」「删除会话」「重命名会话」「恢复会话」端点。
 * `api/system.ts` 的 getUserSessions 是**登录会话**，与 AI 会话语义不同，不得冒用。
 *
 * 因此本适配器的所有管理动作一律返回 `unavailable` 且 `ok: false`，
 * **不做任何本地伪成功**（不假归档、不假删除、不假恢复）。
 * UI 侧（AiSessionList.vue）必须显示「暂不可用」并给出重试入口；
 * 后续端点就绪时只需替换本文件实现，UI 与测试不必改动。
 *
 * 唯一真实存在的对话链：AiSidePanel 的流式发起对话（POST /api/chat）。
 * 「新对话」动作走其 clearChat（重置本地上下文 + 下条消息重开会话），是真实动作，
 * 不经过本适配器，故不在这里伪造 list/archive 之类的能力。
 */

export type ChatSessionState = "loading" | "ready" | "unavailable" | "error";

export interface ChatSessionEntry {
  id: string;
  title: string;
  /** 后端会话 ID（POST /api/chat 的 done 事件回传后才存在） */
  conversationId: string | null;
  /** true＝本次页面里真实存活中的对话；false＝服务端历史会话（缺会话列表端点，恒不会返回此类条目） */
  live: boolean;
  archived: boolean;
}

export interface ChatSessionListResult {
  state: ChatSessionState;
  sessions: ChatSessionEntry[];
  message: string;
}

export interface ChatSessionMutationResult {
  /** 动作是否真实生效。缺端点 ⇒ 恒 false（绝不返回 ok:true 冒充成功） */
  ok: boolean;
  state: ChatSessionState;
  message: string;
}

const LIST_PENDING_MESSAGE = "历史会话列表暂不可用（缺少会话列表端点）";
const ARCHIVE_LIST_PENDING_MESSAGE = "归档会话列表暂不可用（缺少归档会话列表端点）";
const ARCHIVE_PENDING_MESSAGE = "归档会话暂不可用（缺少会话归档端点）";
const DELETE_PENDING_MESSAGE = "删除会话暂不可用（缺少会话删除端点）";
const RESTORE_PENDING_MESSAGE = "恢复会话暂不可用（缺少会话恢复端点）";
const RENAME_PENDING_MESSAGE = "重命名会话暂不可用（缺少会话重命名端点）";

/** 只读列表：结构化 empty，不返回任何虚构会话 */
export async function loadChatSessions(): Promise<ChatSessionListResult> {
  return { state: "unavailable", sessions: [], message: LIST_PENDING_MESSAGE };
}

/** 归档区列表：同上，空且不伪造条目 */
export async function loadArchivedChatSessions(): Promise<ChatSessionListResult> {
  return { state: "unavailable", sessions: [], message: ARCHIVE_LIST_PENDING_MESSAGE };
}

/**
 * 管理动作统一降级：先校验入参（fail-closed），再返回暂不可用结论。
 * 不改动服务端、不改动本地列表状态——调用方拿到 ok:false 后必须原样展示原因。
 */
function mutationFailure(message: string, sessionId: string): ChatSessionMutationResult {
  if (!sessionId) {
    return { ok: false, state: "error", message: `${message}；且会话标识缺失` };
  }
  return { ok: false, state: "unavailable", message };
}

export async function archiveChatSession(sessionId: string): Promise<ChatSessionMutationResult> {
  return mutationFailure(ARCHIVE_PENDING_MESSAGE, sessionId);
}

export async function deleteChatSession(sessionId: string): Promise<ChatSessionMutationResult> {
  return mutationFailure(DELETE_PENDING_MESSAGE, sessionId);
}

export async function restoreChatSession(sessionId: string): Promise<ChatSessionMutationResult> {
  return mutationFailure(RESTORE_PENDING_MESSAGE, sessionId);
}

export async function renameChatSession(
  sessionId: string,
  title: string,
): Promise<ChatSessionMutationResult> {
  if (!title || !title.trim()) {
    return { ok: false, state: "error", message: `${RENAME_PENDING_MESSAGE}；且新标题为空` };
  }
  return mutationFailure(RENAME_PENDING_MESSAGE, sessionId);
}

/** 供 UI 直接引用的「暂不可用」口径文案（单一事实源，测试也读这里） */
export const CHAT_SESSION_PENDING_LABELS = {
  list: LIST_PENDING_MESSAGE,
  archiveList: ARCHIVE_LIST_PENDING_MESSAGE,
  archive: ARCHIVE_PENDING_MESSAGE,
  delete: DELETE_PENDING_MESSAGE,
  restore: RESTORE_PENDING_MESSAGE,
  rename: RENAME_PENDING_MESSAGE,
} as const;
