/**
 * 数字员工目录 / 历史会话数据适配（WORKBENCH-PROTOTYPE-12-S1 · 父审计 D06/D07/D11）
 *
 * **真实端点（ai-base 源码直读，非猜测）**：
 *   - `GET {AI_BASE}/api/ai/employees` → 裸数组
 *     （ai-base `src/brain/employee/employee.controller.ts:103`，service.list 只回 status=1 启用员工；
 *       行字段：{ id, employeeUid, name, post, department, dispatchUids, status: '管理岗'|'就绪' }）
 *   - **无 online 字段**（父审计 D07 MISSING）：只能显示"N 名员工已启用"，
 *     绝不显示 N/M 在线、不用 status=1 冒充 online —— `online` 恒 null，UI 不画伪状态点。
 *   - 历史会话：**无列表端点**（父审计 D11 MISSING）⇒ 恒 unavailable，不渲染历史区。
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
      name,
      post: String(r.post ?? ""),
      // 底座真实字段只有 department/post；summary 用部门（不生成虚构简介）
      summary: String(r.department ?? ""),
      online: null, // D07：无 online 真源 ⇒ null，绝不冒充
      unread: null,
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

/** 未接入时的历史会话返回（D11 MISSING：结构化 unavailable，而非假数据） */
const HISTORY_UNAVAILABLE: AgentDirectory = {
  state: "unavailable",
  groups: [],
  message: "历史会话暂不可用：真实会话列表端点尚未落地，历史区不渲染",
  enabledCount: 0,
};

/** 目录/会话统一失败返回 */
function directoryError(message: string): AgentDirectory {
  return { state: "error", groups: [], message, enabledCount: 0 };
}

/** AI 底座带超时 GET（与 task-center 同口径：8 秒，AbortError ⇒ 超时文案） */
async function aiGet(path: string): Promise<unknown> {
  const [{ AI_BASE_URL }, { useAuthStore }] = await Promise.all([
    import("../../api/ai"),
    import("../../stores/auth"),
  ]);
  const headers: Record<string, string> = { Accept: "application/json" };
  try {
    const token = useAuthStore().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* 无 Pinia/登录态：按匿名请求发出，由服务端裁决 */
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 8_000) : null;
  try {
    const resp = await fetch(`${AI_BASE_URL}${path}`, { method: "GET", headers, signal: controller?.signal });
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

/**
 * 历史会话：无列表端点（D11 MISSING）⇒ 恒 unavailable。
 * 不把本地内存中的当前会话列表伪装成历史记录（D11 production_rule）。
 */
export async function loadHistoryConversations(): Promise<AgentDirectory> {
  return HISTORY_UNAVAILABLE;
}
