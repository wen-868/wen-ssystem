/**
 * 顶部 Agent 真实数据（WORKBENCH-06F1 · B2 返工：员工数 + 任务进度）
 *
 * 凌舟验收 B2 已证伪 D-2「无真实端点」的前提：能力台账 `ai-06` 是 **PARTIAL**（不是 PLANNED），
 * AI 底座端点齐备 —— 见 ZXQL-AI 源码：
 *   - `GET /api/ai/employees`                     `src/brain/employee/employee.controller.ts:103`（列表）
 *   - `GET /api/ai/employees/:id/tasks`          同文件 `:130`（单员工任务）
 *   - `GET /api/ai/agent/plans`                  `src/gateway/agent.controller.ts:158`（计划列表）
 *   - `GET /api/ai/agent/plans/:id`              同文件 `:178`（计划详情含步骤六态）
 *
 * 本模块只做**取数与折算**，渲染在 `AgentStatusBar.vue`。硬规则（派单卡 §二.2 / §四）：
 *   1. 每个数据源**独立失败、独立降级**（员工挂了不影响计划，反之亦然）；
 *   2. 失败 ⇒ `unknown`，**不显示假 0**、不复用旧缓存、不套用原型演示数字；
 *   3. **不得编造分母**：只拿到员工数而没有"在线"口径时，只显示「N 人就绪」，
 *      **绝不写 `N/M`**（底座没有 online 字段，online 是原型演示概念）；
 *   4. 计划进度按 `state` 与 `steps.status` 真实计算，口径写在 UI 上（「进行中计划 N」）。
 *
 * 数据形态（以底座源码为准，不靠猜测）：
 *   - `GET /api/ai/employees` 直接返回数组（controller `list()` 原样返回 service.list 结果）；
 *   - `GET /api/ai/agent/plans` 返回 `{ success, total, items[], error? }`。
 * 两者都做**形状容错**：不是期望形状 ⇒ 判 unknown（诚实降级），不瞎猜。
 */
import { ref } from "vue";
import { AI_BASE_URL } from "../../api/ai";
import { useAuthStore } from "../../stores/auth";

/** 单个数据源的状态（三态，与 UI 一一对应） */
export type AgentMetricState = "unknown" | "loading" | "ready";

export interface AgentEmployeesMetric {
  state: AgentMetricState;
  /** 真实员工数（state=ready 时有值；unknown 时必须为 null，禁止假 0） */
  count: number | null;
  /** 员工明细（供展开/调试；不参与顶部文案） */
  employees: readonly { id: number; name: string; post: string; department: string }[];
  /** 失败原因（unknown 时给出） */
  error: string | null;
}

/** 计划步骤六态在底座的定义见 agent.types.ts；这里按"已完成/总步数"折算，不预设具体枚举名 */
export interface AgentPlansMetric {
  state: AgentMetricState;
  /** 计划总数 */
  totalPlans: number | null;
  /** 进行中计划数（state 非终态） */
  runningPlans: number | null;
  /** 步骤完成 C / 总步骤 T（有 steps 时才有值） */
  stepsDone: number | null;
  stepsTotal: number | null;
  error: string | null;
}

export const agentEmployees = ref<AgentEmployeesMetric>({
  state: "unknown",
  count: null,
  employees: [],
  error: null,
});

export const agentPlans = ref<AgentPlansMetric>({
  state: "unknown",
  totalPlans: null,
  runningPlans: null,
  stepsDone: null,
  stepsTotal: null,
  error: null,
});

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  // 取登录态失败（Pinia 未激活 / 首屏早期）**不得让整个请求发不出去**：
  // 探针与指标是只读 GET，无 token 时也应发出并由底座回 401（真实降级），
  // 而不是在客户端静默吞掉请求 ⇒ 否则 UI 只能显示"未知"却查不到原因。
  try {
    const token = useAuthStore().token;
    if (token) headers.Authorization = `Bearer ${token}`; // 底座按 JWT 解析租户
  } catch {
    /* 无 Pinia / 无登录态：按匿名请求发出，由服务端裁决 */
  }
  return headers;
}

