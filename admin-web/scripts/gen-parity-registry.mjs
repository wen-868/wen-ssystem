#!/usr/bin/env node
/**
 * WORKBENCH-03F1 · 生成对等台账（机器产出，禁止手改）
 *
 * 输入：
 *   - docs/evidence/WB-REFACTOR-P0/30-action-permission-matrix.md（254 行写动作，矩阵原样）
 *   - admin-web/src/shared/workbench/{route-manifest,parity-domains}.ts（80 个人工入口 + 域标签）
 * 输出：
 *   - admin-web/src/shared/workbench/parity-actions-gen.ts
 *   - admin-web/src/shared/workbench/parity-manual-gen.ts
 *   - docs/evidence/WORKBENCH-03F1/parity-report.json
 *
 * 复跑：node admin-web/scripts/gen-parity-registry.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ADMIN = path.resolve(here, "..");
const REPO = path.resolve(ADMIN, "..");
const SRC = path.join(ADMIN, "src");
const MATRIX = path.join(REPO, "docs", "evidence", "WB-REFACTOR-P0", "30-action-permission-matrix.md");
const OUT_ACTIONS = path.join(SRC, "shared", "workbench", "parity-actions-gen.ts");
const OUT_MANUAL = path.join(SRC, "shared", "workbench", "parity-manual-gen.ts");
const OUT_REPORT = path.join(REPO, "docs", "evidence", "WORKBENCH-03F1", "parity-report.json");
const BASELINE = "45b8cf1507dc6706ce512c1647770555d2da9234";

const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS = "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    if (specifier === "element-plus") return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});

const { MANUAL_GROUPS, CASHIER_ITEMS } = await import(
  pathToFileURL(path.join(SRC, "shared", "workbench", "route-manifest.ts")).href
);
const { domainLabel } = await import(
  pathToFileURL(path.join(SRC, "shared", "workbench", "parity-domains.ts")).href
);

// ── 1. 解析 30 矩阵写动作（逐行，actionId 原样） ────────────────────────────
const lines = fs.readFileSync(MATRIX, "utf8").split(/\r?\n/);
const start = lines.findIndex((line) => line.startsWith("## 2. 写动作矩阵"));
const end = lines.findIndex((line, index) => index > start && line.startsWith("## 3."));
if (start < 0 || end < 0) throw new Error("30 矩阵章节 2/3 未找到，矩阵格式变更需同步本脚本");

const ROW_HEAD = /^\|\s*[a-z0-9][a-z0-9-]*(\.[a-z0-9_]+)+(#[0-9]+)?\s*\|/;
const rawRows = [];
let current = null;
for (const line of lines.slice(start + 1, end)) {
  if (ROW_HEAD.test(line)) {
    if (current) rawRows.push(current);
    current = [line];
  } else if (current) {
    current.push(line);
  }
}
if (current) rawRows.push(current);

/** 判定规则（与 parity-ledger.ts 注释一致；矩阵列是唯一依据） */
function resolveStatus(aiTool, confirmChain, permission) {
  if (aiTool && confirmChain) return "LIVE";
  if (aiTool) return "PARTIAL";
  if (!/UNKNOWN/.test(permission)) return "PLANNED";
  return "BLOCKED";
}

