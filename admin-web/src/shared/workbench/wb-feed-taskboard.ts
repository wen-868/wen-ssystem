/**
 * 主管动作队列数据适配（WORKBENCH-10-F1 · 区域 B · 块 4）
 *
 * 原型锚点：任务看板 / 主管视图（L6834 / L6894）——按状态分组（进行中 / 待审阅 / 已完成），
 * 主管视图聚合「看板 + 绩效面板 + 审批中心 + 播报」。原型 BOARD 里的人名、单号、金额
 * 全部是演示数据，不进入实现。
 *
 * 真实数据源（契约出处逐字核对，非猜测）：
 *   - `GET {AI_BASE}/api/ai/agent/plans` ⇒ `{ success, total, items: ExecutionPlan[] }`
 *     （ZXQL-AI `src/gateway/agent.controller.ts:159-170`；`ExecutionPlan` 形状见
 *     `src/brain/agent/agent.types.ts:68-89`：`{ id, goal, steps[], state, createdBy? }`）；
 *   - 步骤/计划六态契约与 `shared/workbench/agent-metrics.ts` 一致
 *     （pending/running/success/failed/suspended/skipped）。
 *   - 「待审阅」桶由确认链（审批区块）在视图层并入本队列聚合——审批卡来自
 *     `wb-feed-approvals.ts`，这里不重复计数、不发明条目。
 * 「助理绩效」面板（处理项/拦截/采纳率）无端点 ⇒ 队列聚合行如实显示「未接线」。
 *
 * 分组口径（不猜）：
 *   - run   进行中：state ∈ {pending, running}
 *   - review 待审阅：state = suspended（挂起待人工确认）
 *   - done  已完成：state ∈ {success, failed, skipped}（终态；failed 如实标注失败）
 *   - 未知 state 值不并入任何桶，只如实计数披露。
 */
import { classifyFeedError, type FeedBlock, isFeedObject } from "./wb-feed-types";

/** 底座六态（唯一契约源：ZXQL-AI agent.types.ts；与 agent-metrics.ts 相同清单，本地复制避免重依赖链） */
const PLAN_STATUSES: readonly string[] = ["pending", "running", "success", "failed", "suspended", "skipped"];

export type WbQueueBucket = "run" | "review" | "done";

export interface WbQueueEntry {
  /** 计划 ID（真实主键；无 ID 的行直接丢弃，不造行号） */
  id: string;
  /** 任务标题：goal（服务端原文）；缺失 ⇒ 「计划 #id」 */
  title: string;
  /** 发起数字员工标识：createdBy 原样展示；缺失 ⇒ null（不写假名字） */
  agent: string | null;
  bucket: WbQueueBucket;
  /** 原始六态（UI 副标可展示真实状态词） */
  rawState: string;
  stepsDone: number;
  stepsTotal: number;
}

export interface WbQueueGroup {
  key: WbQueueBucket;
  label: string;
  entries: WbQueueEntry[];
}

export interface WbTaskBoard {
  groups: WbQueueGroup[];
  /** 未知状态计数（如实披露，不静默吞） */
  unknownStates: number;
  totalEntries: number;
}

export interface WbTaskBoardDeps {
  /** 注入计划列表读取器（视图走 AI 底座 GET /api/ai/agent/plans）；未注入 ⇒ unavailable */
  fetchPlans?: () => Promise<unknown>;
}

function normalize(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return PLAN_STATUSES.includes(s) ? s : null;
}

function bucketOf(state: string): WbQueueBucket {
  if (state === "suspended") return "review";
  if (state === "success" || state === "failed" || state === "skipped") return "done";
  return "run";
}

/** 纯折算：plans 载荷 ⇒ 分组队列（可单测，不发请求） */
export function parseWbTaskBoard(payload: unknown): FeedBlock<WbTaskBoard> {
  const emptyBoard: WbTaskBoard = {
    groups: [
      { key: "run", label: "进行中", entries: [] },
      { key: "review", label: "待审阅", entries: [] },
      { key: "done", label: "已完成", entries: [] },
    ],
    unknownStates: 0,
    totalEntries: 0,
  };
  if (!isFeedObject(payload)) {
    return { state: "error", data: emptyBoard, message: "任务队列响应形状异常（非对象）" };
  }
  if (payload.success === false) {
    return {
      state: "error",
      data: emptyBoard,
      message: `任务队列读取失败：${String(payload.error ?? "底座返回 success=false")}`,
    };
  }
  if (!Array.isArray(payload.items)) {
    return { state: "error", data: emptyBoard, message: "任务队列响应形状异常（缺少 items 数组）" };
  }
  const rows = (payload.items as unknown[]).filter((row): row is Record<string, unknown> => isFeedObject(row));

  const groups: WbQueueGroup[] = [
    { key: "run", label: "进行中", entries: [] },
    { key: "review", label: "待审阅", entries: [] },
    { key: "done", label: "已完成", entries: [] },
  ];
  let unknownStates = 0;
  for (const plan of rows) {
    const rawState = String(plan.state ?? "").trim();
    const state = normalize(plan.state);
    if (state === null) {
      unknownStates += 1; // 不认识的枚举不猜桶位，只如实计数
      continue;
    }
    const id = String(plan.id ?? "").trim();
    if (!id) continue; // 无主键无法回跳处理 ⇒ 不渲染不可操作条目
    const goal = String(plan.goal ?? "").trim();
    const steps = Array.isArray(plan.steps) ? plan.steps.filter((s): s is Record<string, unknown> => isFeedObject(s)) : [];
    const stepsDone = steps.filter((s) => normalize(s.status) === "success").length;
    const bucket = bucketOf(state);
    groups
      .find((g) => g.key === bucket)!
      .entries.push({
        id,
        title: goal || `计划 #${id}`,
        agent: String(plan.createdBy ?? "").trim() || null,
        bucket,
        rawState: rawState || state,
        stepsDone,
        stepsTotal: steps.length,
      });
  }

  const totalEntries = groups.reduce((sum, g) => sum + g.entries.length, 0);
  if (totalEntries === 0) {
    return {
      state: "empty",
      data: { groups, unknownStates, totalEntries },
      message: rows.length > 0 ? "存在计划但均无可分组状态（未知状态如实计数）" : "当前没有数字员工任务计划（真实空列表）",
    };
  }
  return { state: "ready", data: { groups, unknownStates, totalEntries }, message: "" };
}

/**
 * 装载主管动作队列。判定「真实 vs 未接线」的关键行是 `if (!deps.fetchPlans)`：
 * 视图注入底座计划读取器才走真数据；404 经 classifyFeedError 同样落 unavailable。
 */
export async function loadWbTaskBoard(deps: WbTaskBoardDeps = {}): Promise<FeedBlock<WbTaskBoard>> {
  if (!deps.fetchPlans) {
    return {
      state: "unavailable",
      data: {
        groups: [
          { key: "run", label: "进行中", entries: [] },
          { key: "review", label: "待审阅", entries: [] },
          { key: "done", label: "已完成", entries: [] },
        ],
        unknownStates: 0,
        totalEntries: 0,
      },
      message: "主管动作队列暂不可用：计划数据读取器未就绪（/api/ai/agent/plans）",
    };
  }
  try {
    const raw = await deps.fetchPlans();
    return parseWbTaskBoard(raw);
  } catch (err) {
    return classifyFeedError(err, "主管动作队列", {
      groups: [],
      unknownStates: 0,
      totalEntries: 0,
    });
  }
}
