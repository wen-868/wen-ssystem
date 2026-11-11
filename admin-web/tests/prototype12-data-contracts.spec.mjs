/**
 * WORKBENCH-PROTOTYPE-12-S1-DATA-CONTRACTS-01 · 前端数据契约测试
 *
 * 覆盖（卡面 §三 / 硬验收 6 条）：
 *   ① /api/chat/confirmations 三类返回形态（{total,items} / {confirmations} / 裸数组）
 *      均有解析与测试；未知形态归 unknown ⇒ error，绝不假 0（D05）；
 *   ② 员工目录真实字段映射，无 online 真源 ⇒ online 恒 null，不显示 N/M 在线（D06/D07）；
 *   ③ 员工任务 running/completed/failed 原样映射，未知状态不猜（D08）；
 *   ④ 计划/步骤六态 pending/running/success/failed/suspended/skipped，未知不猜（D09）；
 *   ⑤ task-center / morning-brief 各数据源独立 loading/empty/error/timeout 状态对象；
 *   ⑥ 顶部计数与列表同源（deriveTaskCenterCounts / deriveMorningBriefHeadline 只读已解析 data）；
 *   ⑦ 四个 MISSING 数据块业务级 unavailable + 文案，零原型演示数据（D03/D04/D07/D11/D14）。
 *
 * ⚠️ 本文件是**解析器单测**：用真实契约形态样例测「解析函数本身」
 *    （契约出处见 task-center.ts / morning-brief.ts 顶部注释，后端源码直读）。
 *    —— 禁止 mock 网络成功冒充真实契约验证；
 *    —— 真实接口读数验证走 dev + 真实/transport 上游，另行留证（证据目录）。
 *
 * 运行：node admin-web/tests/prototype12-data-contracts.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { registerHooks } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");

// ── 以 .ts 直载：裸导入不补 .ts 扩展名，挂 resolve hook（同 ai-status-truth.spec.mjs 范式）──
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});

const taskCenter = await import(pathToFileURL(path.join(SRC, "shared/workbench/task-center.ts")).href);
const morningBrief = await import(pathToFileURL(path.join(SRC, "shared/workbench/morning-brief.ts")).href);
const agentDirectory = await import(pathToFileURL(path.join(SRC, "shared/workbench/agent-directory.ts")).href);
// morning-brief 与 Dashboard 页共用同一解析器（同源口径），此处直载同一实现验证嵌套契约
const dashboardContract = await import(pathToFileURL(path.join(SRC, "utils/dashboard-contract.ts")).href);

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
}
/** 剥注释，只留可执行代码（避免注释里合法提及被误判） */
function codeOnly(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"`])\/\/.*$/gm, "$1");
}

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

// ═══════════════════════════════════════════════════════════════════════════
// 一、待确认三形态（D05 · 硬验收 1）
// ═══════════════════════════════════════════════════════════════════════════

// 现行底座契约：ai-base chat.controller.ts:239/256 返回 { total, items }
const LIVE_SHAPE = {
  total: 2,
  items: [
    { confirmationId: "conf-1", operation: "create_customer", summary: "新建客户 A", details: { amount: 100 } },
    { confirmationId: "conf-2", operation: "update_price", summary: "调价 B" },
  ],
};
// 历史包装形态（旧前端 fetchAiConfirmations 兼容目标）
const LEGACY_SHAPE = { confirmations: [{ confirmationId: "conf-3", operation: "x" }] };
// 旧假设形态（裸数组）
const ARRAY_SHAPE = [{ id: "conf-4", operation: "y" }];

await run("待确认形态①{total,items}：解析出真实记录数（现行底座契约）", () => {
  const p = taskCenter.parseConfirmationsPayload(LIVE_SHAPE);
  assert.equal(p.kind, "items");
  assert.equal(p.total, 2, "顶部计数 = 去重后真实记录数");
  assert.equal(p.items.length, 2);
  assert.equal(p.reportedTotal, 2);
  assert.equal(p.droppedRows, 0);
  return `kind=items total=2/2`;
});

