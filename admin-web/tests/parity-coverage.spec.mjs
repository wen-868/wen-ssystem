/**
 * WORKBENCH-03F1 断言用例 —— 人工动作 ↔ AI 能力双向对等覆盖
 *
 * 覆盖任务卡硬验收：
 *   ① 扩展能力模型：manualRouteNames / manualActionIds / experienceGain / manualFallback / AI_ONLY
 *   ② 人工动作映射：71 人工入口 + 9 收银项（80/80）全部登记，无 AI 对应项必有原因/责任域/人工回退
 *   ③ 双向差集：人工动作 → AI 能力；AI 能力 → 真实动作锚点或显式 AI_ONLY
 *   ④ UI：能力台账顶部显示覆盖摘要，可按业务域展开；未实现 AI 不隐藏人工入口
 *   ⑤ 门禁：routeName 并集守恒、动作锚点守恒、PLANNED/BLOCKED 三要素、mutation 必红点名
 *   ⑥ 业务冻结：views/backend 相对基线零改动；既有 4 个 spec 不得减少
 *
 * 运行（admin-web 目录）：npm test
 * 说明：沿用 role-guard.spec.mjs 的 Node 原生 TS 剥离 + 模块钩子方案（不依赖 vitest/esbuild）。
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const REPO_ROOT = path.join(here, "..", "..");
const BASELINE = "45b8cf1507dc6706ce512c1647770555d2da9234";

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

const { MANUAL_GROUPS, CASHIER_ITEMS } = await import("../src/shared/workbench/route-manifest.ts");
const {
  PARITY,
  MANUAL_PARITY,
  PARITY_ACTION_ROWS,
  PARITY_MANUAL_ENTRIES,
  ACTION_CAPABILITIES,
  AI_CAPABILITIES,
  ALL_CAPABILITIES,
  paritySummaryText,
  validateParity,
} = await import("../src/shared/workbench/parity-ledger.ts");
const { domainLabel, DOMAIN_LABELS, STATUS_SEVERITY } = await import(
  "../src/shared/workbench/parity-domains.ts"
);

const MANIFEST_ITEMS = [...MANUAL_GROUPS.flatMap((group) => group.items), ...CASHIER_ITEMS];
const STATUSES = ["LIVE", "PARTIAL", "PLANNED", "BLOCKED"];

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
}

function countBy(items, key, statuses = STATUSES) {
  const counts = Object.fromEntries(statuses.map((s) => [s, 0]));
  for (const item of items) counts[item[key]] += 1;
  return counts;
}

// ── ① 人工入口守恒：80 项逐一登记，只读页/本地动作不删入口 ─────────────────────
await run("人工入口守恒：80/80 登记，含本地弹窗显式登记", () => {
  assert.equal(MANIFEST_ITEMS.length, 80, "route-manifest 人工入口应为 71 + 收银 9 = 80");
  assert.equal(PARITY_MANUAL_ENTRIES.length, 80, "生成台账应为 80 行");
  assert.equal(MANUAL_PARITY.length, 80, "对等视图应为 80 行");
  const codes = MANUAL_PARITY.map((entry) => entry.menuCode);
  assert.equal(new Set(codes).size, 80, "menuCode 不得重复");
  for (const item of MANIFEST_ITEMS) {
    const hits = MANUAL_PARITY.filter((entry) => entry.menuCode === item.menuCode);
    assert.equal(hits.length, 1, `${item.menuCode} 应且仅应映射 1 条`);
    const entry = hits[0];
    assert.equal(entry.routeName, item.routeName ?? null, `${item.menuCode} routeName 应与 manifest 一致`);
    assert.equal(entry.title, item.title, `${item.menuCode} 标题不应被改名凑数`);
    assert.ok(entry.manualFallback && entry.manualFallback.startsWith("人工："), `${item.menuCode} 缺人工回退`);
    assert.ok(entry.ownerDomain, `${item.menuCode} 缺责任域`);
    assert.ok(STATUSES.includes(entry.status), `${item.menuCode} 状态非法`);
    if (entry.status !== "LIVE") assert.ok(entry.missingReason, `${item.menuCode} 非 LIVE 必须给缺失原因`);
    assert.equal(entry.actionCount, entry.actionIds.length, `${item.menuCode} 动作计数应与锚点一致`);
  }
  const printEntry = MANUAL_PARITY.find((entry) => entry.menuCode === "web.pos.print-settings");
  assert.ok(printEntry, "打印设置不得因无路由而删除");
  assert.equal(printEntry.routeName, null);
  assert.ok(printEntry.missingReason.includes("本地弹窗"), "本地弹窗动作应显式给出原因");
  return "80/80（只读页 34 项、本地弹窗 1 项全部保留）";
});

// ── ② routeName 并集守恒：不得漏项、不得名称相似冒充 ──────────────────────────
await run("routeName 并集守恒：能力锚点 ∪ 入口路由 == manifest 全部路由", () => {
  const manifestRoutes = new Set(MANIFEST_ITEMS.map((item) => item.routeName).filter(Boolean));
  const capRoutes = new Set(
    [...ACTION_CAPABILITIES, ...AI_CAPABILITIES].flatMap((cap) => cap.manualRouteNames ?? []),
  );
  const manualRoutes = new Set(MANUAL_PARITY.map((entry) => entry.routeName).filter(Boolean));
  const union = new Set([...capRoutes, ...manualRoutes]);
  const missing = [...manifestRoutes].filter((name) => !union.has(name));
  const extra = [...union].filter((name) => !manifestRoutes.has(name));
  assert.deepEqual(missing, [], `漏映射路由：${missing.join(", ")}`);
  assert.deepEqual(extra, [], `台账出现 manifest 之外的路由（疑似名称相似冒充）：${extra.join(", ")}`);
  assert.equal(manifestRoutes.size, 79, "manifest 非空 routeName 应为 79（打印设置为本地弹窗）");
  assert.ok(capRoutes.size > 0, "能力侧 manualRouteNames 不得为空（此前 routeName 映射为 0）");
  return `79/79 路由全映射（能力侧 ${capRoutes.size} 条）`;
});

// ── ③ 动作台账守恒：254 行 ↔ 254 个 act: 能力锚点 ─────────────────────────────
await run("动作锚点守恒：254 行 ↔ 254 个 act:<actionId>", () => {
  assert.equal(PARITY_ACTION_ROWS.length, 254, "30 矩阵写动作应为 254 行");
  assert.equal(ACTION_CAPABILITIES.length, 254, "动作能力应为 254 项");
  assert.equal(ALL_CAPABILITIES.length, 19 + 254, "全部能力应为 AI 19 + 动作 254");
  const ids = PARITY_ACTION_ROWS.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, "actionId 不得重复");
  for (const row of PARITY_ACTION_ROWS) {
    const cap = ACTION_CAPABILITIES.find((entry) => entry.id === `act:${row.id}`);
    assert.ok(cap, `缺少动作能力锚点 act:${row.id}`);
    assert.deepEqual(cap.manualActionIds, [row.id], `${row.id} 动作锚点应指向自身`);
    assert.deepEqual(cap.manualRouteNames, row.routeNames, `${row.id} 路由锚点应与矩阵解析一致`);
    assert.ok(cap.ownerDomain, `${row.id} 缺责任域`);
    assert.ok(cap.manualFallback && cap.manualFallback.startsWith("人工："), `${row.id} 缺人工回退`);
    assert.ok(cap.experienceGain, `${row.id} 缺体验增益说明`);
  }
  return "254 行逐行有 act: 锚点";
});

// ── ④ 状态守恒：矩阵实测分布 ────────────────────────────────────────────────
await run("状态守恒：动作 26/0/213/15，入口 2/12/60/6", () => {
  const actionCounts = countBy(PARITY_ACTION_ROWS, "status");
  assert.deepEqual(actionCounts, { LIVE: 26, PARTIAL: 0, PLANNED: 213, BLOCKED: 15 }, "动作状态分布不符合矩阵");
  assert.equal(Object.values(actionCounts).reduce((a, b) => a + b, 0), 254, "动作四态之和应守恒");
  assert.deepEqual(PARITY.statusCounts, actionCounts, "汇总口径应与逐行一致");
  const manualCounts = countBy(MANUAL_PARITY, "status");
  assert.deepEqual(manualCounts, { LIVE: 2, PARTIAL: 12, PLANNED: 60, BLOCKED: 6 }, "入口状态分布不符");
  assert.equal(Object.values(manualCounts).reduce((a, b) => a + b, 0), 80, "入口四态之和应守恒");
  assert.deepEqual(PARITY.manualStatusCounts, manualCounts);
  return "254=26+0+213+15；80=2+12+60+6";
});

// ── ⑤ 独立重解析矩阵：台账被篡改（洗状态/删行）必红 ───────────────────────────
function parseMatrixIndependently() {
  const matrix = readFileSync(
    path.join(REPO_ROOT, "docs", "evidence", "WB-REFACTOR-P0", "30-action-permission-matrix.md"),
    "utf8",
  );
  const lines = matrix.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("## 2. 写动作矩阵"));
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## 3."));
  assert.ok(start >= 0 && end > start, "30 矩阵章节 2/3 定位失败（矩阵格式变更需同步生成脚本）");
  const HEAD = /^\|\s*([a-z0-9][a-z0-9-]*(?:\.[a-z0-9_]+)+(?:#[0-9]+)?)\s*\|/;
  const raw = [];
  let current = null;
  for (const line of lines.slice(start + 1, end)) {
    if (HEAD.test(line)) {
      if (current) raw.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) raw.push(current);
  return raw.map((parts) => {
    const text = parts.join(" ").replace(/\s+/g, " ");
    const id = text.match(HEAD)[1];
    const permCell = (text.match(/\|\s*([^|]*?)\s*\|\s*[WR]\s*\|/) ?? [])[1] ?? "UNKNOWN";
    const permission = /UNKNOWN/.test(permCell)
      ? "UNKNOWN"
      : /\*\*无码\*\*/.test(permCell)
        ? "NO_CODE"
        : (permCell.match(/`([^`]+)`/) ?? [null, "UNKNOWN"])[1];
    const aiConfirm = text.match(/\|\s*(有：[^|]*?|无)\s*\|\s*(有（AI 侧[^|]*|无（页面直调[^|]*)/);
    const aiTool = Boolean(aiConfirm && aiConfirm[1].startsWith("有"));
    const confirmChain = Boolean(aiConfirm && aiConfirm[2].startsWith("有"));
    const status = aiTool && confirmChain ? "LIVE" : aiTool ? "PARTIAL" : permission !== "UNKNOWN" ? "PLANNED" : "BLOCKED";
    return { id, permission, aiTool, confirmChain, status };
  });
}

await run("独立重解析 30 矩阵：254 行逐行一致（漂移必红）", () => {
  const reparsed = parseMatrixIndependently();
  assert.equal(reparsed.length, 254, "矩阵重解析行数应为 254");
  assert.equal(reparsed.length, PARITY_ACTION_ROWS.length, "台账行数与矩阵不一致");
  const drift = [];
  reparsed.forEach((expected, index) => {
    const actual = PARITY_ACTION_ROWS[index];
    if (actual.id !== expected.id) drift.push(`#${index + 1} id ${actual.id}≠${expected.id}`);
    if (actual.permission !== expected.permission) drift.push(`${expected.id} permission ${actual.permission}≠${expected.permission}`);
    if (actual.aiTool !== expected.aiTool) drift.push(`${expected.id} aiTool ${actual.aiTool}≠${expected.aiTool}`);
    if (actual.confirmChain !== expected.confirmChain) drift.push(`${expected.id} confirmChain ${actual.confirmChain}≠${expected.confirmChain}`);
    if (actual.status !== expected.status) drift.push(`${expected.id} 状态被改：${actual.status}≠${expected.status}`);
  });
  assert.deepEqual(drift.slice(0, 10), [], `台账与矩阵漂移（前 10 条）：${drift.slice(0, 10).join("；")}`);
  return "254 行 id/权限/AI 工具/确认链/状态全一致";
});

