/**
 * 任务中心统一 view-model（WORKBENCH-PROTOTYPE-12-S1 · 父审计 D05/D08/D09/D11/D12/D13）
 *
 * 契约出处（后端源码直读，非文档、非猜测）：
 *   - GET {AI_BASE}/api/chat/confirmations → `{ total, items }`
 *     （ai-base `src/gateway/chat.controller.ts:232-256`；空租户同样返回 `{ total: 0, items: [] }`）
 *     历史前端还处理过 `{ confirmations }` 包装与裸数组两种形态 ⇒ 三类形态均兼容；
 *     其余未知形态一律归 `unknown`，不硬猜（父审计 D05：总数以去重后的真实记录为准）。
 *   - GET {AI_BASE}/api/ai/employees/:id/tasks → 裸数组 `AiEmployeeTaskEntity[]`
 *     （ai-base `src/brain/employee/employee.controller.ts:130`；
 *       实体状态枚举注释：running/completed/failed，见 ai-employee.entity.ts）
 *   - GET {AI_BASE}/api/ai/agent/plans → `{ success, total, items }`
 *     （ai-base `src/gateway/agent.controller.ts:158`）
 *   - GET {AI_BASE}/api/ai/agent/plans/:id → `{ success, plan }`（同文件 `:178`，详情含步骤）
 *     计划/步骤状态六态：pending/running/success/failed/suspended/skipped
 *     （ai-base `src/brain/agent/agent.types.ts:14-23`，`PlanState = PlanStepStatus`）
 *   - GET /api/admin/notifications → `ok({ total, page, pageSize, records })`
 *     （backend `src/routes/notification.routes.ts:14` +
 *       `src/services/admin/notification-center.service.ts listNotifications`）
 *
 * 生产规则（父审计卡 production_rule，逐条落实）：
 *   - D05：待确认兼容 items / confirmations / 裸数组；总数以 items 去重后的真实记录为准；
 *     错误与空列表分离（unknown 形态 ⇒ error，空数组 ⇒ empty，绝不假 0）。
 *   - D08：员工任务 running/completed/failed 原样映射；未知状态不猜、单独计数。
 *   - D09：计划直接消费 ExecutionPlan.steps 六态；未知状态不猜。
 *   - D11：历史会话 MISSING ⇒ unavailable，不渲染（不把本地会话伪装成历史记录）。
 *   - D12：各数据源独立加载与失败隔离；顶部计数与列表消费同一份规范化结果
 *     （deriveTaskCenterCounts 只读各源已解析的 data，不另发请求、不另立口径）。
 *   - D13：通知走 REST；失败独立降级，不清空既有已读数据。
 *   - AI 底座（confirmations/员工任务/计划）不可达 ⇒ 只影响 AI 源自身状态，
 *     人工通知源照常加载（AI 失败不阻断人工页面，硬验收 4）。
 *
 * ⚠️ 纯度约定：本模块**顶层零依赖**（不 import vue / axios / pinia / ai.ts）。
 *     网络装载器在函数体内 dynamic import 真实 API 封装；
 *     因此 node 原生测试可直载本文件测解析函数（tests/prototype12-data-contracts.spec.mjs）。
 *     测试用形态样例测「解析函数本身」（解析器单测），不冒充真实接口成功；
 *     真实接口读数验证走 dev + 真实/transport 上游，另行留证。
 */

// ==================== 数据源状态模型（四态 + 不可用 + 空闲） ====================

/**
 * 单个数据源状态。
 * 硬验收 2：empty（真空）/ error（失败）/ timeout（超时）/ unavailable（业务不可用）
 * 与 ready 严格区分；绝不把失败渲染成假 0。
 */
export type TaskSourceStatus =
  | "idle"
  | "loading"
  | "empty"
  | "ready"
  | "error"
  | "timeout"
  | "unavailable";

/** 单数据源状态对象。每个数据源**独立持有**，不复用同一状态（硬验收 2 / D12）。 */
export interface TaskSourceState<T> {
  readonly key: string;
  readonly label: string;
  status: TaskSourceStatus;
  /** 解析后的规范化数据；非 ready/empty 时为 null（不保留旧缓存冒充新鲜） */
  data: T | null;
  /** 人类可读状态说明（empty/unavailable/error/timeout 时必有） */
  message: string;
  /** 失败原因（error/timeout 时给出） */
  error: string | null;
  /** 本轮取数完成时间（ISO）；null = 从未成功取数 */
  fetchedAt: string | null;
}

