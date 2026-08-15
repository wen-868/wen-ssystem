/**
 * AiChat 组件共享类型定义
 */
import type { AiPreviewPayload } from "../../api/ai";

/** 消息展示类型 */
export type AiMessageKind = "text" | "tool" | "preview" | "error" | "proactive";

/** 工具调用状态 */
export type AiToolStatus = "running" | "success" | "error";

/** 单条对话消息 */
export interface AiChatMessage {
  /** 唯一 ID（前端生成） */
  id: string;
  /** 消息角色 */
  role: "user" | "assistant";
  /** 展示类型 */
  kind: AiMessageKind;
  /** 文本内容（SSE 流式增量累积） */
  content?: string;
  /** 工具名 */
  tool?: string;
  /** 工具执行状态 */
  toolStatus?: AiToolStatus;
  /** 工具返回数据 */
  data?: unknown;
  /** 写操作预览信息 */
  preview?: AiPreviewPayload;
  /** 待确认记录 ID（后端下发） */
  confirmationId?: string;
  /** 确认执行后的操作 ID（3 分钟内可撤销） */
  operationId?: string;
  /** 执行中标记（确认 / 撤销进行时按钮置 loading） */
  pending?: boolean;
  /** 已取消标记 */
  cancelled?: boolean;
  /** 已撤销标记 */
  revoked?: boolean;
  /** 主动推送标题（kind=proactive） */
  title?: string;
  /** 主动推送优先级（urgent/important/reminder/suggestion） */
  priority?: string;
  /** 主动推送类型（system/order/inventory/marketing） */
  proactiveType?: string;
  /** 错误描述 */
  error?: string;
  /** 创建时间戳 */
  createdAt: number;
}

/** 生成唯一消息 ID */
export function createMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