// ── ⑥ PLANNED/BLOCKED 三要素 + LIVE 安全 ────────────────────────────────────
await run("PLANNED/BLOCKED：原因 + 责任域 + 人工回退齐全；LIVE 必须工具+确认链", () => {
  for (const row of PARITY_ACTION_ROWS) {
    const cap = ACTION_CAPABILITIES.find((entry) => entry.id === `act:${row.id}`);
    if (row.status === "LIVE") {
      assert.ok(row.aiTool && row.confirmChain, `${row.id} 被标 LIVE 但矩阵无工具/确认链`);
      assert.equal(cap.missingReason, undefined, `${row.id} LIVE 不应有缺失原因`);
    } else {
      assert.ok(cap.missingReason && cap.missingReason.length > 6, `${row.id} 缺缺失原因`);
      assert.ok(cap.ownerDomain && cap.ownerDomain.length > 0, `${row.id} 缺责任域`);
      assert.ok(cap.manualFallback.includes(row.method), `${row.id} 人工回退应含真实方法`);
    }
  }
  const planned = PARITY_ACTION_ROWS.filter((row) => row.status === "PLANNED");
  const blocked = PARITY_ACTION_ROWS.filter((row) => row.status === "BLOCKED");
  assert.equal(planned.length, 213);
  assert.equal(blocked.length, 15);
  return "213 PLANNED + 15 BLOCKED 三要素齐全";
});

