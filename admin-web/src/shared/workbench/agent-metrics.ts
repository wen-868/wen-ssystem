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
// 六态枚举与计划解析的唯一契约实现位于 task-center.ts（顶层零依赖，可被 node 直测）；
// 本文件委托同一实现 ⇒ 顶部指标与任务中心消费同一份解析口径（同源）。
import { parsePlansPayloadForTaskCenter, normalizePlanStatus as normalizePlanStatusBase } from "./task-center";

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

/**
 * 计划折算结果。
 * 状态契约见本文件顶部（底座六态：pending/running/success/failed/suspended/skipped）。
 */
export interface AgentPlansMetric {
  state: AgentMetricState;
  /** 计划总数 */
  totalPlans: number | null;
  /** 进行中计划数：state ∉ {success, failed, skipped}（含 pending/running/suspended） */
  runningPlans: number | null;
  /** 步骤完成 C / 总步骤 T（有 steps 时才有值；完成只认 status='success'） */
  stepsDone: number | null;
  stepsTotal: number | null;
  error: string | null;
  /**
   * 非六态的未知状态计数（计划级 + 步骤级合计）。
   * 用于如实披露"后端出现了本端不认识的枚举"，而不是静默按某个桶计数。
   */
  unknownStates?: number;
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
  unknownStates: 0,
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

/**
 * AI 底座计划/步骤状态六态（契约源：ai-base `src/brain/agent/agent.types.ts:14-23`）：
 *   pending / running / success / failed / suspended / skipped；`PlanState = PlanStepStatus`。
 *
 * ⚠️ 唯一实现已收敛到 `task-center.ts`（含 WORKBENCH-06F1 修正：只认真实六态、
 *   不保留 done/completed 等虚构别名）；本文件 re-export 保持既有消费面不变
 *   （AgentStatusBar / ai-status-truth.spec.mjs），顶部指标与任务中心同源解析。
 */
/** 计划/步骤状态（六态，与底座逐字一致） */
export type PlanStepStatus = "pending" | "running" | "success" | "failed" | "suspended" | "skipped";

export const PLAN_STEP_STATUSES: readonly PlanStepStatus[] = [
  "pending",
  "running",
  "success",
  "failed",
  "suspended",
  "skipped",
];

/** 把任意原始值规范化为六态之一；非六态返回 null（未知状态不猜）——委托 task-center 唯一实现 */
export function normalizePlanStatus(raw: unknown): PlanStepStatus | null {
  return normalizePlanStatusBase(raw);
}

/**
 * 折算计划数据 —— 纯函数（解析委托 task-center.parsePlansPayloadForTaskCenter，同源）。
 * 终态口径同 task-center：success/failed/skipped 不计"进行中"；
 * `suspended` 挂起待人工 ⇒ 仍计入"进行中/需人工"一栏。
 *
 * 形状：`{ success, total, items[] }`；`success===false` ⇒ unknown（底座显式报错）。
 * 状态口径（严格按六态，不猜、不采用虚构别名）：
 *   - `runningPlans`：state ∉ {success, failed, skipped} ⇒ 计入（含 `pending`/`running`/`suspended`，
 *     其中 `suspended` 属"挂起待人工"，UI 另给提示文案）；
 *   - `stepsDone`：只数 `status === 'success'`；
 *   - `stepsTotal`：每个有效 step 都计入（含 `skipped`——它占一个步骤位，但不算完成）；
 *   - 未知状态值 **不计入任何桶**（不猜），但会在 `unknownStates` 里如实计数供 UI/证据披露。
 */
export function parsePlansPayload(payload: unknown): AgentPlansMetric {
  const empty: AgentPlansMetric = {
    state: "unknown",
    totalPlans: null,
    runningPlans: null,
    stepsDone: null,
    stepsTotal: null,
    error: null,
    unknownStates: 0,
  };
  if (!payload || typeof payload !== "object") {
    return { ...empty, error: "计划端点返回形状异常" };
  }
  const parsed = parsePlansPayloadForTaskCenter(payload);
  if (parsed.failed) {
    return { ...empty, error: parsed.errorMessage ?? "底座返回失败" };
  }
  if (parsed.kind === "unknown") {
    return { ...empty, error: "计划端点返回形状异常" };
  }
  return {
    state: "ready",
    totalPlans: parsed.totalPlans,
    runningPlans: parsed.runningPlans,
    // 没有任何 steps ⇒ 步骤口径不可得，置 null（UI 只显示"进行中计划 N"，不显示 0/0）
    stepsDone: parsed.stepsTotal > 0 ? parsed.stepsDone : null,
    stepsTotal: parsed.stepsTotal > 0 ? parsed.stepsTotal : null,
    error: null,
    unknownStates: parsed.unknownStates,
  };
}

/** 失败/超时原因文案（超时显式标注，与普通失败区分） */
function metricErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "AbortError" || name === "TimeoutError" || /timeout|timed?\s*out|超时/i.test(message)) {
    return `请求超时：${message || "上游未在时限内响应"}`;
  }
  return message || "请求失败";
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
      error: metricErrorMessage(error),
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
      error: metricErrorMessage(error),
      unknownStates: 0,
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
    unknownStates: 0,
  };
}