/** 统一的带超时 GET（失败即抛，由调用方转 unknown） */
async function fetchJson(path: string, timeoutMs = 8_000): Promise<unknown> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const resp = await fetch(`${AI_BASE_URL}${path}`, {
      method: "GET",
      headers: authHeaders(),
      signal: controller?.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as unknown;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 折算员工数据 —— 纯函数（可单测，不依赖网络）。
 *
 * 形状：数组 ⇒ ready；空数组 ⇒ ready 且 count=0（**真空是真实结果，不是失败**）；
 * 非数组 ⇒ unknown（诚实降级）。
 */
export function parseEmployeesPayload(payload: unknown): AgentEmployeesMetric {
  if (!Array.isArray(payload)) {
    return { state: "unknown", count: null, employees: [], error: "员工端点返回形状异常" };
  }
  const employees = payload
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: Number(row.id ?? 0),
      name: String(row.name ?? ""),
      post: String(row.post ?? ""),
      department: String(row.department ?? ""),
    }))
    .filter((row) => row.id > 0 || row.name.length > 0);
  return { state: "ready", count: employees.length, employees, error: null };
}

/** 底座计划终态（用于算"进行中"；未识别的状态按非终态计，避免把进行中算丢） */
const TERMINAL_PLAN_STATES = new Set(["done", "completed", "succeeded", "failed", "cancelled", "canceled", "rejected", "aborted"]);

/**
 * 折算计划数据 —— 纯函数。
 *
 * 形状：`{ success, total, items[] }`；`success===false` ⇒ unknown（底座显式报错）。
 * 步骤统计：`steps[].status` 中"完成"口径 = done/completed/succeeded（与底座步骤枚举一致处即算完成）；
 * 若某计划无 steps（如纯计划态），该计划的步骤不计入分母（不编造 T）。
 */
export function parsePlansPayload(payload: unknown): AgentPlansMetric {
  const empty: AgentPlansMetric = {
    state: "unknown",
    totalPlans: null,
    runningPlans: null,
    stepsDone: null,
    stepsTotal: null,
    error: null,
  };
  if (!payload || typeof payload !== "object") {
    return { ...empty, error: "计划端点返回形状异常" };
  }
  const obj = payload as { success?: unknown; total?: unknown; items?: unknown; error?: unknown };
  if (obj.success === false) {
    return { ...empty, error: typeof obj.error === "string" ? obj.error : "底座返回失败" };
  }
  if (!Array.isArray(obj.items)) {
    return { ...empty, error: "计划端点返回形状异常" };
  }
  const items = obj.items.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  const totalPlans = typeof obj.total === "number" ? obj.total : items.length;

  let running = 0;
  let stepsDone = 0;
  let stepsTotal = 0;
  for (const plan of items) {
    const state = String(plan.state ?? "").toLowerCase();
    if (!TERMINAL_PLAN_STATES.has(state)) running += 1;
    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      stepsTotal += 1;
      const stepStatus = String((step as { status?: unknown }).status ?? "").toLowerCase();
      if (stepStatus === "done" || stepStatus === "completed" || stepStatus === "succeeded") stepsDone += 1;
    }
  }
  return {
    state: "ready",
    totalPlans,
    runningPlans: running,
    // 没有任何 steps ⇒ 步骤口径不可得，置 null（UI 只显示"进行中计划 N"，不显示 0/0）
    stepsDone: stepsTotal > 0 ? stepsDone : null,
    stepsTotal: stepsTotal > 0 ? stepsTotal : null,
    error: null,
  };
}

/** 拉取员工真实数据（失败 ⇒ unknown + 原因，绝不假 0） */
export async function loadAgentEmployees(): Promise<void> {
  agentEmployees.value = { ...agentEmployees.value, state: "loading", error: null };
  try {
    const payload = await fetchJson("/api/ai/employees");
    agentEmployees.value = parseEmployeesPayload(payload);
  } catch (error) {
    agentEmployees.value = {
      state: "unknown",
      count: null,
      employees: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** 拉取计划真实数据（失败 ⇒ unknown + 原因） */
export async function loadAgentPlans(): Promise<void> {
  agentPlans.value = { ...agentPlans.value, state: "loading", error: null };
  try {
    const payload = await fetchJson("/api/ai/agent/plans");
    agentPlans.value = parsePlansPayload(payload);
  } catch (error) {
    agentPlans.value = {
      state: "unknown",
      totalPlans: null,
      runningPlans: null,
      stepsDone: null,
      stepsTotal: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** 两个数据源并行各自独立降级（一个失败不影响另一个） */
export async function loadAgentTopMetrics(): Promise<void> {
  await Promise.all([loadAgentEmployees(), loadAgentPlans()]);
}

/** 仅供测试重置（不参与生产逻辑） */
export function __resetAgentMetricsForTest(): void {
  agentEmployees.value = { state: "unknown", count: null, employees: [], error: null };
  agentPlans.value = {
    state: "unknown",
    totalPlans: null,
    runningPlans: null,
    stepsDone: null,
    stepsTotal: null,
    error: null,
  };
}