// ── ⑦ AI 能力 → 真实动作锚点 或 显式 AI_ONLY ────────────────────────────────
await run("AI 能力 19 项：ai-08 锚定 26 条确认链动作，其余 18 项显式 AI_ONLY", () => {
  assert.equal(AI_CAPABILITIES.length, 19);
  const actionIds = new Set(PARITY_ACTION_ROWS.map((row) => row.id));
  const manifestRoutes = new Set(MANIFEST_ITEMS.map((item) => item.routeName).filter(Boolean));
  const anchored = AI_CAPABILITIES.filter((cap) => !cap.aiOnly);
  assert.deepEqual(anchored.map((cap) => cap.id), ["ai-08"], "只允许 ai-08 具备写动作锚点");
  const ai08 = anchored[0];
  const confirmRows = PARITY_ACTION_ROWS.filter((row) => row.confirmChain);
  assert.equal(ai08.manualActionIds.length, confirmRows.length, "ai-08 锚点数应等于确认链动作数");
  for (const id of ai08.manualActionIds) {
    const row = PARITY_ACTION_ROWS.find((item) => item.id === id);
    assert.ok(row, `ai-08 锚点 ${id} 不在矩阵台账`);
    assert.equal(row.confirmChain, true, `ai-08 锚点 ${id} 未走确认链`);
  }
  for (const cap of AI_CAPABILITIES) {
    if (cap.aiOnly) {
      assert.ok(cap.aiOnlyReason && cap.aiOnlyReason.length > 4, `${cap.id} AI_ONLY 缺理由`);
      assert.equal((cap.manualActionIds ?? []).length, 0, `${cap.id} AI_ONLY 不应有动作锚点`);
      assert.equal((cap.manualRouteNames ?? []).length, 0, `${cap.id} AI_ONLY 不应有路由锚点`);
    }
    for (const id of cap.manualActionIds ?? []) assert.ok(actionIds.has(id), `${cap.id} 引用不存在动作 ${id}`);
    for (const name of cap.manualRouteNames ?? []) assert.ok(manifestRoutes.has(name), `${cap.id} 引用不存在路由 ${name}`);
  }
  for (const cap of ALL_CAPABILITIES) {
    const hasAnchor = (cap.manualActionIds ?? []).length > 0 || (cap.manualRouteNames ?? []).length > 0;
    assert.ok(hasAnchor || cap.aiOnly === true, `${cap.id} 既无锚点也未标 AI_ONLY（孤儿能力）`);
  }
  return `ai-08 锚点 ${confirmRows.length} 条；18 项 AI_ONLY 有理由`;
});

