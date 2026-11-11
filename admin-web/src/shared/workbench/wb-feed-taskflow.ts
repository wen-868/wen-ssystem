/**
 * 任务步进数据适配（WORKBENCH-10-F1 · 区域 B · 块 5 · V24 TASKFLOW 门控步进）
 *
 * 原型锚点：V24 TASKFLOW（L11711 起）；步进链渲染器 L1810-1817 区域同语义：
 * `.act24-steps` 内 `.act24-st done|wait|lock`，以 `.act24-arrow`（→）相连，
 * 三态标记 `√ 已完成 / ● 进行中 / 🔒 未解锁`；原型自检（L12105）对样例期望
 * done=1 / wait=1 / lock=3 且锁标在位。
 *
 * 真实数据源：`GET {AI_BASE}/api/ai/agent/plans` 的 `ExecutionPlan.steps[]`
 * （六态 pending/running/success/failed/suspended/skipped，契约见
 * ZXQL-AI `src/brain/agent/agent.types.ts`；六态清单与 agent-metrics.ts 相同，
 * 本地复制避免重依赖链）。
 *
 * 门控折算规则（V24 §A：每个环节完成对应操作才解锁下一步）：
 *   - done（√）  = status === "success" 且位于首个未完成环节之前；
 *   - wait（●）  = 首个未完成环节（含 running/pending/suspended/failed/未知 ——
 *                  未解锁语义下它就是当前要处理的环节，failed 在标签里如实标注）；
 *   - lock（🔒）= wait 之后的所有环节（未解锁）。
 *   全部 success ⇒ 无 wait，整链 done +「全链完成」。
 * 不虚构环节名（取 step.label 原文）、不虚构进度。
 */
import { classifyFeedError, type FeedBlock, isFeedObject } from "./wb-feed-types";

const PLAN_STATUSES: readonly string[] = ["pending", "running", "success", "failed", "suspended", "skipped"];

export type WbStepMark = "done" | "wait" | "lock";

export interface WbFlowStep {
  key: string;
  /** 环节名（step.label 原文；缺失 ⇒ 「环节 N」如实序号，不编名字） */
  label: string;
  /** 三态 class（对齐原型 act24-st done|wait|lock） */
  cls: WbStepMark;
  /** 三态标记：√ / ● / 🔒 */
  mark: "√" | "●" | "🔒";
  /** 原始六态（UI title 提示用，失败环节可据此说明） */
  rawStatus: string;
}

export interface WbTaskFlow {
  id: string;
  /** 流程标题 = plan.goal 原文 */
  title: string;
  steps: WbFlowStep[];
  /** 完成计数（只认 success） */
  doneCount: number;
  /** 状态标签：进行中 x/y / 全链完成 · 证据齐备 / 已中断 x/y */
  statusText: string;
}

export interface WbTaskFlowDeps {
  /** 注入计划列表读取器；未注入 ⇒ unavailable */
  fetchPlans?: () => Promise<unknown>;
}

/** 单计划环节数组 ⇒ 三态步进（纯函数；done/wait/lock 判定唯一入口） */
export function deriveFlowSteps(stepsInput: readonly unknown[]): WbFlowStep[] {
  const steps = stepsInput.filter((s): s is Record<string, unknown> => isFeedObject(s));
  const statuses = steps.map((s) => {
    const raw = String(s.status ?? "").trim().toLowerCase();
    return { raw, known: PLAN_STATUSES.includes(raw), success: raw === "success" };
  });
  const gate = statuses.findIndex((s) => !s.success); // 首个未完成环节 = 门控点
  return steps.map((step, index) => {
    const cls: WbStepMark = gate === -1 ? "done" : index < gate ? "done" : index === gate ? "wait" : "lock";
    const raw = statuses[index].raw;
    const label = String(step.label ?? "").trim() || `环节 ${index + 1}`;
    return {
      key: String(step.id ?? `${index}`),
      label: raw === "failed" ? `${label}（失败）` : label,
      cls,
      mark: cls === "done" ? "√" : cls === "wait" ? "●" : "🔒",
      rawStatus: raw || "未知",
    };
  });
}

/** 纯折算：plans 载荷 ⇒ 步进流程列表（可单测，不发请求） */
export function parseWbTaskFlows(payload: unknown): FeedBlock<WbTaskFlow[]> {
  if (!isFeedObject(payload)) {
    return { state: "error", data: [], message: "任务步进响应形状异常（非对象）" };
  }
  if (payload.success === false) {
    return {
      state: "error",
      data: [],
      message: `任务步进读取失败：${String(payload.error ?? "底座返回 success=false")}`,
    };
  }
  if (!Array.isArray(payload.items)) {
    return { state: "error", data: [], message: "任务步进响应形状异常（缺少 items 数组）" };
  }
  const flows: WbTaskFlow[] = [];
  for (const plan of payload.items as unknown[]) {
    if (!isFeedObject(plan)) continue;
    const id = String(plan.id ?? "").trim();
    if (!id) continue;
    const steps = Array.isArray(plan.steps) ? deriveFlowSteps(plan.steps) : [];
    if (steps.length === 0) continue; // 无环节的计划画不出步进链 ⇒ 跳过（不造空链）
    const doneCount = steps.filter((s) => s.rawStatus === "success").length;
    const planState = String(plan.state ?? "").trim().toLowerCase();
    const finished = doneCount === steps.length;
    flows.push({
      id,
      title: String(plan.goal ?? "").trim() || `计划 #${id}`,
      steps,
      doneCount,
      statusText: finished
        ? "全链完成 · 证据齐备"
        : planState === "failed"
          ? `已中断 ${doneCount}/${steps.length}`
          : `进行中 ${doneCount}/${steps.length}`,
    });
  }
  if (flows.length === 0) {
    return { state: "empty", data: [], message: "暂无含环节的任务计划（步进链需至少 1 个环节，不画空链）" };
  }
  return { state: "ready", data: flows, message: "" };
}

/**
 * 装载任务步进。判定「真实 vs 待接入」的关键行是 `if (!deps.fetchPlans)`；
 * 404 ⇒ unavailable（classifyFeedError），其它失败 ⇒ error，均可重试。
 */
export async function loadWbTaskFlows(deps: WbTaskFlowDeps = {}): Promise<FeedBlock<WbTaskFlow[]>> {
  if (!deps.fetchPlans) {
    return {
      state: "unavailable",
      data: [],
      message: "任务步进暂不可用：计划数据读取器未就绪（/api/ai/agent/plans）",
    };
  }
  try {
    const raw = await deps.fetchPlans();
    return parseWbTaskFlows(raw);
  } catch (err) {
    return classifyFeedError(err, "任务步进", []);
  }
}