await run("待确认形态②{confirmations}包装：兼容解析", () => {
  const p = taskCenter.parseConfirmationsPayload(LEGACY_SHAPE);
  assert.equal(p.kind, "confirmations");
  assert.equal(p.total, 1);
  return `kind=confirmations total=1`;
});

await run("待确认形态③裸数组：兼容解析", () => {
  const p = taskCenter.parseConfirmationsPayload(ARRAY_SHAPE);
  assert.equal(p.kind, "array");
  assert.equal(p.total, 1);
  return `kind=array total=1`;
});

await run("待确认未知形态 ⇒ unknown（调用方按 error 处理，绝不假 0）", () => {
  for (const bad of [{ foo: 1 }, { total: 3 }, "text", 42, null, { records: [] }]) {
    const p = taskCenter.parseConfirmationsPayload(bad);
    assert.equal(p.kind, "unknown", `形态 ${JSON.stringify(bad)} 必须归 unknown`);
  }
  return "6 种未知形态全部 unknown";
});

await run("待确认去重与脏行：总数以去重后真实记录为准（D05），丢弃行如实披露", () => {
  const p = taskCenter.parseConfirmationsPayload({
    total: 4,
    items: [{ confirmationId: "a" }, { confirmationId: "a" }, { id: "b" }, "junk", {}, { confirmationId: "" }],
  });
  assert.equal(p.kind, "items");
  assert.equal(p.total, 2, "重复 conf-1 去重 + 3 个无 ID/非对象行丢弃 ⇒ 2 条真实记录");
  assert.equal(p.droppedRows, 3, "junk / {} / 空 confirmationId 三行被如实披露丢弃");
  assert.equal(p.reportedTotal, 4, "壳层 total 仅披露，不冒充列表");
});

await run("空列表形态 {total:0,items:[]} ⇒ items=[]（真空，不是失败）", () => {
  const p = taskCenter.parseConfirmationsPayload({ total: 0, items: [] });
  assert.equal(p.kind, "items");
  assert.deepEqual(p.items, []);
  assert.equal(p.total, 0);
});