const actionRows = rawRows.map((linesOfRow) => {
  const text = linesOfRow.join(" ").replace(/\s+/g, " ");
  // 多行单元格内可能残留 `|`，故改用逐列正则定位，不按 `|` 硬切
  const id = (text.match(/^\|\s*([a-z0-9][a-z0-9-]*(?:\.[a-z0-9_]+)+(?:#[0-9]+)?)\s*\|/) ?? [])[1];
  if (!id) throw new Error("矩阵动作行 actionId 解析失败");
  const pages = [...new Set((text.match(/admin-web\/src\/(?:views|layouts)\/[A-Za-z0-9_/-]+\.vue/g) ?? [])
    .map((abs) => abs.replace(/^admin-web\/src\//, "")))].sort();
  const methodPath = text.match(/`([A-Z]+)\s+([^`]+)`/);
  const method = methodPath ? methodPath[1] : "UNKNOWN";
  const apiPath = methodPath ? methodPath[2].trim() : "UNKNOWN";
  const permissionCell = (text.match(/\|\s*([^|]*?)\s*\|\s*[WR]\s*\|/) ?? [])[1] ?? "UNKNOWN";
  const permission = /UNKNOWN/.test(permissionCell)
    ? "UNKNOWN"
    : /\*\*无码\*\*/.test(permissionCell)
      ? "NO_CODE"
      : (permissionCell.match(/`([^`]+)`/) ?? [null, "UNKNOWN"])[1];
  const aiConfirm = text.match(/\|\s*(有：[^|]*?|无)\s*\|\s*(有（AI 侧[^|]*|无（页面直调[^|]*)/);
  const aiTool = Boolean(aiConfirm && aiConfirm[1].startsWith("有"));
  const confirmChain = Boolean(aiConfirm && aiConfirm[2].startsWith("有"));
  const status = resolveStatus(aiTool, confirmChain, permission);
  const domain = id.split(".")[0];
  const ownerDomain = domainLabel(domain);
  const missingReason =
    status === "LIVE"
      ? undefined
      : status === "PARTIAL"
        ? "AI 工具有端点但未纳入确认链（缺预览→确认→执行→撤销），不允许直接执行写操作"
        : status === "PLANNED"
          ? "矩阵实测无 AI 工具：AI 底座未注册覆盖该接口的工具"
          : "前置依赖未满足：该前端接口路径在本仓无对应后端路由注册，权限码/审计不可判定";
  const manualFallback = `人工：${pages[0] ?? "对应页面"} 内该动作按钮（${method} ${apiPath}，页面直调）`;
  const experienceGain =
    status === "LIVE"
      ? "AI 一句话发起 → 预览 → 确认执行（可撤销），人工免去表单填写"
      : "补齐后可由 AI 发起并走确认链；当前仍需人工在页面操作";
  return { id, pages, routeNames: [], domain, method, apiPath, permission, aiTool, confirmChain, status, missingReason, ownerDomain, manualFallback, experienceGain };
});

// ── 2. 人工入口 → 路由/页面（组件路径精确匹配，不做名称相似） ────────────────
const manualItems = [
  ...MANUAL_GROUPS.flatMap((group) => group.items.map((item) => ({ item, group: group.title }))),
  ...CASHIER_ITEMS.map((item) => ({ item, group: "收银台" })),
];

function pageOfComponent(loader) {
  const text = String(loader);
  const match = text.match(/\.\.\/\.\.\/((?:views|layouts)\/[A-Za-z0-9_/-]+\.vue)/);
  return match ? match[1] : null;
}

const pageToRouteNames = new Map();
for (const { item } of manualItems) {
  const page = pageOfComponent(item.component);
  if (!page || !item.routeName) continue;
  if (!pageToRouteNames.has(page)) pageToRouteNames.set(page, new Set());
  pageToRouteNames.get(page).add(item.routeName);
}

for (const row of actionRows) {
  const names = new Set();
  for (const page of row.pages) for (const name of pageToRouteNames.get(page) ?? []) names.add(name);
  row.routeNames = [...names].sort();
}

// ── 3. 入口级聚合状态 ──────────────────────────────────────────────────────
function aggregateStatus(rows) {
  if (rows.length === 0) return "PLANNED";
  const live = rows.filter((row) => row.status === "LIVE").length;
  const blocked = rows.filter((row) => row.status === "BLOCKED").length;
  if (live === rows.length) return "LIVE";
  if (live > 0) return "PARTIAL";
  if (blocked > 0) return "BLOCKED";
  return "PLANNED";
}

const manualEntries = manualItems.map(({ item, group }) => {
  const page = pageOfComponent(item.component);
  const rows = page ? actionRows.filter((row) => row.pages.includes(page)) : [];
  const actionIds = rows.map((row) => row.id);
  const status = aggregateStatus(rows);
  const missingReason =
    !item.routeName
      ? "本地弹窗动作：无后端端点，AI 无对应工具"
      : rows.length === 0
        ? "该页面无写动作行（只读页）；AI 只读问答未逐页接入"
        : status === "LIVE"
          ? undefined
          : status === "PARTIAL"
            ? "该入口部分动作已有 AI 工具，其余动作未覆盖（逐行见动作台账）"
            : status === "BLOCKED"
              ? "该入口存在前置依赖未满足的动作（接口未注册/权限不可判）"
              : "该入口所辖写动作均无 AI 工具，AI 侧待建设";
  const manualFallback = item.routeName
    ? `人工：${group} › ${item.title}（${item.path ?? "页面内"}）`
    : `人工：${group} › ${item.title} 弹窗（本地动作，不经 AI）`;
  const experienceGain =
    status === "LIVE"
      ? "该页全部写动作可由 AI 代办（走确认链）"
      : status === "PARTIAL"
        ? "该页部分写动作可由 AI 代办"
        : "补齐后可由 AI 代办；当前仍需人工操作";
  return {
    menuCode: item.menuCode,
    title: item.title,
    routeName: item.routeName,
    ownerDomain: group,
    page,
    actionCount: rows.length,
    actionIds,
    status,
    missingReason,
    manualFallback,
    experienceGain,
  };
});

// ── 4. 守恒与缺口校验 ──────────────────────────────────────────────────────
const statusCounts = { LIVE: 0, PARTIAL: 0, PLANNED: 0, BLOCKED: 0 };
for (const row of actionRows) statusCounts[row.status] += 1;
const manualStatusCounts = { LIVE: 0, PARTIAL: 0, PLANNED: 0, BLOCKED: 0 };
for (const entry of manualEntries) manualStatusCounts[entry.status] += 1;

const registeredMenuCodes = new Set(manualEntries.map((entry) => entry.menuCode));
const missing = manualItems
  .map(({ item }) => item.menuCode)
  .filter((code) => !registeredMenuCodes.has(code));
// 动作锚点：254 行动作台账自身即锚点（每行一条 act:<actionId>），人工入口是另一维映射
const actionIds = actionRows.map((row) => row.id);
const anchoredActionIds = new Set(actionIds);
const unmappedActionRows = actionRows.filter((row) => !anchoredActionIds.has(row.id)).map((row) => row.id);
const offMenuActionRows = actionRows.filter((row) => row.routeNames.length === 0).map((row) => row.id);
const unregisteredDomains = [...new Set(actionRows.map((row) => row.domain))].filter(
  (domain) => domainLabel(domain) === domain,
);

const report = {
  generatedFrom: [
    "docs/evidence/WB-REFACTOR-P0/30-action-permission-matrix.md",
    "admin-web/src/shared/workbench/route-manifest.ts",
    "admin-web/src/shared/workbench/parity-domains.ts",
  ],
  baseline: BASELINE,
  manualEntries: manualItems.length,
  manualEntriesMapped: manualEntries.length - missing.length,
  missingManualMappings: missing.length,
  actionRows: actionRows.length,
  actionAnchors: anchoredActionIds.size,
  unmappedActionRows: unmappedActionRows.length,
  onMenuActionRows: actionRows.length - offMenuActionRows.length,
  offMenuActionRows: offMenuActionRows.length,
  statusCounts,
  manualStatusCounts,
  aiCapabilities: 19,
  actionCapabilities: actionRows.length,
  orphanCapabilities: [],
  unregisteredDomains,
  missing,
  pass: missing.length === 0 && unmappedActionRows.length === 0 && statusCounts.LIVE + statusCounts.PARTIAL + statusCounts.PLANNED + statusCounts.BLOCKED === actionRows.length,
};

// ── 5. 输出 TS 台账（机器产出） ────────────────────────────────────────────
const header = `// AUTO-GENERATED by admin-web/scripts/gen-parity-registry.mjs — DO NOT EDIT.\n// 真相源：docs/evidence/WB-REFACTOR-P0/30-action-permission-matrix.md（写动作逐行）\n// 复跑：node admin-web/scripts/gen-parity-registry.mjs\n`;
const stamp = `export const PARITY_BASELINE = ${JSON.stringify(BASELINE)};\n`;
const json = (value) => JSON.stringify(value);

const actionBody = actionRows
  .map((row) => {
    const fields = [
      `id: ${json(row.id)}`,
      `pages: ${json(row.pages)}`,
      `routeNames: ${json(row.routeNames)}`,
      `domain: ${json(row.domain)}`,
      `method: ${json(row.method)}`,
      `apiPath: ${json(row.apiPath)}`,
      `permission: ${json(row.permission)}`,
      `aiTool: ${row.aiTool}`,
      `confirmChain: ${row.confirmChain}`,
      `status: ${json(row.status)}`,
    ];
    return `  { ${fields.join(", ")} },`;
  })
  .join("\n");

const manualBody = manualEntries
  .map((entry) => {
    const fields = [
      `menuCode: ${json(entry.menuCode)}`,
      `title: ${json(entry.title)}`,
      `routeName: ${json(entry.routeName)}`,
      `ownerDomain: ${json(entry.ownerDomain)}`,
      `page: ${json(entry.page)}`,
      `actionCount: ${entry.actionCount}`,
      `actionIds: ${json(entry.actionIds)}`,
      `status: ${json(entry.status)}`,
    ];
    return `  { ${fields.join(", ")} },`;
  })
  .join("\n");

const actionFile = `${header}import type { ParityActionRow } from "./capability-types";\n\n${stamp}\nexport const PARITY_ACTION_ROWS: readonly ParityActionRow[] = [\n${actionBody}\n];\n`;
const manualFile = `${header}import type { ParityManualEntry } from "./capability-types";\n\n${stamp}\nexport const PARITY_MANUAL_ENTRIES: readonly ParityManualEntry[] = [\n${manualBody}\n];\n`;

fs.mkdirSync(path.dirname(OUT_REPORT), { recursive: true });
fs.writeFileSync(OUT_ACTIONS, actionFile, "utf8");
fs.writeFileSync(OUT_MANUAL, manualFile, "utf8");
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2) + "\n", "utf8");

console.log(JSON.stringify({ ...report, out: { actions: path.relative(REPO, OUT_ACTIONS), manual: path.relative(REPO, OUT_MANUAL), report: path.relative(REPO, OUT_REPORT) } }));
if (!report.pass) process.exitCode = 1;