// ── ⑧ 入口级状态聚合与能力引用完整性 ────────────────────────────────────────
await run("入口状态聚合：与所辖动作最严重状态一致，能力引用无悬空", () => {
  const capIds = new Set(ALL_CAPABILITIES.map((cap) => cap.id));
  const rowsById = new Map(PARITY_ACTION_ROWS.map((row) => [row.id, row]));
  for (const entry of MANUAL_PARITY) {
    const rows = entry.actionIds.map((id) => rowsById.get(id));
    const dangling = entry.actionIds.filter((id) => !rowsById.has(id));
    assert.deepEqual(dangling, [], `${entry.menuCode} 引用不存在动作：${dangling.join(", ")}`);
    let expected;
    if (rows.length === 0) expected = "PLANNED";
    else if (rows.every((row) => row.status === "LIVE")) expected = "LIVE";
    else if (rows.some((row) => row.status === "LIVE")) expected = "PARTIAL";
    else if (rows.some((row) => row.status === "BLOCKED")) expected = "BLOCKED";
    else expected = "PLANNED";
    assert.equal(entry.status, expected, `${entry.menuCode} 聚合状态 ${entry.status}≠${expected}`);
    for (const id of entry.capabilityIds) assert.ok(capIds.has(id), `${entry.menuCode} 引用不存在能力 ${id}`);
    if (entry.routeName) {
      assert.ok(
        entry.capabilityIds.includes(`act:${entry.actionIds[0]}`) || entry.actionIds.length === 0,
        `${entry.menuCode} 首个动作未映射到能力`,
      );
    }
  }
  return "80 项聚合状态与能力引用全一致";
});