/** 构造空闲态数据源（每个源独立对象，禁止跨源复用） */
export function makeSource<T>(key: string, label: string): TaskSourceState<T> {
  return { key, label, status: "idle", data: null, message: "", error: null, fetchedAt: null };
}

/** 由既有状态派生加载态（清空旧数据与旧错误，不保留旧缓存） */
export function loadingOf<T>(prev: TaskSourceState<T>): TaskSourceState<T> {
  return { ...prev, status: "loading", data: null, message: "正在加载…", error: null, fetchedAt: null };
}

/**
 * 失败分类：超时与普通失败严格分态（硬验收 2 / D12 各源独立四态）。
 * 覆盖：fetch AbortController 中断（AbortError）、axios ECONNABORTED/ETIMEDOUT、
 * 上游响应体/消息中的超时字样。
 */
export function classifySourceFailure(err: unknown): { status: "error" | "timeout"; message: string } {
  const anyErr = err as { code?: unknown; name?: unknown; message?: unknown } | null;
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  const name = typeof anyErr?.name === "string" ? anyErr.name : "";
  const message = err instanceof Error ? err.message : String(err ?? "");
  const isTimeout =
    name === "AbortError" ||
    name === "TimeoutError" ||
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    /timeout|timed?\s*out|超时/i.test(message);
  if (isTimeout) {
    return { status: "timeout", message: `请求超时：${message || "上游未在时限内响应"}` };
  }
  return { status: "error", message: message || "请求失败" };
}

// ==================== 待确认列表（D05 · /api/chat/confirmations 三形态） ====================

/** 待确认列表承载行（与 api/ai.ts AiConfirmationItem 结构兼容；无索引签名） */
export type ConfirmationListRow = {
  confirmationId?: string;
  id?: string;
  operation?: string;
  operationLabel?: string;
  summary?: string;
  details?: Record<string, unknown>;
  toolName?: string;
  status?: string;
  preview?: {
    operation?: string;
    summary?: string;
    details?: Record<string, unknown>;
  };
  createdAt?: string | number;
  expiresAt?: string | number;
};

/** 待确认操作行（解析器侧：携带索引签名以容忍后端扩展字段） */
export interface AiConfirmationRow extends ConfirmationListRow {
  [key: string]: unknown;
}

/** 三类已知返回形态 + unknown（不硬猜） */
export type ConfirmationsPayloadKind = "items" | "confirmations" | "array" | "unknown";

