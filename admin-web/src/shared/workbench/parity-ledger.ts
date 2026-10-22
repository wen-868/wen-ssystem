/**
 * 人工动作 ↔ AI 能力双向对等台账（WORKBENCH-03F1）
 *
 * 真相源（只读，不允许手改）：
 *   1. docs/evidence/WB-REFACTOR-P0/30-action-permission-matrix.md —— 254 行写动作（脚本逐行镜像）
 *   2. admin-web/src/shared/workbench/route-manifest.ts —— 80 个人工入口（71 人工 + 9 收银）
 * 生成：node admin-web/scripts/gen-parity-registry.mjs（产出 parity-*.generated.ts + parity-report.json）
 *
 * 状态判定（与生成脚本一致，矩阵列为唯一依据）：
 *   - LIVE     = AI 工具存在 且 走写确认链（预览→确认→执行→撤销）
 *   - PARTIAL  = AI 工具存在 但 未纳入确认链
 *   - PLANNED  = 无 AI 工具，但后端路由/权限可判定（可规划补齐）
 *   - BLOCKED  = 无 AI 工具，且前置依赖未满足（前端路径无后端注册/权限不可判）
 * 不允许“名称相似”推断映射：动作锚点一律取矩阵 actionId 原文，路由一律按组件路径精确匹配。
 */
import type {
  CapabilityEntry,
  CapabilityStatus,
  ParityActionRow,
  ParityManualEntry,
} from "./capability-types";
import { CAPABILITIES } from "./capability-registry";
import { domainLabel, STATUS_SEVERITY } from "./parity-domains";
import { PARITY_ACTION_ROWS } from "./parity-actions-gen";
import { PARITY_MANUAL_ENTRIES } from "./parity-manual-gen";
import type { ManifestItem } from "./types";

export { PARITY_ACTION_ROWS, PARITY_MANUAL_ENTRIES };

export const STATUS_LABEL: Readonly<Record<CapabilityStatus, string>> = {
  LIVE: "已上线",
  PARTIAL: "部分接入",
  PLANNED: "待建设",
  BLOCKED: "阻塞",
};

// ── 动作行 → 能力 ──────────────────────────────────────────────────────────

function actionMissingReason(row: ParityActionRow): string | undefined {
  switch (row.status) {
    case "LIVE":
      return undefined;
    case "PARTIAL":
      return "AI 工具有端点但未纳入确认链（缺预览→确认→执行→撤销），不允许直接执行写操作";
    case "PLANNED":
      return "矩阵实测无 AI 工具：AI 底座未注册覆盖该接口的工具";
    case "BLOCKED":
      return "前置依赖未满足：该前端接口路径在本仓无对应后端路由注册，权限码/审计不可判定";
  }
}

function actionFallback(row: ParityActionRow): string {
  return `人工：${row.pages[0] ?? "对应页面"} 内该动作按钮（${row.method} ${row.apiPath}，页面直调）`;
}

function actionGain(row: ParityActionRow): string {
  return row.status === "LIVE"
    ? "AI 一句话发起 → 预览 → 确认执行（可撤销），人工免去表单填写"
    : "补齐后可由 AI 发起并走确认链；当前仍需人工在页面操作";
}

/** 动作能力 ID 前缀：act:<actionId>（与 AI 矩阵 id 空间隔离，避免互相冒充） */
export function actionCapabilityId(actionId: string): string {
  return `act:${actionId}`;
}

export function toActionCapability(row: ParityActionRow): CapabilityEntry {
  const ownerDomain = domainLabel(row.domain);
  return {
    id: actionCapabilityId(row.id),
    title: `${ownerDomain}｜${row.id}`,
    group: ownerDomain,
    status: row.status,
    realAction: `${row.method} ${row.apiPath}（权限码 ${row.permission}）`,
    missingReason: actionMissingReason(row),
    matrixRow: 0,
    manualRouteNames: row.routeNames,
    manualActionIds: [row.id],
    experienceGain: actionGain(row),
    manualFallback: actionFallback(row),
    ownerDomain,
  };
}

/** 254 项动作能力（与 30 矩阵逐行 1:1） */
export const ACTION_CAPABILITIES: readonly CapabilityEntry[] = PARITY_ACTION_ROWS.map(toActionCapability);

// ── AI 面 19 项能力 → 人工锚点或显式 AI_ONLY ───────────────────────────────

/** 走写确认链的动作行（ai-08 的真实动作锚点） */
const CONFIRM_CHAIN_ROWS = PARITY_ACTION_ROWS.filter((row) => row.confirmChain);