// ── ⑨ 业务域汇总：66 域全部有中文标签、可展开 ────────────────────────────────
await run("业务域汇总：66 域全量中文标签，域内人工入口可追溯", () => {
  assert.equal(PARITY.domains.length, 66, "业务域应为 66 个");
  const codes = new Set(MANUAL_PARITY.map((entry) => entry.menuCode));
  for (const domain of PARITY.domains) {
    assert.ok(domain.label && domain.label !== domain.domain, `${domain.domain} 缺中文标签`);
    assert.ok(/[\u4e00-\u9fa5]/.test(domain.label), `${domain.domain} 标签应为中文`);
    assert.equal(domain.label, domainLabel(domain.domain));
    const sum = STATUSES.reduce((total, status) => total + domain.statusCounts[status], 0);
    assert.equal(sum, domain.actionCount, `${domain.domain} 状态计数与动作数不守恒`);
    const severity = STATUSES.reduce((worst, status) =>
      STATUS_SEVERITY[status] > STATUS_SEVERITY[worst] && domain.statusCounts[status] > 0 ? status : worst,
    "LIVE");
    assert.equal(domain.status, severity, `${domain.domain} 域状态应为最严重态`);
    for (const entry of domain.manualEntries) {
      assert.ok(codes.has(entry.menuCode), `${domain.domain} 域内入口 ${entry.menuCode} 不在台账`);
      assert.ok(STATUSES.includes(entry.status), `${entry.menuCode} 域内状态非法`);
    }
  }
  const labeled = Object.values(DOMAIN_LABELS).filter((label) => /[\u4e00-\u9fa5]/.test(label));
  assert.ok(labeled.length >= 60, "域标签表应覆盖绝大多数业务域");
  return `${PARITY.domains.length} 域 / ${PARITY.domains.filter((d) => d.manualEntries.length > 0).length} 域含人工入口`;
});

// ── ⑩ mutation A：删动作映射 → 点名红 ───────────────────────────────────────
await run("mutation A 删动作映射：MISSING_ACTION_MAPPING 点名", () => {
  const target = MANUAL_PARITY.find((entry) => entry.actionCount > 0);
  const removed = target.actionIds[0];
  const mutatedRows = PARITY_ACTION_ROWS.filter((row) => row.id !== removed);
  const failures = validateParity({
    manualEntries: MANUAL_PARITY,
    actionRows: mutatedRows,
    aiCapabilities: AI_CAPABILITIES,
    manifest: MANIFEST_ITEMS,
    expectedActionTotal: 254,
  });
  assert.ok(
    failures.some((failure) => failure.code === "MISSING_ACTION_MAPPING" && failure.name === removed),
    `未点名被删动作 ${removed}：${failures.map((f) => f.code + ":" + f.name).join(" | ")}`,
  );
  assert.ok(failures.some((failure) => failure.code === "ACTION_COUNT_MISMATCH"), "删行应触发动作行数不符");
  return `点名 ${removed}`;
});