export interface ParsedConfirmations {
  kind: ConfirmationsPayloadKind;
  /** 按 ID 去重后的真实记录（进入列表与计数的唯一数据集——同源） */
  items: AiConfirmationRow[];
  /** 顶部计数：= items.length（同一数据集派生，D05/硬验收 3） */
  total: number;
  /** 后端声明壳层 total（仅披露；与 items.length 不一致时不采用壳层值） */
  reportedTotal: number | null;
  /** 无 ID / 非对象被丢弃的行数（如实披露，不静默吞） */
  droppedRows: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * 底座现行待确认记录使用 operationLabel + preview.{operation,summary,details}，
 * 历史前端契约则使用 operation/summary/details。这里在唯一解析入口做兼容归一，
 * 保留原始字段并补齐消费字段，避免 UI 退化为“待确认操作”占位文案。
 */
function normalizeConfirmationRow(row: Record<string, unknown>): AiConfirmationRow {
  const preview = isRecord(row.preview) ? row.preview : null;
  const previewDetails = preview && isRecord(preview.details) ? preview.details : null;
  const details = isRecord(row.details) ? row.details : previewDetails;
  const operationLabel = optionalString(row.operationLabel);
  const previewOperation = preview ? optionalString(preview.operation) : undefined;
  const operation = optionalString(row.operation);
  const toolName = optionalString(row.toolName);
  const summary = optionalString(row.summary);
  const previewSummary = preview ? optionalString(preview.summary) : undefined;

  return {
    ...row,
    operation: operation ?? previewOperation ?? operationLabel ?? toolName,
    operationLabel,
    summary: summary ?? previewSummary,
    details: details ?? undefined,
    toolName,
    status: optionalString(row.status),
    preview:
      preview
        ? {
            operation: previewOperation,
            summary: previewSummary,
            details: previewDetails ?? undefined,
          }
        : undefined,
    createdAt:
      typeof row.createdAt === "string" || typeof row.createdAt === "number"
        ? row.createdAt
        : undefined,
    expiresAt:
      typeof row.expiresAt === "string" || typeof row.expiresAt === "number"
        ? row.expiresAt
        : undefined,
  };
}

/** 行去重 + 无 ID 丢弃（确认链入参必须有 ID，同 wb-feed-approvals 口径） */
function dedupeConfirmationRows(rows: unknown[]): { items: AiConfirmationRow[]; droppedRows: number } {
  const seen = new Set<string>();
  const items: AiConfirmationRow[] = [];
  let droppedRows = 0;
  for (const row of rows) {
    if (!isRecord(row)) {
      droppedRows += 1;
      continue;
    }
    const id = String(row.confirmationId ?? row.id ?? "").trim();
    if (!id) {
      droppedRows += 1; // 无 ID 无法进入确认链 ⇒ 不计（避免不可操作的假卡/假数）
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(normalizeConfirmationRow(row));
  }
  return { items, droppedRows };
}

/**
 * 待确认载荷解析（纯函数，三形态 + unknown）。
 * unknown ⇒ 调用方必须按 error 处理（api/ai.ts fetchAiConfirmations 据此抛错），
 * 绝不返回空数组把"解析不了"伪装成"没有待确认"。
 */
export function parseConfirmationsPayload(payload: unknown): ParsedConfirmations {
  const fromRows = (rows: unknown[], kind: ConfirmationsPayloadKind, reportedTotal: number | null): ParsedConfirmations => {
    const { items, droppedRows } = dedupeConfirmationRows(rows);
    return { kind, items, total: items.length, reportedTotal, droppedRows };
  };

  if (Array.isArray(payload)) return fromRows(payload, "array", null);
  if (isRecord(payload)) {
    if (Array.isArray(payload.items)) {
      // 现行底座契约：{ total, items }（chat.controller.ts:256）
      const reportedTotal = typeof payload.total === "number" ? payload.total : null;
      return fromRows(payload.items, "items", reportedTotal);
    }
    if (Array.isArray(payload.confirmations)) {
      // 历史前端兼容形态：{ confirmations } 包装
      return fromRows(payload.confirmations, "confirmations", null);
    }
  }
  return { kind: "unknown", items: [], total: 0, reportedTotal: null, droppedRows: 0 };
}

// ==================== 员工任务（D08 · /api/ai/employees/:id/tasks） ====================

/** 员工任务状态三态（ai-base ai-employee.entity.ts 状态列注释：running/completed/failed） */
export type EmployeeTaskStatus = "running" | "completed" | "failed";
export const EMPLOYEE_TASK_STATUSES: readonly EmployeeTaskStatus[] = ["running", "completed", "failed"];

/** 非三态的原始值归 null（不猜；由 unknownStatuses 如实计数） */
export function normalizeEmployeeTaskStatus(raw: unknown): EmployeeTaskStatus | null {
  if (typeof raw !== "string") return null;
  const lowered = raw.trim().toLowerCase();
  return (EMPLOYEE_TASK_STATUSES as readonly string[]).includes(lowered) ? (lowered as EmployeeTaskStatus) : null;
}

export interface ParsedEmployeeTask {
  id: number;
  task: string;
  status: EmployeeTaskStatus | null;
  resultSummary: string | null;
  dispatchedBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ParsedEmployeeTasks {
  kind: "array" | "unknown";
  tasks: ParsedEmployeeTask[];
  /** 按真实状态分桶计数（与 tasks 同一数据集派生） */
  counts: { running: number; completed: number; failed: number; unknown: number };
}

/** 员工任务载荷解析（裸数组；非数组 ⇒ unknown 不硬猜） */
export function parseEmployeeTasksPayload(payload: unknown): ParsedEmployeeTasks {
  const emptyCounts = { running: 0, completed: 0, failed: 0, unknown: 0 };
  if (!Array.isArray(payload)) {
    return { kind: "unknown", tasks: [], counts: emptyCounts };
  }
  const tasks: ParsedEmployeeTask[] = [];
  const counts = { ...emptyCounts };
  for (const row of payload) {
    if (!isRecord(row)) continue;
    const status = normalizeEmployeeTaskStatus(row.status);
    if (status === null) counts.unknown += 1;
    else counts[status] += 1;
    tasks.push({
      id: Number(row.id ?? 0),
      task: String(row.task ?? ""),
      status,
      resultSummary: typeof row.resultSummary === "string" && row.resultSummary.length > 0 ? row.resultSummary : null,
      dispatchedBy: String(row.dispatchedBy ?? "user"),
      createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
    });
  }
  return { kind: "array", tasks, counts };
}

// ==================== 计划/步骤六态（D09 · /api/ai/agent/plans[/:id]） ====================

/**
 * 计划/步骤状态六态——**唯一契约源**：ai-base `src/brain/agent/agent.types.ts:14-23`：
 *   pending（待执行）/ running（执行中）/ success（成功）/ failed（失败）/
 *   suspended（挂起待人工确认）/ skipped（跳过）；`PlanState = PlanStepStatus`。
 * 未知状态归 null，不猜、不造别名（WORKBENCH-06F1 既有结论）。
 */
export type PlanStepStatus = "pending" | "running" | "success" | "failed" | "suspended" | "skipped";
export const PLAN_STEP_STATUSES: readonly PlanStepStatus[] = [
  "pending",
  "running",
  "success",
  "failed",
  "suspended",
  "skipped",
];

export function normalizePlanStatus(raw: unknown): PlanStepStatus | null {
  if (typeof raw !== "string") return null;
  const lowered = raw.trim().toLowerCase();
  return (PLAN_STEP_STATUSES as readonly string[]).includes(lowered) ? (lowered as PlanStepStatus) : null;
}

/** 终态：success/failed/skipped 不计"进行中"；suspended 挂起待人工 ⇒ 仍计（需人处理） */
const TERMINAL_PLAN_STATES = new Set<PlanStepStatus>(["success", "failed", "skipped"]);

export interface ParsedPlanStep {
  id: string;
  label: string;
  type: string;
  status: PlanStepStatus | null;
  error: string | null;
}

export interface ParsedPlan {
  id: number;
  goal: string;
  state: PlanStepStatus | null;
  steps: ParsedPlanStep[];
  stepsTotal: number;
  stepsDone: number;
}

export interface ParsedPlans {
  kind: "items" | "unknown";
  /** 底座显式报错（success=false）⇒ failed=true，调用方按 error 处理 */
  failed: boolean;
  errorMessage: string | null;
  plans: ParsedPlan[];
  /** 进行中计划数（state ∉ 终态，含 pending/running/suspended；未知态不计） */
  runningPlans: number;
  totalPlans: number;
  stepsDone: number;
  stepsTotal: number;
  /** 计划级 + 步骤级未知状态合计（如实披露，不进任何桶） */
  unknownStates: number;
}

/**
 * 计划载荷解析（`{ success, total, items }`；success=false ⇒ failed 带原因）。
 * 步骤口径：完成只认 success；skipped 占步骤位但不计完成。
 */
export function parsePlansPayloadForTaskCenter(payload: unknown): ParsedPlans {
  const empty: ParsedPlans = {
    kind: "unknown",
    failed: false,
    errorMessage: null,
    plans: [],
    runningPlans: 0,
    totalPlans: 0,
    stepsDone: 0,
    stepsTotal: 0,
    unknownStates: 0,
  };
  if (!isRecord(payload)) return { ...empty, errorMessage: "计划端点返回形状异常" };
  if (payload.success === false) {
    return {
      ...empty,
      failed: true,
      errorMessage: typeof payload.error === "string" && payload.error.length > 0 ? payload.error : "底座返回失败",
    };
  }
  if (!Array.isArray(payload.items)) return { ...empty, errorMessage: "计划端点返回形状异常" };

  const plans: ParsedPlan[] = [];
  let runningPlans = 0;
  let stepsDone = 0;
  let stepsTotal = 0;
  let unknownStates = 0;
  for (const row of payload.items) {
    if (!isRecord(row)) continue;
    const state = normalizePlanStatus(row.state);
    if (state === null) unknownStates += 1;
    else if (!TERMINAL_PLAN_STATES.has(state)) runningPlans += 1;
    const steps: ParsedPlanStep[] = [];
    if (Array.isArray(row.steps)) {
      for (const step of row.steps) {
        if (!isRecord(step)) continue;
        stepsTotal += 1;
        const stepStatus = normalizePlanStatus(step.status);
        if (stepStatus === "success") stepsDone += 1;
        if (stepStatus === null) unknownStates += 1;
        steps.push({
          id: String(step.id ?? ""),
          label: String(step.label ?? ""),
          type: String(step.type ?? ""),
          status: stepStatus,
          error: typeof step.error === "string" && step.error.length > 0 ? step.error : null,
        });
      }
    }
    plans.push({
      id: Number(row.id ?? 0),
      goal: String(row.goal ?? ""),
      state,
      steps,
      stepsTotal: steps.length,
      stepsDone: steps.filter((s) => s.status === "success").length,
    });
  }
  return {
    kind: "items",
    failed: false,
    errorMessage: null,
    plans,
    runningPlans,
    totalPlans: typeof payload.total === "number" ? payload.total : plans.length,
    stepsDone,
    stepsTotal,
    unknownStates,
  };
}

// ==================== 通知（D13 · /api/admin/notifications） ====================

export interface ParsedNotification {
  id: number;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt: string | null;
}

export interface ParsedNotifications {
  kind: "payload" | "unknown";
  notifications: ParsedNotification[];
  /** 服务端分页总数（列表页口径见 total 口径注释；顶部计数用 notifications.length 同源） */
  total: number | null;
  page: number | null;
  pageSize: number | null;
}

/** 通知载荷解析（payload = axios `data.data` = `{ total, page, pageSize, records }`） */
export function parseNotificationsPayload(payload: unknown): ParsedNotifications {
  if (!isRecord(payload) || !Array.isArray(payload.records)) {
    return { kind: "unknown", notifications: [], total: null, page: null, pageSize: null };
  }
  const notifications: ParsedNotification[] = [];
  for (const row of payload.records) {
    if (!isRecord(row)) continue;
    notifications.push({
      id: Number(row.id ?? 0),
      title: String(row.title ?? ""),
      content: String(row.content ?? ""),
      type: String(row.type ?? ""),
      isRead: row.isRead === true || row.isRead === 1,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    });
  }
  return {
    kind: "payload",
    notifications,
    total: typeof payload.total === "number" ? payload.total : null,
    page: typeof payload.page === "number" ? payload.page : null,
    pageSize: typeof payload.pageSize === "number" ? payload.pageSize : null,
  };
}

// ==================== 装载器（dynamic import，保持本模块顶层零依赖） ====================

/** AI 底座只读 GET 的统一超时（毫秒）；超时 ⇒ timeout 态（与 error 区分） */
const AI_FETCH_TIMEOUT_MS = 8_000;

/** AI 底座请求头：JWT 注入租户上下文；无登录态时按匿名发出由服务端裁决（同 agent-metrics 口径） */
async function aiAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  try {
    const { useAuthStore } = await import("../../stores/auth");
    const token = useAuthStore().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* 无 Pinia/登录态：按匿名请求发出，由服务端裁决 */
  }
  return headers;
}

/** AI 底座带超时 GET（失败即抛，由各源独立转 error/timeout） */
async function aiGet(path: string): Promise<unknown> {
  const { AI_BASE_URL } = await import("../../api/ai");
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS) : null;
  try {
    const resp = await fetch(`${AI_BASE_URL}${path}`, { method: "GET", headers: await aiAuthHeaders(), signal: controller?.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as unknown;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ==================== 任务中心聚合状态（D12：各源独立对象） ====================

export interface TaskCenterSnapshot {
  /** 待确认（AI 底座 /api/chat/confirmations） */
  confirmations: TaskSourceState<ConfirmationListRow[]>;
  /** 员工任务（AI 底座 /api/ai/employees/:id/tasks；按选中员工加载） */
  employeeTasks: TaskSourceState<ParsedEmployeeTask[]>;
  /** 执行计划（AI 底座 /api/ai/agent/plans） */
  plans: TaskSourceState<ParsedPlan[]>;
  /** 通知（主后端 /api/admin/notifications，人工页面源） */
  notifications: TaskSourceState<ParsedNotification[]>;
  /** 历史会话（父审计 D11 MISSING ⇒ 恒 unavailable，不发请求） */
  historySessions: TaskSourceState<ParsedNotification[]>;
}

/** 五个数据源**各自独立**的状态对象（互不复用，硬验收 2/D12） */
export const taskCenterSnapshot: TaskCenterSnapshot = {
  confirmations: makeSource("confirmations", "待确认"),
  employeeTasks: makeSource("employeeTasks", "员工任务"),
  plans: makeSource("plans", "执行计划"),
  notifications: makeSource("notifications", "通知"),
  historySessions: makeSource("historySessions", "历史会话"),
};

function applyReady<T>(source: TaskSourceState<T>, data: T, emptyMessage: string, isEmpty: boolean): void {
  if (isEmpty) {
    source.status = "empty";
    source.data = data; // 空列表本身是真实结果，列表与计数同源展示
    source.message = emptyMessage;
    source.error = null;
  } else {
    source.status = "ready";
    source.data = data;
    source.message = "";
    source.error = null;
  }
  source.fetchedAt = new Date().toISOString();
}

function applyFailure<T>(source: TaskSourceState<T>, err: unknown): void {
  const { status, message } = classifySourceFailure(err);
  source.status = status;
  source.data = null; // 失败不保留旧缓存冒充新鲜（agent-metrics 同口径）
  source.message = message;
  source.error = message;
}

/** 拉取待确认（独立失败隔离；unknown 形态按 error 处理，不假 0） */
export async function loadConfirmationsSource(): Promise<TaskSourceState<ConfirmationListRow[]>> {
  const source = taskCenterSnapshot.confirmations;
  Object.assign(source, loadingOf(source));
  try {
    const { fetchAiConfirmations } = await import("../../api/ai");
    const rows = await fetchAiConfirmations();
    if (!Array.isArray(rows)) throw new Error("待确认列表响应形状异常");
    applyReady(source, rows, "当前没有等待确认的 AI 写操作（真实空列表）", rows.length === 0);
  } catch (err) {
    applyFailure(source, err);
  }
  return source;
}

/** 拉取指定员工的任务（D08：单员工失败只降级该源） */
export async function loadEmployeeTasksSource(employeeId: number): Promise<TaskSourceState<ParsedEmployeeTask[]>> {
  const source = taskCenterSnapshot.employeeTasks;
  Object.assign(source, loadingOf(source));
  try {
    const payload = await aiGet(`/api/ai/employees/${encodeURIComponent(String(employeeId))}/tasks`);
    const parsed = parseEmployeeTasksPayload(payload);
    if (parsed.kind === "unknown") throw new Error("员工任务端点返回形状异常（非数组）");
    applyReady(source, parsed.tasks, "该员工暂无任务（真实空列表）", parsed.tasks.length === 0);
  } catch (err) {
    applyFailure(source, err);
  }
  return source;
}

/** 拉取执行计划列表（D09：六态；success=false ⇒ error 带底座原因） */
export async function loadPlansSource(): Promise<TaskSourceState<ParsedPlan[]>> {
  const source = taskCenterSnapshot.plans;
  Object.assign(source, loadingOf(source));
  try {
    const payload = await aiGet("/api/ai/agent/plans");
    const parsed = parsePlansPayloadForTaskCenter(payload);
    if (parsed.failed) throw new Error(parsed.errorMessage ?? "底座返回失败");
    if (parsed.kind === "unknown") throw new Error("计划端点返回形状异常");
    applyReady(source, parsed.plans, "当前没有执行计划（真实空列表）", parsed.plans.length === 0);
  } catch (err) {
    applyFailure(source, err);
  }
  return source;
}

/** 拉取通知（主后端人工页面源；AI 故障不影响本源） */
export async function loadNotificationsSource(): Promise<TaskSourceState<ParsedNotification[]>> {
  const source = taskCenterSnapshot.notifications;
  Object.assign(source, loadingOf(source));
  try {
    const { api } = await import("../../api/request");
    const resp = await api.get("/admin/notifications", { params: { page: 1, pageSize: 20 } });
    const body = resp.data as { code?: unknown; msg?: unknown; data?: unknown } | undefined;
    if (body && typeof body === "object" && typeof body.code === "string" && body.code !== "0") {
      throw new Error(typeof body.msg === "string" && body.msg ? body.msg : "通知接口返回失败");
    }
    const parsed = parseNotificationsPayload(body?.data);
    if (parsed.kind === "unknown") throw new Error("通知端点返回形状异常（缺 records）");
    applyReady(source, parsed.notifications, "当前没有通知（真实空列表）", parsed.notifications.length === 0);
  } catch (err) {
    applyFailure(source, err);
  }
  return source;
}

/**
 * 历史会话：父审计 D11 MISSING —— 无真实列表端点前**恒 unavailable 且不发请求**。
 * 不把本地内存中的当前会话列表伪装成历史记录（D11 production_rule）。
 */
export function markHistorySessionsUnavailable(): TaskSourceState<ParsedNotification[]> {
  const source = taskCenterSnapshot.historySessions;
  source.status = "unavailable";
  source.data = null;
  source.message = "历史会话暂不可用：真实会话列表端点尚未落地，历史区不渲染";
  source.error = null;
  source.fetchedAt = null;
  return source;
}

/**
 * 聚合装载：五个源并行、彼此独立（Promise.allSettled），任何一个失败不影响其余源，
 * 也不抛出——AI 底座整体不可达时 notifications 源照常 ready（AI 失败不阻断人工页面）。
 */
export async function loadTaskCenterSnapshot(options?: { employeeId?: number }): Promise<TaskCenterSnapshot> {
  markHistorySessionsUnavailable();
  const jobs: Array<Promise<unknown>> = [
    loadConfirmationsSource(),
    loadPlansSource(),
    loadNotificationsSource(),
    typeof options?.employeeId === "number"
      ? loadEmployeeTasksSource(options.employeeId)
      : Promise.resolve(markEmployeeTasksIdle()),
  ];
  await Promise.allSettled(jobs);
  return taskCenterSnapshot;
}

/** 未指定员工时员工任务源保持 idle（不算失败、不算空） */
function markEmployeeTasksIdle(): TaskSourceState<ParsedEmployeeTask[]> {
  const source = taskCenterSnapshot.employeeTasks;
  source.status = "idle";
  source.data = null;
  source.message = "未选择员工";
  source.error = null;
  return source;
}

// ==================== 顶部计数（D12：与列表同源派生，不另发请求） ====================

export interface TaskCenterCounts {
  /** 待确认数（去重后真实记录数）；非 ready/empty ⇒ null（不假 0） */
  confirmations: number | null;
  /** 员工任务总数 / 运行中数（当前选中员工） */
  employeeTasks: number | null;
  employeeTasksRunning: number | null;
  /** 进行中计划数 / 计划总数 */
  plansRunning: number | null;
  plansTotal: number | null;
  /** 通知数（当前列表同源） */
  notifications: number | null;
}

/**
 * 顶部计数：**只读各源已解析的 data**（同一数据集派生，硬验收 3）。
 * ready 与 empty 都给真实数字（empty 的 0 是真空，不是假 0）；
 * error/timeout/unavailable/idle ⇒ null，UI 不展示（不显示假 0）。
 */
export function deriveTaskCenterCounts(s: TaskCenterSnapshot = taskCenterSnapshot): TaskCenterCounts {
  const countOf = (source: TaskSourceState<unknown>): number | null => {
    if (source.status !== "ready" && source.status !== "empty") return null;
    return Array.isArray(source.data) ? source.data.length : null;
  };
  const runningOf = (source: TaskSourceState<ParsedEmployeeTask[]>): number | null => {
    if (source.status !== "ready" && source.status !== "empty" || !Array.isArray(source.data)) return null;
    return source.data.filter((t) => t.status === "running").length;
  };
  const plansRunningOf = (source: TaskSourceState<ParsedPlan[]>): number | null => {
    if (source.status !== "ready" && source.status !== "empty" || !Array.isArray(source.data)) return null;
    return source.data.filter((p) => p.state !== null && !TERMINAL_PLAN_STATES.has(p.state)).length;
  };
  return {
    confirmations: countOf(s.confirmations),
    employeeTasks: countOf(s.employeeTasks),
    employeeTasksRunning: runningOf(s.employeeTasks),
    plansRunning: plansRunningOf(s.plans),
    plansTotal: countOf(s.plans),
    notifications: countOf(s.notifications),
  };
}

// ==================== 测试辅助 ====================

/** 仅供测试重置（不参与生产逻辑） */
export function __resetTaskCenterForTest(): void {
  taskCenterSnapshot.confirmations = makeSource("confirmations", "待确认");
  taskCenterSnapshot.employeeTasks = makeSource("employeeTasks", "员工任务");
  taskCenterSnapshot.plans = makeSource("plans", "执行计划");
  taskCenterSnapshot.notifications = makeSource("notifications", "通知");
  taskCenterSnapshot.historySessions = makeSource("historySessions", "历史会话");
}