/** AI 原生能力（人工页面无对应按钮动作）必须显式给出理由 */
const AI_ONLY_REASONS: Readonly<Record<string, string>> = {
  "ai-01": "AI 会话入口，人工侧无对应按钮动作",
  "ai-02": "待确认列表拉取，人工侧在页面内直接操作，无独立入口",
  "ai-03": "主动信息流推送，人工侧无对应页面动作",
  "ai-04": "模型切换，人工侧无对应页面动作",
  "ai-05": "自然语言指令入口（复用 POST /api/chat），人工侧无指令注册表",
  "ai-06": "Agent 任务队列视图，人工侧无对应页面动作",
  "ai-07": "工具清单只读展示，人工侧无对应页面动作",
  "ai-09": "SSE 流式通道，人工侧无对应页面动作",
  "ai-10": "待确认列表找回入口，人工侧无对应页面动作",
  "ai-11": "AI 会话历史，人工侧无对应页面动作",
  "ai-12": "AI 会话新建/清空，人工侧无对应页面动作",
  "ai-13": "AI 语音输入，人工侧无对应页面动作",
  "ai-14": "AI 图片识别，人工侧无对应页面动作",
  "ai-15": "AI 工具调用可视化，人工侧无对应页面动作",
  "ai-16": "AI 多轮上下文，人工侧无对应页面动作",
  "ai-17": "AI 主动提醒偏好，人工侧无对应页面动作",
  "ai-18": "AI 租户上下文注入，人工侧无对应页面动作",
  "ai-19": "AI 审计回溯，人工侧无对应页面动作",
};

/** ai-08 确认链锚定到全部走确认链的写动作（矩阵事实，非名称相似） */
export const AI_CAPABILITY_ANCHORS: Readonly<Record<string, readonly string[]>> = {
  "ai-08": CONFIRM_CHAIN_ROWS.map((row) => row.id),
};

/** 19 项 AI 能力（原状态不变），补人工锚点 / AI_ONLY 标记 */
export const AI_CAPABILITIES: readonly CapabilityEntry[] = CAPABILITIES.map((entry) => {
  const actionIds = AI_CAPABILITY_ANCHORS[entry.id] ?? [];
  const routeNames = [
    ...new Set(
      PARITY_ACTION_ROWS.filter((row) => actionIds.includes(row.id)).flatMap((row) => row.routeNames),
    ),
  ].sort();
  const aiOnly = actionIds.length === 0 && routeNames.length === 0;
  return {
    ...entry,
    manualActionIds: actionIds,
    manualRouteNames: routeNames,
    aiOnly,
    aiOnlyReason: aiOnly ? (AI_ONLY_REASONS[entry.id] ?? "AI 原生能力，人工侧无对应页面动作") : undefined,
    ownerDomain: aiOnly ? "AI 底座" : "写动作确认链",
    manualFallback: aiOnly
      ? "人工：直接使用对应业务页面或在 AI 会话内继续操作"
      : "人工：在对应业务页面直接操作（不经 AI 确认链）",
    experienceGain: aiOnly
      ? "AI 原生体验，不替代人工页面动作"
      : "AI 代办写操作，人工只需预览确认，可 3 分钟内撤销",
  };
});

/** 全部能力：AI 面 19 + 动作 254 */
export const ALL_CAPABILITIES: readonly CapabilityEntry[] = [...AI_CAPABILITIES, ...ACTION_CAPABILITIES];

// ── 人工入口对等视图 ──────────────────────────────────────────────────────

export interface ManualParityView extends ParityManualEntry {
  /** 该入口对应的能力 ID（动作能力 + 相关 AI 能力） */
  capabilityIds: readonly string[];
  missingReason?: string;
  manualFallback: string;
  experienceGain: string;
}

function manualMissingReason(entry: ParityManualEntry): string | undefined {
  if (!entry.routeName) return "本地弹窗动作：无后端端点，AI 无对应工具";
  if (entry.actionCount === 0) return "该页面无写动作行（只读页）；AI 只读问答未逐页接入";
  switch (entry.status) {
    case "LIVE":
      return undefined;
    case "PARTIAL":
      return "该入口部分动作已有 AI 工具，其余动作未覆盖（逐行见动作台账）";
    case "BLOCKED":
      return "该入口存在前置依赖未满足的动作（接口未注册/权限不可判）";
    case "PLANNED":
      return "该入口所辖写动作均无 AI 工具，AI 侧待建设";
  }
}

function manualFallback(entry: ParityManualEntry): string {
  return entry.routeName
    ? `人工：${entry.ownerDomain} › ${entry.title}（页面直调，不经 AI）`
    : `人工：${entry.ownerDomain} › ${entry.title} 弹窗（本地动作，不经 AI）`;
}