// ── ⑪ mutation B：删 route 映射 → 点名红 ────────────────────────────────────
await run("mutation B 删路由映射：MISSING_ROUTE_MAPPING 点名", () => {
  const target = MANUAL_PARITY.find((entry) => Boolean(entry.routeName));
  const mutatedManual = MANUAL_PARITY.map((entry) =>
    entry.menuCode === target.menuCode ? { ...entry, routeName: null } : entry,
  );
  const failures = validateParity({
    manualEntries: mutatedManual,
    actionRows: PARITY_ACTION_ROWS,
    aiCapabilities: AI_CAPABILITIES,
    manifest: MANIFEST_ITEMS,
  });
  assert.ok(
    failures.some((failure) => failure.code === "MISSING_ROUTE_MAPPING" && failure.name === target.routeName),
    `未点名被删路由 ${target.routeName}：${failures.map((f) => f.code + ":" + f.name).join(" | ")}`,
  );
  return `点名 ${target.routeName}`;
});

// ── ⑫ mutation C：PLANNED 洗 LIVE → 点名红 ──────────────────────────────────
await run("mutation C PLANNED 洗 LIVE：UNSAFE_LIVE 点名", () => {
  const target = PARITY_ACTION_ROWS.find((row) => row.status === "PLANNED" && !row.aiTool && !row.confirmChain);
  assert.ok(target, "应存在无 AI 工具的 PLANNED 行");
  const mutatedRows = PARITY_ACTION_ROWS.map((row) =>
    row.id === target.id ? { ...row, status: "LIVE" } : row,
  );
  const failures = validateParity({
    manualEntries: MANUAL_PARITY,
    actionRows: mutatedRows,
    aiCapabilities: AI_CAPABILITIES,
    manifest: MANIFEST_ITEMS,
    expectedActionTotal: 254,
  });
  assert.ok(
    failures.some((failure) => failure.code === "UNSAFE_LIVE" && failure.name === target.id),
    `未点名被洗状态 ${target.id}：${failures.map((f) => f.code + ":" + f.name).join(" | ")}`,
  );
  return `点名 ${target.id}`;
});

// ── ⑬ 报告与摘要一致性（生成物不得手写漂移） ─────────────────────────────────
await run("parity-report.json 与运行时一致：missingManualMappings=0、pass=true", () => {
  const reportPath = path.join(REPO_ROOT, "docs", "evidence", "WORKBENCH-03F1", "parity-report.json");
  assert.ok(existsSync(reportPath), "对等报告应存在");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.equal(report.baseline, BASELINE, "报告基线应为派单基线");
  assert.equal(report.manualEntries, 80);
  assert.equal(report.manualEntriesMapped, 80);
  assert.equal(report.missingManualMappings, 0, "探针口径 missingManualMappings 必须为 0");
  assert.equal(report.actionRows, 254);
  assert.equal(report.actionAnchors, 254);
  assert.equal(report.unmappedActionRows, 0);
  assert.equal(report.pass, true, "生成报告应 pass");
  assert.deepEqual(report.statusCounts, PARITY.statusCounts);
  assert.deepEqual(report.manualStatusCounts, PARITY.manualStatusCounts);
  assert.deepEqual(report.unregisteredDomains, [], "66 域应全部有中文标签");
  assert.deepEqual(report.orphanCapabilities, [], "不应存在孤儿能力");
  assert.equal(paritySummaryText(), "人工入口覆盖 80/80 · 动作覆盖 254/254");
  return "报告字段与运行时逐项一致";
});

