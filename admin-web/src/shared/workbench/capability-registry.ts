/**
 * 工作台 AI 能力台账（WORKBENCH-03）
 *
 * 真相源：`docs/evidence/WB-REFACTOR-P0/20-ai-feature-matrix.md`（19 行明细）。
 * - 状态判据与矩阵一致（见 capability-types.ts 注释）。
 * - 原型有、后端无的能力一律 PLANNED，UI 侧禁用并展示缺失原因，不伪造数据。
 * - 本表只登记能力与真实动作，不新增业务写动作，也不接动态菜单。
 */
import type { CapabilityEntry, CapabilityStatus } from "./capability-types";
import { CAPABILITIES_A } from "./capability-entries-a";
import { CAPABILITIES_B } from "./capability-entries-b";

export type { CapabilityEntry, CapabilityStatus } from "./capability-types";

/** 19 项能力（顺序与 P0 矩阵 #1…#19 一致） */
export const CAPABILITIES: readonly CapabilityEntry[] = [...CAPABILITIES_A, ...CAPABILITIES_B];

/** 快捷经营指令：真实动作一律复用现有对话（POST /api/chat），不新建指令端点 */
export const QUICK_COMMANDS: readonly {
  label: string;
  prompt: string;
  capabilityId: string;
}[] = [
  { label: "创建销售单", prompt: "创建销售单：为指定客户开一张销售单，写清商品与数量", capabilityId: "ai-05" },
  { label: "查库存", prompt: "查询指定商品的当前库存", capabilityId: "ai-05" },
  { label: "本月销售报表", prompt: "本月的销售报表", capabilityId: "ai-05" },
];

/** 按 ID 取能力 */
export function getCapability(id: string): CapabilityEntry | undefined {
  return CAPABILITIES.find((entry) => entry.id === id);
}

/** 状态计数（供 UI 与测试守恒核对） */
export function countCapabilitiesByStatus(
  entries: readonly CapabilityEntry[] = CAPABILITIES,
): Record<CapabilityStatus, number> {
  const counts: Record<CapabilityStatus, number> = { LIVE: 0, PARTIAL: 0, PLANNED: 0, BLOCKED: 0 };
  for (const entry of entries) counts[entry.status] += 1;
  return counts;
}

/** 是否可交互：只有 LIVE / PARTIAL 允许作为真实入口；PLANNED / BLOCKED 一律禁用 */
export function isCapabilityEnabled(status: CapabilityStatus): boolean {
  return status === "LIVE" || status === "PARTIAL";
}

/**
 * 上线判定（WORKBENCH-PROTOTYPE-12 · S2 唯一生产能力源的生产口径）：
 * LIVE / PARTIAL 属已上线；PLANNED / BLOCKED 属未上线，不进生产集合
 * （不进 DOM、搜索和深链）。与 isCapabilityEnabled 同一判据，语义分层导出。
 */
export function isCapabilityLaunched(status: CapabilityStatus): boolean {
  return isCapabilityEnabled(status);
}

/** 上线能力子集（保持台账顺序）；未上线项由调用方按“待建设/阻塞”诚实呈现，不进生产入口 */
export function launchedCapabilities(
  entries: readonly CapabilityEntry[] = CAPABILITIES,
): readonly CapabilityEntry[] {
  return entries.filter((entry) => isCapabilityLaunched(entry.status));
}

/**
 * 生产快捷指令：只保留挂靠能力**已上线**的指令（当前全部挂靠 ai-05「快捷经营指令」PARTIAL）。
 * 未上线能力挂靠的指令一律不返回 —— 未上线能力不得出现在生产入口（S2 §三.4）。
 */
export function launchedQuickCommands(): readonly {
  label: string;
  prompt: string;
  capabilityId: string;
}[] {
  return QUICK_COMMANDS.filter((command) => {
    const capability = getCapability(command.capabilityId);
    return Boolean(capability && isCapabilityLaunched(capability.status));
  });
}

/** 状态中文标签 */
export function capabilityStatusLabel(status: CapabilityStatus): string {
  switch (status) {
    case "LIVE":
      return "已上线";
    case "PARTIAL":
      return "部分接入";
    case "PLANNED":
      return "待建设";
    case "BLOCKED":
      return "阻塞";
  }
}

/** 能力台账状态汇总文案（AI 主交互面 Agent 运行状态卡使用） */
export function capabilitySummary(entries: readonly CapabilityEntry[] = CAPABILITIES): string {
  const counts = countCapabilitiesByStatus(entries);
  return `已上线 ${counts.LIVE} · 部分接入 ${counts.PARTIAL} · 待建设 ${counts.PLANNED} · 阻塞 ${counts.BLOCKED}`;
}