/** 80 个人工入口对等视图（routeName/actionId → capabilityId 机器映射） */
export const MANUAL_PARITY: readonly ManualParityView[] = PARITY_MANUAL_ENTRIES.map((entry) => {
  const actionCapIds = entry.actionIds.map(actionCapabilityId);
  const aiCapIds = AI_CAPABILITIES.filter(
    (cap) => Boolean(entry.routeName) && (cap.manualRouteNames ?? []).includes(entry.routeName as string),
  ).map((cap) => cap.id);
  return {
    ...entry,
    capabilityIds: [...new Set([...actionCapIds, ...aiCapIds])],
    missingReason: manualMissingReason(entry),
    manualFallback: manualFallback(entry),
    experienceGain:
      entry.status === "LIVE"
        ? "该页全部写动作可由 AI 代办（走确认链）"
        : entry.status === "PARTIAL"
          ? "该页部分写动作可由 AI 代办"
          : "补齐后可由 AI 代办；当前仍需人工操作",
  };
});

// ── 对等汇总（UI 摘要 + 测试核对） ─────────────────────────────────────────

export interface ParityDomainEntry {
  menuCode: string;
  title: string;
  status: CapabilityStatus;
  missingReason?: string;
}

export interface ParityDomainSummary {
  domain: string;
  label: string;
  status: CapabilityStatus;
  actionCount: number;
  manualCount: number;
  statusCounts: Record<CapabilityStatus, number>;
  blockedReason?: string;
  manualFallback: string;
  /** 该域下的人工入口及各自 AI 状态（UI 可展开） */
  manualEntries: ParityDomainEntry[];
}

function emptyCounts(): Record<CapabilityStatus, number> {
  return { LIVE: 0, PARTIAL: 0, PLANNED: 0, BLOCKED: 0 };
}

const domains: ParityDomainSummary[] = (() => {
  const map = new Map<string, ParityDomainSummary>();
  for (const row of PARITY_ACTION_ROWS) {
    const current =
      map.get(row.domain) ??
      {
        domain: row.domain,
        label: domainLabel(row.domain),
        status: "LIVE" as CapabilityStatus,
        actionCount: 0,
        manualCount: 0,
        statusCounts: emptyCounts(),
        manualFallback: `人工：在${domainLabel(row.domain)}相关页面直接操作`,
        manualEntries: [],
      };
    current.actionCount += 1;
    current.statusCounts[row.status] += 1;
    if (STATUS_SEVERITY[row.status] > STATUS_SEVERITY[current.status]) current.status = row.status;
    map.set(row.domain, current);
  }
  for (const entry of MANUAL_PARITY) {
    const seen = new Set<string>();
    for (const actionId of entry.actionIds) {
      const domain = actionId.split(".")[0];
      const summary = map.get(domain);
      if (!summary) continue;
      summary.manualCount += 1;
      if (!seen.has(domain)) {
        summary.manualEntries.push({
          menuCode: entry.menuCode,
          title: entry.title,
          status: entry.status,
          missingReason: entry.missingReason,
        });
        seen.add(domain);
      }
    }
  }
  for (const summary of map.values()) {
    if (summary.status !== "LIVE") {
      summary.blockedReason =
        summary.status === "BLOCKED"
          ? "该域全部/部分动作前置依赖未满足，需先补后端注册与权限判定"
          : "该域仍有动作缺 AI 工具或确认链，需补齐后逐项放开";
    }
    summary.manualEntries.sort((a, b) => a.menuCode.localeCompare(b.menuCode));
  }
  return [...map.values()].sort((a, b) => a.domain.localeCompare(b.domain));
})();

export const PARITY = {
  manualTotal: PARITY_MANUAL_ENTRIES.length,
  // 覆盖口径：80 项全部登记（有状态/原因/人工回退）；只读页与本地动作另有单独分组
  manualCovered: MANUAL_PARITY.length,
  manualWithActions: MANUAL_PARITY.filter((entry) => entry.actionCount > 0).length,
  readonlyEntries: MANUAL_PARITY.filter((entry) => entry.actionCount === 0),
  actionTotal: PARITY_ACTION_ROWS.length,
  actionCovered: PARITY_ACTION_ROWS.length,
  statusCounts: PARITY_ACTION_ROWS.reduce(
    (counts, row) => ({ ...counts, [row.status]: counts[row.status] + 1 }),
    emptyCounts(),
  ),
  manualStatusCounts: PARITY_MANUAL_ENTRIES.reduce(
    (counts, entry) => ({ ...counts, [entry.status]: counts[entry.status] + 1 }),
    emptyCounts(),
  ),
  aiCapabilities: AI_CAPABILITIES.length,
  aiOnlyCapabilities: AI_CAPABILITIES.filter((cap) => cap.aiOnly).length,
  domains,
} as const;

