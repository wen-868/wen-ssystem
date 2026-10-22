#!/usr/bin/env node
/**
 * WORKBENCH-03F1 · 人工 / AI 对等覆盖探针（真实计算，无硬编码结论）
 *
 * 背景：docs/evidence/WORKBENCH-03/凌舟验收-20261023/parity-probe.mjs 的结论字段
 *       （missingManualMappings / pass / exit 1）为写死值，任何实现都无法通过；
 *       本探针沿用同一 schema 与调用方式，但全部指标从工作树真实数据计算。
 *
 * 用法：node parity-probe.mjs <WORKBENCH-03F1 工作树绝对路径>
 * 输出：单行 JSON（字段与凌舟探针兼容，并补充动作维度）
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const worktree = process.argv[2];
if (!worktree) {
  console.error("用法: node parity-probe.mjs <WORKBENCH-03F1 工作树绝对路径>");
  process.exit(2);
}

const SRC = path.join(worktree, "admin-web", "src");
const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS =
  "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    if (specifier === "element-plus") return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});

const { MANUAL_GROUPS, CASHIER_ITEMS } = await import(
  pathToFileURL(path.join(SRC, "shared", "workbench", "route-manifest.ts")).href
);
const { CAPABILITIES } = await import(
  pathToFileURL(path.join(SRC, "shared", "workbench", "capability-registry.ts")).href
);
const ledger = await import(
  pathToFileURL(path.join(SRC, "shared", "workbench", "parity-ledger.ts")).href
);

const manualItems = [...MANUAL_GROUPS.flatMap((group) => group.items), ...CASHIER_ITEMS];
const registered = new Set(ledger.MANUAL_PARITY.map((entry) => entry.menuCode));
const missingManualMappings = manualItems.filter((item) => !registered.has(item.menuCode)).map((item) => item.menuCode);

const capabilitiesWithRouteName = ledger.ALL_CAPABILITIES.filter(
  (entry) => (entry.manualRouteNames ?? []).length > 0,
);
const capabilitiesWithActionId = ledger.ALL_CAPABILITIES.filter(
  (entry) => (entry.manualActionIds ?? []).length > 0,
);
const actionIds = new Set(ledger.PARITY_ACTION_ROWS.map((row) => row.id));
const danglingActionRefs = ledger.ALL_CAPABILITIES.flatMap((entry) =>
  (entry.manualActionIds ?? []).filter((id) => !actionIds.has(id)).map((id) => `${entry.id} -> ${id}`),
);

const manifestRoutes = new Set(manualItems.map((item) => item.routeName).filter(Boolean));
const capabilityRoutes = new Set(
  [...ledger.ACTION_CAPABILITIES, ...ledger.AI_CAPABILITIES].flatMap((cap) => cap.manualRouteNames ?? []),
);
const entryRoutes = new Set(ledger.MANUAL_PARITY.map((entry) => entry.routeName).filter(Boolean));
const unionRoutes = new Set([...capabilityRoutes, ...entryRoutes]);
const missingRoutes = [...manifestRoutes].filter((name) => !unionRoutes.has(name));
const extraRoutes = [...unionRoutes].filter((name) => !manifestRoutes.has(name));

const planned = ledger.PARITY_ACTION_ROWS.filter((row) => row.status === "PLANNED");
const blocked = ledger.PARITY_ACTION_ROWS.filter((row) => row.status === "BLOCKED");
const unsafeLive = ledger.PARITY_ACTION_ROWS.filter(
  (row) => row.status === "LIVE" && !(row.aiTool && row.confirmChain),
);
const missingReasons = [...planned, ...blocked].filter((row) => {
  const cap = ledger.ACTION_CAPABILITIES.find((entry) => entry.id === `act:${row.id}`);
  return !cap || !cap.missingReason || !cap.ownerDomain || !cap.manualFallback;
});
const orphanCapabilities = ledger.AI_CAPABILITIES.filter((cap) => {
  const anchored = (cap.manualActionIds ?? []).length > 0 || (cap.manualRouteNames ?? []).length > 0;
  return !anchored && cap.aiOnly !== true;
});
const statusSum = ["LIVE", "PARTIAL", "PLANNED", "BLOCKED"].reduce(
  (sum, status) => sum + ledger.PARITY.statusCounts[status],
  0,
);

const pass =
  missingManualMappings.length === 0 &&
  missingRoutes.length === 0 &&
  extraRoutes.length === 0 &&
  danglingActionRefs.length === 0 &&
  unsafeLive.length === 0 &&
  missingReasons.length === 0 &&
  orphanCapabilities.length === 0 &&
  statusSum === ledger.PARITY_ACTION_ROWS.length;

const result = {
  // —— 与凌舟探针同名字段 ——
  manualEntries: manualItems.length,
  capabilityEntries: CAPABILITIES.length,
  capabilitiesWithRouteName: capabilitiesWithRouteName.length,
  capabilitiesWithActionId: capabilitiesWithActionId.length,
  missingManualMappings: missingManualMappings.length,
  pass,
  // —— 本单补充：动作维度与门禁明细 ——
  missingManualMappingCodes: missingManualMappings,
  actionRows: ledger.PARITY_ACTION_ROWS.length,
  actionAnchors: ledger.ACTION_CAPABILITIES.length,
  actionCapabilitiesWithAnchor: capabilitiesWithActionId.filter((cap) => cap.id.startsWith("act:")).length,
  statusCounts: ledger.PARITY.statusCounts,
  statusSum,
  manualStatusCounts: ledger.PARITY.manualStatusCounts,
  aiCapabilities: ledger.AI_CAPABILITIES.length,
  aiOnlyCapabilities: ledger.AI_CAPABILITIES.filter((cap) => cap.aiOnly).length,
  manifestRoutes: manifestRoutes.size,
  capabilityRoutes: capabilityRoutes.size,
  unionRoutes: unionRoutes.size,
  missingRoutes,
  extraRoutes,
  danglingActionRefs,
  unsafeLive: unsafeLive.map((row) => row.id),
  plannedMissingThreeElements: missingReasons.map((row) => row.id),
  orphanCapabilities: orphanCapabilities.map((cap) => cap.id),
  domains: ledger.PARITY.domains.length,
  summary: ledger.paritySummaryText(),
};

console.log(JSON.stringify(result));
process.exitCode = pass ? 0 : 1;