await run("api/ai.ts 已接唯一解析器：unknown 形态必须抛错（不静默返回空数组）", () => {
  const code = codeOnly(read("api/ai.ts"));
  assert.ok(code.includes("parseConfirmationsPayload"), "fetchAiConfirmations 必须经 task-center 唯一解析器");
  assert.ok(
    /parsed\.kind\s*===\s*["']unknown["'][\s\S]{0,400}?throw new Error/.test(code),
    "unknown 形态必须 throw（旧实现 ?? [] 把解析失败伪装成空列表）",
  );
  assert.ok(!/confirmations\s*\?\?\s*\[\]/.test(code), "禁止 ?? [] 吞掉未知形态");
});

// ═══════════════════════════════════════════════════════════════════════════
// 二、员工目录（D06/D07 · 不虚构在线分母）
// ═══════════════════════════════════════════════════════════════════════════

// ai-base employee.service.ts list(): { id, employeeUid, name, post, department, dispatchUids, status }
const EMPLOYEES_SHAPE = [
  { id: 1, employeeUid: "emp:1", name: "真实甲", post: "店长", department: "门店运营", dispatchUids: [], status: "管理岗" },
  { id: 2, employeeUid: "emp:2", name: "真实乙", post: "导购", department: "门店运营", dispatchUids: [], status: "就绪" },
  { id: 3, employeeUid: "emp:3", name: "真实丙", post: "客服", department: "总部", dispatchUids: [], status: "就绪" },
];

await run("员工目录：真实字段映射 + 按部门分组", () => {
  const d = agentDirectory.parseEmployeeDirectoryPayload(EMPLOYEES_SHAPE);
  assert.equal(d.state, "ready");
  assert.equal(d.enabledCount, 3);
  const depts = d.groups.map((g) => g.name).sort();
  assert.deepEqual(depts, ["总部", "门店运营"]);
  const first = d.groups.find((g) => g.name === "门店运营").staffs[0];
  assert.equal(first.name, "真实甲");
  assert.equal(first.post, "店长");
  assert.equal(first.summary, "门店运营");
  return `3 人 / 2 组`;
});

await run("员工目录：无 online 真源 ⇒ online 恒 null（D07 不显示 N/M 在线）", () => {
  const d = agentDirectory.parseEmployeeDirectoryPayload(EMPLOYEES_SHAPE);
  for (const g of d.groups) {
    for (const s of g.staffs) {
      assert.equal(s.online, null, "底座无 online 字段 ⇒ 必须为 null");
      assert.equal(s.unread, null);
    }
  }
  assert.match(d.message, /^3 名员工已启用$/, "口径文案 = 「N 名员工已启用」");
});

await run("员工目录：空数组 ⇒ ready 业务空态（真空 ≠ 失败）；非数组 ⇒ error（不知道 ≠ 没有）", () => {
  const empty = agentDirectory.parseEmployeeDirectoryPayload([]);
  assert.equal(empty.state, "ready");
  assert.equal(empty.enabledCount, 0);
  assert.match(empty.message, /^0 名员工已启用$/);
  const bad = agentDirectory.parseEmployeeDirectoryPayload({ data: [] });
  assert.equal(bad.state, "error");
  assert.match(bad.message, /形状异常/);
});

await run("员工目录：loadHistoryConversations 恒 unavailable（D11 历史会话 MISSING）", async () => {
  const conv = await agentDirectory.loadHistoryConversations();
  assert.equal(conv.state, "unavailable");
  assert.deepEqual(conv.groups, []);
  assert.match(conv.message, /暂不可用/);
});

await run("员工目录源码：无 14 个原型助理姓名、无 N/M 在线硬编码（D06/D07/D14）", () => {
  const code = codeOnly(read("shared/workbench/agent-directory.ts"));
  const mockStaffNames = ["小播", "小审", "小异", "小护", "小催", "小账", "小码", "小溯", "小客", "小会", "小品", "小价", "小效", "小配"];
  for (const name of mockStaffNames) {
    assert.ok(!code.includes(name), `原型演示员工「${name}」不得进入实现源码`);
  }
  assert.ok(!/\d+\s*\/\s*\d+\s*在线/.test(code), "不得硬编码 N/M 在线");
  assert.ok(!code.includes("online: true"), "不得伪造在线状态");
});

// ═══════════════════════════════════════════════════════════════════════════
// 三、员工任务（D08 · running/completed/failed）
// ═══════════════════════════════════════════════════════════════════════════

await run("员工任务：三态原样映射 + 分桶计数", () => {
  const p = taskCenter.parseEmployeeTasksPayload([
    { id: 1, task: "巡检库存", status: "running", dispatchedBy: "user", resultSummary: null },
    { id: 2, task: "盘点", status: "completed", resultSummary: "完成" },
    { id: 3, task: "对账", status: "failed", resultSummary: "余额不平" },
  ]);
  assert.equal(p.kind, "array");
  assert.deepEqual(p.counts, { running: 1, completed: 1, failed: 1, unknown: 0 });
  assert.equal(p.tasks[1].status, "completed");
  assert.equal(p.tasks[2].resultSummary, "余额不平");
});

await run("员工任务：未知状态归 null 不猜 + unknown 计数（D08 不猜）", () => {
  const p = taskCenter.parseEmployeeTasksPayload([
    { id: 1, status: "pending_review" },
    { id: 2, status: "RUNNING" },
  ]);
  assert.equal(p.tasks[0].status, null);
  assert.equal(p.counts.unknown, 1, "未知状态计入 unknown，不进任何已知桶");
  assert.equal(p.tasks[1].status, "running", "大写归一为小写");
  assert.equal(p.counts.running, 1);
});

await run("员工任务：非数组 ⇒ unknown；空数组 ⇒ 真实空列表", () => {
  assert.equal(taskCenter.parseEmployeeTasksPayload({ items: [] }).kind, "unknown");
  const empty = taskCenter.parseEmployeeTasksPayload([]);
  assert.equal(empty.kind, "array");
  assert.deepEqual(empty.tasks, []);
});

// ═══════════════════════════════════════════════════════════════════════════
// 四、计划六态（D09 · 硬验收：六态枚举从后端契约核实）
// ═══════════════════════════════════════════════════════════════════════════

await run("计划六态枚举与底座逐字一致（ai-base agent.types.ts:14-23）", () => {
  assert.deepEqual(
    [...taskCenter.PLAN_STEP_STATUSES],
    ["pending", "running", "success", "failed", "suspended", "skipped"],
  );
  for (const s of taskCenter.PLAN_STEP_STATUSES) {
    assert.equal(taskCenter.normalizePlanStatus(s), s);
    assert.equal(taskCenter.normalizePlanStatus(s.toUpperCase()), s, "大小写归一");
  }
  for (const fake of ["done", "completed", "cancelled", "rejected", "aborted", ""]) {
    assert.equal(taskCenter.normalizePlanStatus(fake), null, `虚构状态 ${fake} 必须返回 null`);
  }
});

await run("计划折算：suspended 计进行中（挂起待人工）、success/failed/skipped 为终态", () => {
  const p = taskCenter.parsePlansPayloadForTaskCenter({
    success: true,
    total: 6,
    items: [
      { id: 1, goal: "a", state: "pending", steps: [] },
      { id: 2, goal: "b", state: "running", steps: [] },
      { id: 3, goal: "c", state: "suspended", steps: [] },
      { id: 4, goal: "d", state: "success", steps: [] },
      { id: 5, goal: "e", state: "failed", steps: [] },
      { id: 6, goal: "f", state: "skipped", steps: [] },
    ],
  });
  assert.equal(p.kind, "items");
  assert.equal(p.totalPlans, 6);
  assert.equal(p.runningPlans, 3, "pending+running+suspended 计进行中");
  assert.equal(p.unknownStates, 0);
});

await run("计划步骤口径：完成只认 success；skipped 占位不计完成；未知状态计数披露", () => {
  const p = taskCenter.parsePlansPayloadForTaskCenter({
    success: true,
    total: 1,
    items: [
      {
        id: 1,
        goal: "g",
        state: "running",
        steps: [
          { id: "s1", label: "L1", type: "tool", status: "success" },
          { id: "s2", label: "L2", type: "tool", status: "skipped" },
          { id: "s3", label: "L3", type: "tool", status: "mystery" },
        ],
      },
    ],
  });
  assert.equal(p.stepsTotal, 3);
  assert.equal(p.stepsDone, 1, "只数 success");
  assert.equal(p.unknownStates, 1, "mystery 不进任何桶但如实计数");
  assert.equal(p.plans[0].steps[2].status, null);
});

await run("计划：success=false ⇒ failed 带底座原因；非对象/缺 items ⇒ 形状异常", () => {
  const f = taskCenter.parsePlansPayloadForTaskCenter({ success: false, error: "未认证" });
  assert.equal(f.failed, true);
  assert.equal(f.errorMessage, "未认证");
  const bad = taskCenter.parsePlansPayloadForTaskCenter({ foo: 1 });
  assert.equal(bad.kind, "unknown");
  assert.match(bad.errorMessage, /形状异常/);
});

// ═══════════════════════════════════════════════════════════════════════════
// 五、通知 + 晨报解析（D01/D02/D13）
// ═══════════════════════════════════════════════════════════════════════════

await run("通知：{total,page,pageSize,records} 解析（backend notification-center.service 同形态）", () => {
  const p = taskCenter.parseNotificationsPayload({
    total: 2,
    page: 1,
    pageSize: 20,
    records: [
      { id: 1, title: "库存预警", content: "A", type: "inventory", isRead: 0, createdAt: "2026-11-11 07:00:00" },
      { id: 2, title: "对账提醒", content: "B", type: "system", isRead: 1 },
    ],
  });
  assert.equal(p.kind, "payload");
  assert.equal(p.notifications.length, 2);
  assert.equal(p.total, 2);
  assert.equal(p.notifications[0].isRead, false, "isRead=0 ⇒ false");
  assert.equal(p.notifications[1].isRead, true, "isRead=1 ⇒ true");
  assert.equal(taskCenter.parseNotificationsPayload({ total: 0 }).kind, "unknown", "缺 records ⇒ unknown");
});

// backend getOverview 嵌套契约：{ today:{salesAmount,orderCount,...}, month:{...} }
const OVERVIEW_SHAPE = {
  today: { salesAmount: 12345.6, orderCount: 21, receivedAmount: 12000, compareYesterday: { salesAmountChange: 6.2 } },
  month: { salesAmount: 234567.8, orderCount: 300 },
};

await run("晨报-经营概览：复用 dashboard-contract 嵌套解析器（与 Dashboard 页同源）", () => {
  // morning-brief.loadOverviewBlock 内部走 parseDashboardOverview；这里直载同一实现验证嵌套契约
  const parsed = dashboardContract.parseDashboardOverview(OVERVIEW_SHAPE);
  assert.ok(parsed.ok === true, "嵌套契约主体存在 ⇒ ok");
  assert.equal(parsed.data.today.salesAmount, 12345.6);
  assert.equal(parsed.data.today.orderCount, 21);
  assert.equal(parsed.data.month.salesAmount, 234567.8);
  const bad = dashboardContract.parseDashboardOverview({ foo: 1 });
  assert.ok(bad.ok === false, "缺 today/month 主体 ⇒ 失败（不得当空态）");
  const code = read("shared/workbench/morning-brief.ts");
  assert.ok(code.includes("parseDashboardOverview"), "morning-brief 必须复用同一解析器");
  return "嵌套 today/month 解析同源";
});

await run("晨报-库存预警：URGENT/WARNING 分桶；未知级别归 null 计数（D02）", () => {
  const w = morningBrief.parseInventoryWarningsPayload([
    { skuName: "SKU-A", storeName: "总店", currentStock: 1, warningThreshold: 5, warningLevel: "URGENT" },
    { skuName: "SKU-B", storeName: "总店", currentStock: 3, warningThreshold: 5, warningLevel: "WARNING" },
    { skuName: "SKU-C", storeName: "分店", currentStock: 2, warningThreshold: 5, warningLevel: "CRITICAL" },
  ]);
  assert.equal(w.kind, "array");
  assert.equal(w.urgentCount, 1);
  assert.equal(w.warningCount, 1);
  assert.equal(w.unknownLevels, 1, "CRITICAL 非已知级别 ⇒ null + 计数");
  assert.equal(w.warnings[2].warningLevel, null);
  assert.equal(morningBrief.parseInventoryWarningsPayload({ warnings: [] }).kind, "unknown");
});

await run("晨报 MISSING 块：应收到期/商品级负毛利 恒 unavailable + 中性文案 + data=null（D03/D04）", () => {
  for (const [block, auditRef] of [
    [morningBrief.morningBrief.receivableDue, "D03"],
    [morningBrief.morningBrief.marginAnomaly, "D04"],
  ]) {
    assert.equal(block.status, "unavailable", `${auditRef} 块必须业务级不可用`);
    assert.equal(block.data, null, `${auditRef} 块不得填任何数据`);
    assert.match(block.message, /暂不可用/);
    assert.match(block.message, new RegExp(auditRef));
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 六、数据源独立四态 + 顶部计数同源（D12 / 硬验收 2、3）
// ═══════════════════════════════════════════════════════════════════════════

await run("各数据源状态对象相互独立（不复用同一状态对象，D12）", () => {
  const s = taskCenter.taskCenterSnapshot;
  const keys = ["confirmations", "employeeTasks", "plans", "notifications", "historySessions"];
  const seen = new Set();
  for (const k of keys) {
    assert.ok(s[k], `缺少数据源 ${k}`);
    assert.ok(!seen.has(s[k]), `${k} 与其他源复用了同一状态对象`);
    seen.add(s[k]);
    assert.equal(s[k].status, "idle");
  }
  // 修改一个源不影响另一个源（独立性硬断言）
  const before = s.plans.status;
  s.confirmations.status = "error";
  assert.equal(s.plans.status, before, "plans 状态不得被 confirmations 连带污染");
  s.confirmations.status = "idle";
});

await run("失败分类：AbortError/ETIMEDOUT ⇒ timeout；普通错误 ⇒ error（严格区分）", () => {
  const abort = new DOMException("This operation was aborted", "AbortError");
  assert.equal(taskCenter.classifySourceFailure(abort).status, "timeout", "fetch abort ⇒ timeout");
  const t2 = taskCenter.classifySourceFailure({ code: "ECONNABORTED", message: "timeout of 8000ms exceeded" });
  assert.equal(t2.status, "timeout", "axios 超时 ⇒ timeout");
  const t3 = taskCenter.classifySourceFailure({ code: "ETIMEDOUT", message: "连接超时" });
  assert.equal(t3.status, "timeout");
  const e = taskCenter.classifySourceFailure(new Error("HTTP 500"));
  assert.equal(e.status, "error");
  const e2 = taskCenter.classifySourceFailure(Object.assign(new Error("网络错误"), { name: "TypeError" }));
  assert.equal(e2.status, "error");
});

await run("顶部计数与列表同源：deriveTaskCenterCounts 只读各源 data（硬验收 3）", () => {
  const s = taskCenter.taskCenterSnapshot;
  // ready 源：计数 = 列表长度（同一数据集）
  s.confirmations = { key: "confirmations", label: "待确认", status: "ready", data: [{ confirmationId: "a" }, { confirmationId: "b" }], message: "", error: null, fetchedAt: "2026-11-11" };
  s.employeeTasks = { key: "employeeTasks", label: "员工任务", status: "ready", data: [{ id: 1, task: "t", status: "running", resultSummary: null, dispatchedBy: "user", createdAt: null, updatedAt: null }, { id: 2, task: "u", status: "completed", resultSummary: null, dispatchedBy: "user", createdAt: null, updatedAt: null }], message: "", error: null, fetchedAt: "2026-11-11" };
  s.plans = { key: "plans", label: "执行计划", status: "ready", data: [{ id: 1, goal: "g", state: "running", steps: [], stepsTotal: 0, stepsDone: 0 }, { id: 2, goal: "h", state: "success", steps: [], stepsTotal: 0, stepsDone: 0 }], message: "", error: null, fetchedAt: "2026-11-11" };
  s.notifications = { key: "notifications", label: "通知", status: "empty", data: [], message: "真实空列表", error: null, fetchedAt: "2026-11-11" };
  s.historySessions = { key: "historySessions", label: "历史会话", status: "unavailable", data: null, message: "x", error: null, fetchedAt: null };
  const c = taskCenter.deriveTaskCenterCounts(s);
  assert.equal(c.confirmations, 2);
  assert.equal(c.employeeTasks, 2);
  assert.equal(c.employeeTasksRunning, 1);
  assert.equal(c.plansTotal, 2);
  assert.equal(c.plansRunning, 1);
  assert.equal(c.notifications, 0, "真实空列表的 0 是真空（empty 态可见），不是假 0");
  // 失败/不可用源 ⇒ null（不显示假 0）
  s.confirmations = { ...s.confirmations, status: "error", data: null };
  s.plans = { ...s.plans, status: "timeout", data: null };
  const c2 = taskCenter.deriveTaskCenterCounts(s);
  assert.equal(c2.confirmations, null, "error 源计数必须 null");
  assert.equal(c2.plansRunning, null, "timeout 源计数必须 null");
  assert.equal(c2.plansTotal, null);
  taskCenter.__resetTaskCenterForTest();
});

await run("晨报头条同源：deriveMorningBriefHeadline 只读已解析 data；missing 块不给数字", () => {
  const s = morningBrief.morningBrief;
  s.overview = { key: "overview", label: "经营概览", status: "ready", data: { today: { salesAmount: 12345.6, orderCount: 21, grossProfit: null }, month: { salesAmount: 0, orderCount: 0, grossProfit: null } }, message: "", error: null, fetchedAt: "2026-11-11" };
  s.inventoryWarnings = { key: "inventoryWarnings", label: "库存安全线", status: "ready", data: [{ skuName: "A", storeName: "S", currentStock: 1, warningThreshold: 5, warningLevel: "URGENT" }, { skuName: "B", storeName: "S", currentStock: 2, warningThreshold: 5, warningLevel: "WARNING" }], message: "", error: null, fetchedAt: "2026-11-11" };
  s.notifications = { key: "notifications", label: "通知", status: "error", data: null, message: "x", error: "x", fetchedAt: null };
  const h = morningBrief.deriveMorningBriefHeadline(s);
  assert.equal(h.todaySalesAmount, 12345.6);
  assert.equal(h.todayOrderCount, 21);
  assert.equal(h.inventoryWarningCount, 2);
  assert.equal(h.urgentInventoryCount, 1);
  assert.equal(h.notificationCount, null, "error 源 ⇒ null 不假 0");
  morningBrief.__resetMorningBriefForTest();
});

// ═══════════════════════════════════════════════════════════════════════════
// 七、演示夹具红线（D14）+ 结构护栏
// ═══════════════════════════════════════════════════════════════════════════

await run("五个实现文件：原型演示金额/商品/姓名零命中（D14）", () => {
  const files = [
    "api/ai.ts",
    "shared/workbench/agent-metrics.ts",
    "shared/workbench/agent-directory.ts",
    "shared/workbench/task-center.ts",
    "shared/workbench/morning-brief.ts",
  ];
  const banned = ["五粮液", "12,860", "¥12,860", "小播", "小审", "小异", "环比 +6.2%", "张经理", "李店长"];
  for (const rel of files) {
    const text = read(rel);
    for (const b of banned) {
      assert.ok(!text.includes(b), `${rel} 出现原型演示数据「${b}」`);
    }
  }
  return "9 个演示 token × 5 文件 零命中";
});

await run("task-center/morning-brief：四态语义齐备（empty/error/timeout/unavailable）", () => {
  const tcCode = read("shared/workbench/task-center.ts");
  const mbCode = read("shared/workbench/morning-brief.ts");
  // task-center 是四态语义的唯一实现处
  for (const state of ['"empty"', '"error"', '"timeout"', '"unavailable"']) {
    assert.ok(tcCode.includes(state), `task-center 缺 ${state} 态`);
  }
  assert.ok(tcCode.includes("Promise.allSettled"), "task-center 各源并行失败隔离");
  // morning-brief 经共享类型 TaskSourceStatus + classifySourceFailure 复用同一四态口径
  assert.ok(mbCode.includes("TaskSourceStatus"), "morning-brief 复用 task-center 四态类型");
  assert.ok(mbCode.includes("classifySourceFailure"), "morning-brief 复用统一失败分类（error/timeout）");
  assert.ok(mbCode.includes('"empty"'), "morning-brief 有 empty 态");
  assert.ok(mbCode.includes('"unavailable"'), "morning-brief 有 unavailable 态（MISSING 块）");
  assert.ok(mbCode.includes("Promise.allSettled"), "morning-brief 各块并行失败隔离");
});

await run("morning-brief 不依赖 AI 底座端点（AI 失败不阻断人工页面，硬验收 4）", () => {
  const code = codeOnly(read("shared/workbench/morning-brief.ts"));
  assert.ok(!code.includes("api/chat"), "不得调用 AI 底座 chat 端点");
  assert.ok(!code.includes("ai/employees"), "不得调用 AI 底座员工端点");
  assert.ok(!code.includes("AI_BASE_URL"), "不得直连 AI 底座");
  assert.ok(code.includes("/admin/dashboard/overview"), "走主后端经营概览");
  assert.ok(code.includes("/admin/dashboard/inventory-warning"), "走主后端库存预警");
  assert.ok(code.includes("/admin/notifications"), "走主后端通知");
});

await run("task-center：AI 源失败隔离结构（独立装载器 + allSettled，不整体抛错）", () => {
  const code = codeOnly(read("shared/workbench/task-center.ts"));
  for (const fn of ["loadConfirmationsSource", "loadEmployeeTasksSource", "loadPlansSource", "loadNotificationsSource"]) {
    assert.ok(code.includes(`export async function ${fn}`), `缺少独立装载器 ${fn}`);
  }
  assert.ok(code.includes("markHistorySessionsUnavailable"), "历史会话 MISSING 显式 unavailable（D11）");
});

// ═══════════════════════════════════════════════════════════════════════════
// 汇总
// ═══════════════════════════════════════════════════════════════════════════

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) {
  for (const f of failed) console.log(`FAILED: ${f.name}`);
  process.exit(1);
}
