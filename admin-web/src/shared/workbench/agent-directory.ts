/**
 * 数字员工目录 / 历史会话数据适配（WORKBENCH-PROTOTYPE-12-S1 · 父审计 D06/D07/D11）
 *
 * **真实端点（ai-base 源码直读，非猜测）**：
 *   - `GET {AI_BASE}/api/ai/employees` → 裸数组
 *     （ai-base `src/brain/employee/employee.controller.ts:103`，service.list 只回 status=1 启用员工；
 *       行字段：{ id, employeeUid, name, post, department, dispatchUids, status: '管理岗'|'就绪' }）
 *   - **无 online 字段**（父审计 D07 MISSING）：只能显示"N 名员工已启用"，
 *     绝不显示 N/M 在线、不用 status=1 冒充 online —— `online` 恒 null，UI 不画伪状态点。
 *   - `GET {AI_BASE}/api/admin/session-archive?limit=40` → 真实会话归档列表
 *     （AI 底座 admin.controller.ts；含 sessionId/messagesJson/messageCount/时间）。
 *     历史会话只从这里读取，按 sessionId 去重；本地内存不得冒充服务端记录。
 *
 * 状态口径：
 *   - 真实空列表 ⇒ ready + 空分组（业务空态"暂无数字员工"，由视图渲染）；
 *   - 失败/超时 ⇒ error（消息带原因/超时标注）+ 视图重试入口；
 *   - 形状异常（非数组）⇒ error（不知道 ≠ 没有，绝不当作空）；
 *   - 禁止 14 个原型助理与"N/M 在线"硬编码（D06/D07 production_rule）。
 *
 * ⚠️ 纯度约定：模块顶层零依赖 ⇒ node 原生测试可直载测解析函数（解析器单测）；
 *     网络装载器函数体内 dynamic import 真实 API 封装。
 */

export type DirectoryState = "loading" | "ready" | "unavailable" | "error";

export interface DirectoryStaff {
  id: string;
  name: string;
  post: string;
  summary: string;
  /** 在线状态；底座无 online 字段（D07 MISSING）⇒ 恒 null，UI 不画伪状态点 */
  online: boolean | null;
  /** 未读数；无端点 ⇒ 恒 null */
  unread: number | null;
  /** 历史会话 ID；员工行为空。点击会话行时据此读取真实归档消息。 */
  conversationId?: string;
  /** 数字员工 UID；员工行必填，历史会话行为空。 */
  employeeUid?: string;
  /** 该员工可结构化派发的下级 UID（规划口径：协作不是自由群聊）。 */
  dispatchUids?: string[];
}

export interface DirectoryGroup {
  name: string;
  staffs: DirectoryStaff[];
}

export interface AgentDirectory {
  state: DirectoryState;
  groups: DirectoryGroup[];
  message: string;
  /** 启用员工数（= 分组内 staffs 总数，同源派生；仅 ready 时有意义） */
  enabledCount: number;
}

/** 员工目录载荷解析（纯函数）：裸数组 ⇒ ready；非数组 ⇒ error（不当作空） */
export interface ParsedEmployeeDirectory {
  state: "ready" | "error";
  groups: DirectoryGroup[];
  message: string;
  enabledCount: number;
}

/** 按部门分组；无部门归"未分组"；保持后端顺序（id DESC） */
export function parseEmployeeDirectoryPayload(payload: unknown): ParsedEmployeeDirectory {
  if (!Array.isArray(payload)) {
    return { state: "error", groups: [], message: "员工目录返回形状异常（非数组）", enabledCount: 0 };
  }
  const byDept = new Map<string, DirectoryStaff[]>();
  for (const row of payload) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (!name) continue; // 无名字的脏行跳过，不污染目录
    const staff: DirectoryStaff = {
      id: String(r.id ?? ""),
      employeeUid: String(r.employeeUid ?? r.employee_uid ?? ""),
      name,
      post: String(r.post ?? ""),
      // 底座真实字段只有 department/post；summary 用部门（不生成虚构简介）
      summary: String(r.department ?? ""),
      online: null, // D07：无 online 真源 ⇒ null，绝不冒充
      unread: null,
      dispatchUids: Array.isArray(r.dispatchUids)
        ? r.dispatchUids.map(String).filter(Boolean)
        : Array.isArray(r.dispatch_uids)
          ? r.dispatch_uids.map(String).filter(Boolean)
          : [],
    };
    const dept = staff.summary.length > 0 ? staff.summary : "未分组";
    const bucket = byDept.get(dept);
    if (bucket) bucket.push(staff);
    else byDept.set(dept, [staff]);
  }
  const groups: DirectoryGroup[] = [...byDept.entries()].map(([name, staffs]) => ({ name, staffs }));
  const enabledCount = groups.reduce((sum, g) => sum + g.staffs.length, 0);
  return {
    state: "ready",
    groups,
    message: `${enabledCount} 名员工已启用`, // D07 口径：只显示可证实的启用数，不显示 N/M 在线
    enabledCount,
  };
}

