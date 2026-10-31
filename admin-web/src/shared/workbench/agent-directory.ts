/**
 * 数字员工目录 / 历史会话数据适配（WORKBENCH-10 · 第二栏员工-会话区）
 *
 * **现状核对（2026-10-31，不是猜测）**：
 * `admin-web/src/api/ai.ts` 现有导出覆盖四类：发起对话、模型与工具枚举、
 * 操作确认链（含撤销 / 作废）、服务端推送连接。
 * 另有 `api/system.ts` 的 `getUserSessions`（**登录会话**，与 AI 会话语义不同，不可冒用）。
 * ⇒ **没有**「数字员工列表」「按部门分组」「历史会话」、「归档/删除会话」端点。
 *
 * 因此本适配器**返回 unavailable，不返回任何伪造条目**（派单卡 §E-4、§六明确禁止
 * 用静态假数据把页面填满）。UI 侧必须显示「待接入」，并提供重试入口。
 * 后续内容接线卡只需替换本文件的实现，UI 与测试不需要改动。
 *
 * 注：本文件落在 `shared/workbench`，受 WORKBENCH-02 既有约束扫描管辖——壳层 / manifest
 * 层不得出现 AI 写动作符号名。故上方对现有接口的枚举**只描述用途、不抄写符号名**；
 * 「缺哪些端点」这一结论不受影响且可复查（打开 `src/api/ai.ts` 看导出即可验证）。
 */

export type DirectoryState = "loading" | "ready" | "unavailable" | "error";

export interface DirectoryStaff {
  id: string;
  name: string;
  post: string;
  summary: string;
  /** 在线状态；未接端点时为 null，UI 不画伪状态点 */
  online: boolean | null;
  /** 未读数；未接端点时为 null */
  unread: number | null;
}

export interface DirectoryGroup {
  name: string;
  staffs: DirectoryStaff[];
}

export interface AgentDirectory {
  state: DirectoryState;
  groups: DirectoryGroup[];
  message: string;
}

/** 未接入时的统一返回：结构化 empty，而非假数据 */
const UNAVAILABLE: AgentDirectory = {
  state: "unavailable",
  groups: [],
  message: "数字员工目录尚未接入（缺少目录端点）",
};

export async function loadAgentDirectory(): Promise<AgentDirectory> {
  return UNAVAILABLE;
}

export async function loadHistoryConversations(): Promise<AgentDirectory> {
  return { ...UNAVAILABLE, message: "历史会话尚未接入（缺少会话列表端点）" };
}