/** 对等摘要文案（AI 主交互面顶部） */
export function paritySummaryText(): string {
  return `人工入口覆盖 ${PARITY.manualCovered}/${PARITY.manualTotal} · 动作覆盖 ${PARITY.actionCovered}/${PARITY.actionTotal}`;
}

// ── 校验器（测试与 mutation 反测共用；返回点名式失败） ─────────────────────

export interface ParityFailure {
  code: string;
  name: string;
  detail: string;
}

export interface ParityValidateInput {
  manualEntries: readonly ParityManualEntry[];
  actionRows: readonly ParityActionRow[];
  aiCapabilities: readonly CapabilityEntry[];
  manifest: readonly Pick<ManifestItem, "menuCode" | "routeName" | "action">[];
  expectedManualTotal?: number;
  expectedActionTotal?: number;
}

export function validateParity(input: ParityValidateInput): ParityFailure[] {
  const failures: ParityFailure[] = [];
  const manualCodes = new Set(input.manualEntries.map((entry) => entry.menuCode));
  const routeNames = new Set(
    input.manualEntries.map((entry) => entry.routeName).filter((name): name is string => Boolean(name)),
  );
  const actionIds = new Set(input.actionRows.map((row) => row.id));

  for (const item of input.manifest) {
    if (!manualCodes.has(item.menuCode)) {
      failures.push({
        code: "MISSING_MANUAL_MAPPING",
        name: item.menuCode,
        detail: `人工入口 ${item.menuCode} 未登记到对等台账`,
      });
    }
    if (item.routeName && !routeNames.has(item.routeName)) {
      failures.push({
        code: "MISSING_ROUTE_MAPPING",
        name: item.routeName,
        detail: `路由 ${item.routeName} 未被任何对等行覆盖`,
      });
    }
  }

  // 人工入口引用的动作必须仍在矩阵台账内：删动作映射 / 篡改 actionId 一律点名
  for (const entry of input.manualEntries) {
    for (const actionId of entry.actionIds) {
      if (!actionIds.has(actionId)) {
        failures.push({
          code: "MISSING_ACTION_MAPPING",
          name: actionId,
          detail: `人工入口 ${entry.menuCode} 引用的动作 ${actionId} 不在 30 矩阵台账内（映射被删或篡改）`,
        });
      }
    }
  }
  for (const row of input.actionRows) {
    if (!actionIds.has(row.id)) continue;
    if (row.status === "LIVE" && !(row.aiTool && row.confirmChain)) {
      failures.push({
        code: "UNSAFE_LIVE",
        name: row.id,
        detail: "状态被洗成 LIVE，但矩阵显示无 AI 工具或无确认链",
      });
    }
    if ((row.status === "PLANNED" || row.status === "BLOCKED") && !actionMissingReason(row)) {
      failures.push({ code: "MISSING_REASON", name: row.id, detail: "PLANNED/BLOCKED 缺缺失原因" });
    }
  }

  for (const cap of input.aiCapabilities) {
    const hasAnchor = (cap.manualActionIds?.length ?? 0) > 0 || (cap.manualRouteNames?.length ?? 0) > 0;
    if (!hasAnchor && cap.aiOnly !== true) {
      failures.push({
        code: "ORPHAN_CAPABILITY",
        name: cap.id,
        detail: "AI 能力既无动作锚点也未显式标记 AI_ONLY",
      });
    }
    if (cap.aiOnly === true && !cap.aiOnlyReason) {
      failures.push({ code: "MISSING_AI_ONLY_REASON", name: cap.id, detail: "AI_ONLY 缺少显式理由" });
    }
  }

  const expectedManual = input.expectedManualTotal ?? input.manifest.length;
  if (input.manualEntries.length !== expectedManual) {
    failures.push({
      code: "MANUAL_COUNT_MISMATCH",
      name: "manualEntries",
      detail: `对等台账 ${input.manualEntries.length} 项，期望 ${expectedManual} 项`,
    });
  }
  const expectedAction = input.expectedActionTotal;
  if (typeof expectedAction === "number" && input.actionRows.length !== expectedAction) {
    failures.push({
      code: "ACTION_COUNT_MISMATCH",
      name: "actionRows",
      detail: `动作台账 ${input.actionRows.length} 行，期望 ${expectedAction} 行（30 矩阵）`,
    });
  }

  const statusTotal = input.actionRows.reduce(
    (sum, row) => sum + (["LIVE", "PARTIAL", "PLANNED", "BLOCKED"].includes(row.status) ? 1 : 0),
    0,
  );
  if (statusTotal !== input.actionRows.length) {
    failures.push({
      code: "STATUS_CONSERVATION",
      name: "statusCounts",
      detail: "四态之和与动作行数不守恒",
    });
  }

  return failures;
}