/** 目录/会话统一失败返回 */
function directoryError(message: string): AgentDirectory {
  return { state: "error", groups: [], message, enabledCount: 0 };
}

/** AI 底座带超时 GET（与 task-center 同口径：8 秒，AbortError ⇒ 超时文案） */
async function aiGet(path: string): Promise<unknown> {
  let base = "http://localhost:3016";
  try {
    const { AI_BASE_URL } = await import("../../api/ai");
    base = AI_BASE_URL;
  } catch {
    // Node 原生 TS 契约测试没有 Vite 的 import.meta.env；仅测试环境回退本地基址。
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  try {
    const { useAuthStore } = await import("../../stores/auth");
    const token = useAuthStore().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* 无 Pinia/登录态：按匿名请求发出，由服务端裁决 */
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 8_000) : null;
  try {
    const resp = await fetch(`${base}${path}`, { method: "GET", headers, signal: controller?.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as unknown;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isTimeoutError(err: unknown): boolean {
  const e = err as { name?: unknown; code?: unknown; message?: unknown } | null;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    e?.name === "AbortError" ||
    e?.name === "TimeoutError" ||
    e?.code === "ECONNABORTED" ||
    e?.code === "ETIMEDOUT" ||
    /timeout|timed?\s*out|超时/i.test(message)
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : String(err ?? "请求失败");
}

/**
 * 装载数字员工目录（真实端点 /api/ai/employees）。
 * 失败/超时/形状异常 ⇒ error + 原因；真实空列表 ⇒ ready + 空分组（业务空态）。
 */
export async function loadAgentDirectory(): Promise<AgentDirectory> {
  try {
    const payload = await aiGet("/api/ai/employees");
    const parsed = parseEmployeeDirectoryPayload(payload);
    if (parsed.state === "error") return directoryError(parsed.message);
    return { state: "ready", groups: parsed.groups, message: parsed.message, enabledCount: parsed.enabledCount };
  } catch (err) {
    if (isTimeoutError(err)) return directoryError(`数字员工目录请求超时：${errorMessage(err)}`);
    return directoryError(`数字员工目录加载失败：${errorMessage(err)}`);
  }
}

/** 会话归档行 → 历史目录（纯函数，供网络装载器与 node 原生测试共用） */
export function parseHistoryConversationsPayload(payload: unknown): AgentDirectory {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return directoryError("历史会话返回形状异常（非对象）");
  }
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return directoryError("历史会话返回形状异常（items 非数组）");
  }

  const seen = new Set<string>();
  const staffs: DirectoryStaff[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const conversationId = String(row.sessionId ?? row.session_id ?? "").trim();
    if (!conversationId || seen.has(conversationId)) continue;
    seen.add(conversationId);

    const rawMessages = row.messagesJson ?? row.messages_json;
    const messages = Array.isArray(rawMessages)
      ? rawMessages.filter(
          (m): m is Record<string, unknown> =>
            Boolean(m) && typeof m === "object" && !Array.isArray(m),
        )
      : [];
    const firstUser = messages.find(
      (m) =>
        (m.role === "user" || m.role === "human") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    );
    const candidateTitle =
      typeof firstUser?.content === "string"
        ? firstUser.content.trim().replace(/\s+/g, " ").slice(0, 42)
        : "";
    const activeAt = String(
      row.endedAt ?? row.ended_at ?? row.createdAt ?? row.created_at ?? "",
    );
    const timeLabel = formatHistoryTime(activeAt);
    const fallbackTitle = timeLabel ? `会话 ${timeLabel}` : "历史会话";
    const messageCount = Number(row.messageCount ?? row.message_count ?? messages.length);
    const safeCount = Number.isFinite(messageCount) ? Math.max(0, messageCount) : messages.length;

    staffs.push({
      id: conversationId,
      conversationId,
      name: candidateTitle || fallbackTitle,
      post: "历史会话",
      summary: `${safeCount} 条消息${timeLabel ? ` · ${timeLabel}` : ""}`,
      online: null,
      unread: null,
    });
  }

  return {
    state: "ready",
    groups: staffs.length > 0 ? [{ name: "最近会话", staffs }] : [],
    message: staffs.length > 0 ? `${staffs.length} 个历史会话` : "暂无历史会话",
    enabledCount: staffs.length,
  };
}

function formatHistoryTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * 装载 AI 底座真实会话归档。
 * 空 items ⇒ ready + 空分组；失败/超时/形状异常 ⇒ error，不伪造历史。
 */
export async function loadHistoryConversations(): Promise<AgentDirectory> {
  try {
    const payload = await aiGet("/api/admin/session-archive?limit=40");
    return parseHistoryConversationsPayload(payload);
  } catch (err) {
    if (isTimeoutError(err)) return directoryError(`历史会话请求超时：${errorMessage(err)}`);
    return directoryError(`历史会话加载失败：${errorMessage(err)}`);
  }
}