// ── ⑭ UI：摘要 + 域展开，且未实现 AI 不隐藏人工入口 ─────────────────────────
await run("UI 接线：摘要来自台账计算，可展开业务域，不硬编码覆盖数", () => {
  const feed = read("components/workbench/AiFeedContainer.vue");
  for (const token of [
    'data-testid="parity-summary"',
    "paritySummaryText()",
    "PARITY",
    'data-testid="parity-expand"',
    'data-testid="parity-domains"',
    "domain.manualEntries",
    "readonlyEntries",
    "未实现 AI 的入口不会消失",
    "parity.statusCounts",
    "parity.manualStatusCounts",
  ]) {
    assert.ok(feed.includes(token), `能力台账缺少对等摘要要素：${token}`);
  }
  assert.ok(!feed.includes("人工入口覆盖 80/80"), "摘要不得硬编码覆盖数，必须来自台账计算");
  const ledger = read("shared/workbench/parity-ledger.ts");
  assert.ok(ledger.includes("manualRouteNames"), "能力模型应含 manualRouteNames");
  assert.ok(ledger.includes("manualActionIds"), "能力模型应含 manualActionIds");
  assert.ok(ledger.includes("experienceGain"), "能力模型应含 experienceGain");
  assert.ok(ledger.includes("manualFallback"), "能力模型应含 manualFallback");
  assert.ok(ledger.includes("aiOnly"), "能力模型应含 AI_ONLY 显式标记");
  return "摘要 + 66 域展开 + 只读分组 + 不消失文案";
});

// ── ⑮ 无 mock：对等数据不得含随机/模拟来源 ──────────────────────────────────
await run("无 mock：对等台账与生成物零随机/模拟数据", () => {
  const files = [
    "shared/workbench/parity-ledger.ts",
    "shared/workbench/parity-actions-gen.ts",
    "shared/workbench/parity-manual-gen.ts",
    "shared/workbench/parity-domains.ts",
    "components/workbench/AiFeedContainer.vue",
  ];
  const banned = ["Math.random", "mock", "Mock", "fake", "假数据", "示例数据", "随机"];
  for (const rel of files) {
    const text = read(rel);
    for (const word of banned) assert.ok(!text.includes(word), `${rel} 不得出现「${word}」`);
  }
  return `${files.length} 文件零命中`;
});

// ── ⑯ 业务冻结面与测试链守恒 ────────────────────────────────────────────────
/**
 * ⚠️ WORKBENCH-07 修正（记录变更依据，非"为过绿放宽"）：
 *   原断言 `changed === ""` 是 WORKBENCH-03F1 时期的**绝对冻结**口径，
 *   当时该卡红线为"views/backend 零改动"。但 WORKBENCH-07 派单卡 §三 **明确授权**修改：
 *     - `admin-web/src/views/dashboard/Dashboard.vue`
 *     - `admin-web/src/views/pos/StoreDashboardView.vue`
 *   （修复 WB-AUDIT-01/02/04/08 必须改这两个页面，属卡内合法范围）
 *   ⇒ 守卫意图（"不得越权改业务页"）是正确的，实现需从"绝对零改动"改为**授权白名单**：
 *      允许卡内点名的文件，**其余任何 views/backend 改动仍然判红**。
 *   这样守卫分辨力不降低：改第三个 views 文件照样红（见 dashboard-contract.spec 的越界反测）。
 */
const WORKBENCH_07_ALLOWED_VIEWS = [
  "admin-web/src/views/dashboard/Dashboard.vue",
  "admin-web/src/views/pos/StoreDashboardView.vue",
];

await run("业务冻结：views/backend 仅允许卡内授权文件改动，其余零改动；既有 5 个 spec 不减少", () => {
  const changed = execSync(`git diff --name-only ${BASELINE} -- admin-web/src/views backend`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .map((s) => s.replace(/\\/g, "/").trim())
    .filter(Boolean);
  const allowed = new Set(WORKBENCH_07_ALLOWED_VIEWS);
  const violations = changed.filter((f) => !allowed.has(f));
  assert.deepEqual(
    violations,
    [],
    `views/backend 出现**卡外**改动（授权清单外一律红）：${violations.join(", ")}`,
  );
  const pkg = JSON.parse(readFileSync(path.join(here, "..", "package.json"), "utf8"));
  for (const spec of ["role-guard", "landing", "workbench-shell", "ai-primary", "parity-coverage"]) {
    assert.ok(pkg.scripts.test.includes(`tests/${spec}.spec.mjs`), `npm test 应包含 ${spec}.spec.mjs`);
  }
  return `授权内改动 ${changed.length} 个（${changed.join(", ") || "无"}）+ 卡外 0 个 + 5 个 spec 串联`;
});

const failed = results.filter((result) => !result.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;