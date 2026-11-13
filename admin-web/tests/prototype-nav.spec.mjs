/**
 * WORKBENCH-10 · 工作台原型 UI/UX 契约测试（UIUX 对齐 · 阶段一壳层与导航）
 *
 * 覆盖派单卡 §四-A 与 §五 硬验收：
 *   §A.1 最左 rail 与原型一致（工作台 + 一级业务模块 + 设置）
 *   §A.2 点击一级模块后第二栏呈现对应二级目录（数量与名称可机器对照）
 *   §A.3 再次点击一级模块恢复「常用功能」
 *   §A.4 侧栏可折叠（56px 折叠态而非消失）
 *   §A.5 员工/对话双入口、部门分组
 *   §五.2 二级目录数量与名称可机器对照
 *
 * 真相源三层，**不接受手抄**：
 *   ① 原型 DOM（Playwright 真实加载后抽取）→ 中央原始证据；
 *   ② `tests/fixtures/workbench-prototype-rail.json` = ① 的机器副本（tools/gen-prototype-fixture.cjs 生成）；
 *   ③ `src/shared/workbench/prototype-nav.ts` = 运行时真相源。
 * 本文件断言 ③ ≡ ②，任一侧被手工改动都会点名变红。
 *
 * 与既有分工的边界：本文件只管「原型长什么样」；
 * 「谁能看」仍由<｜hy_place▁holder▁no▁813｜>/leader.meta.roles 派生，归既有的 workbench-shell / menu-ai-bridge 用例。
 *
 * 运行：node admin-web/tests/prototype-nav.spec.mjs（已串入 npm test）
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");

const FIXTURE = JSON.parse(
  readFileSync(path.join(here, "fixtures", "workbench-prototype-rail.json"), "utf8"),
);

// .ts 直载（Node 原生 type stripping）；Windows 绝对路径必须转 file:// URL
const nav = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "prototype-nav.ts")).href);
const shell = readFileSync(path.join(SRC, "layouts", "WorkbenchShell.vue"), "utf8");
const subnav = readFileSync(path.join(SRC, "layouts", "WorkbenchSubnav.vue"), "utf8");

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

/** 剥注释，只留可执行代码（避免注释里合法提及被误判） */
function codeOnly(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"`])\/\/.*$/gm, "$1");
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. 一级 rail：项数、顺序、文案 → 逐项机器对照原型
// ═══════════════════════════════════════════════════════════════════════════

await run("一级 rail：项数 = 原型实测 13（工作台 + 11 业务模块 + 设置）", () => {
  assert.equal(nav.PROTOTYPE_RAIL_ITEMS.length, FIXTURE.railNames.length, "rail 项数必须等于原型实测");
  assert.equal(nav.PROTOTYPE_RAIL_ITEMS.length, nav.PROTOTYPE_RAIL_COUNT, "常量与数组必须自洽");
  return `${nav.PROTOTYPE_RAIL_COUNT} 项（与夹具 ${FIXTURE.railNames.length} 一致）`;
});

await run("一级 rail：顺序逐项 = 原型顺序（含 broke/order 与 prototype/manifest 顺序差异项）", () => {
  const actual = nav.PROTOTYPE_RAIL_ITEMS.map((i) => i.label);
  assert.deepEqual(actual, FIXTURE.railNames, "rail 顺序必须逐字等于原型");
  return actual.join(" / ");
});

await run("一级 rail：业务模块数 = 11，且 desk 首位、settings 末位", () => {
  const items = nav.PROTOTYPE_RAIL_ITEMS;
  assert.equal(items.filter((i) => i.kind === "module").length, nav.PROTOTYPE_BUSINESS_MODULE_COUNT);
  assert.equal(items[0].key, "desk", "工作台必须是第一项");
  assert.equal(items.at(-1).key, "settings", "设置必须是最后一项");
  return `desk 首位 / 业务模块 ${nav.PROTOTYPE_BUSINESS_MODULE_COUNT} / settings 末位`;
});

await run("一级 rail：13 项 key 唯一（不可重名导致选中态互相顶掉）", () => {
  const keys = nav.PROTOTYPE_RAIL_ITEMS.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, `key 重复：${keys}`);
  return `${keys.length} 个唯一 key`;
});

await run("一级 rail：groupCode 与 manifest 分组集合一一对应（无孤儿、无缺失）", () => {
  const manifest = new Set();
  for (const f of ["manifest-manual-a.ts", "manifest-manual-b.ts"]) {
    const text = readFileSync(path.join(SRC, "shared", "workbench", f), "utf8");
    for (const m of text.matchAll(/groupCode:\s*"([^"]+)"/g)) manifest.add(m[1]);
  }
  const declared = new Set(
    nav.PROTOTYPE_RAIL_ITEMS.filter((i) => i.groupCode).map((i) => i.groupCode),
  );
  const ghost = [...declared].filter((c) => !manifest.has(c));
  const orphan = [...manifest].filter((c) => !declared.has(c));
  assert.deepEqual(ghost, [], `真相源声明了 manifest 没有的组：${ghost}`);
  assert.deepEqual(orphan, [], `manifest 有、真相源未声明（会被静默丢弃）：${orphan}`);
  return `双向对齐 ${manifest.size} 组`;
});

await run("一级 rail：groupCode 不被两项重复映射", () => {
  const codes = nav.PROTOTYPE_RAIL_ITEMS.filter((i) => i.groupCode).map((i) => i.groupCode);
  assert.equal(new Set(codes).size, codes.length, `groupCode 重复：${codes}`);
  return `${codes.length} 个组码互不重复`;
});

await run("一级 rail：设置项 groupCode=null（不与业务模块争路由归属）", () => {
  const settings = nav.PROTOTYPE_RAIL_ITEMS.find((i) => i.key === "settings");
  assert.equal(settings.groupCode, null, "设置必须显式 null");
  assert.equal(settings.kind, "settings");
  return "groupCode=null / kind=settings";
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. 二级目录：逐组逐项机器对照
// ═══════════════════════════════════════════════════════════════════════════

await run("二级目录：13 组逐组 = 原型二级目录（以「实际渲染目录」对照）", () => {
  const diffs = [];
  for (const item of nav.PROTOTYPE_RAIL_ITEMS) {
    const expected = FIXTURE.subnavByName[item.label];
    // 「设置」在真相源里声明为无专属目录，渲染时经 resolveSubnavCatalogKey 回落 desk；
    // 原型 DOM 实测也正是 heading=常用功能 6 项 ⇒ 必须比对「渲染后目录」而非原始声明。
    const renderedKey = nav.resolveSubnavCatalogKey(item.key);
    const actual = nav.PROTOTYPE_SUBCATALOG[renderedKey];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      diffs.push(
        `${item.label}(${item.key}${renderedKey !== item.key ? `→${renderedKey}` : ""}): 期望${(expected ?? []).length}项 实际${(actual ?? []).length}项`,
      );
    }
  }
  assert.deepEqual(diffs, [], `二级目录与原型不符：\n  - ${diffs.join("\n  - ")}`);
  const rendered = nav.PROTOTYPE_RAIL_ITEMS.map(
    (i) => nav.PROTOTYPE_SUBCATALOG[nav.resolveSubnavCatalogKey(i.key)].length,
  );
  return `${rendered.length} 组全等（渲染项数 ${rendered.join("/")}）`;
});

await run("二级目录：二级卡片总数 = 原型 93 项（含设置 0 项）", () => {
  const total = Object.values(nav.PROTOTYPE_SUBCATALOG).reduce((s, a) => s + a.length, 0);
  const expected = Object.values(FIXTURE.subnavByName)
    .filter((_v, i) => i !== FIXTURE.railNames.indexOf("设置"))
    .reduce((s, a) => s + a.length, 0);
  assert.equal(total, expected, `二级卡片总数应为 ${expected}`);
  return `${total} 项`;
});

await run("二级目录：第二栏短标题逐项 = 原型 heading（如 销售管理→销售）", () => {
  const diffs = [];
  for (const item of nav.PROTOTYPE_RAIL_ITEMS) {
    const expected = FIXTURE.headByName[item.label];
    const actual = nav.PROTOTYPE_SUBNAV_HEADS[item.key];
    if (actual !== expected) diffs.push(`${item.label}: 期望「${expected}」实际「${actual}」`);
  }
  assert.deepEqual(diffs, [], `第二栏标题与原型不符：\n  - ${diffs.join("\n  - ")}`);
  return `13 组标题全等（含 销售/订单/采购/库存/客户/财务/系统 短化）`;
});

await run("二级目录：标题 ≠ rail 项名的组存在（证明没有把一级名抄成标题）", () => {
  const shortened = nav.PROTOTYPE_RAIL_ITEMS.filter(
    (i) => nav.PROTOTYPE_SUBNAV_HEADS[i.key] !== i.label,
  );
  assert.ok(shortened.length >= 6, `短化组数过少（${shortened.length}），疑似标题照抄一级名`);
  return `${shortened.length} 组短化：${shortened.map((i) => `${i.label}→${nav.PROTOTYPE_SUBNAV_HEADS[i.key]}`).join("、")}`;
});

await run("二级目录：设置项回落「常用功能」6 项（原型实测 heading=常用功能）", () => {
  const settingsPlan = nav.planPrototypeSubnav("settings", []);
  const deskPlan = nav.planPrototypeSubnav("desk", []);
  assert.deepEqual(
    settingsPlan.map((e) => e.label),
    deskPlan.map((e) => e.label),
    "设置点击后应与 desk 同样展示常用功能",
  );
  assert.equal(settingsPlan.length, 6, "常用功能应为 6 项");
  assert.equal(nav.subnavHead("settings"), nav.PROTOTYPE_COMMON_LABEL);
  return `回落 ${settingsPlan.length} 项，标题「${nav.subnavHead("settings")}」`;
});

await run("二级目录：未知 key / 空值 fail-closed 回落常用功能（不渲染 undefined 标题）", () => {
  for (const bad of [null, undefined, "", "no-such-module"]) {
    assert.equal(nav.subnavHead(bad), nav.PROTOTYPE_COMMON_LABEL, `${bad} 未回落`);
  }
  const plan = nav.planPrototypeSubnav("no-such-module", []);
  assert.equal(plan.length, 6, "未知模块应回落常用功能而非空列表");
  return "4 种异常入参全部回落常用功能";
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. 布局度量：1440 视口三列宽度
// ═══════════════════════════════════════════════════════════════════════════

await run("布局度量：rail/side/折叠/main 逐项 = 原型实测（60/230/56/1150）", () => {
  const m = nav.PROTOTYPE_METRICS;
  const f = FIXTURE.metrics;
  assert.equal(m.railWidth, f.railWidth, "rail 宽度");
  assert.equal(m.sideWidth, f.sideWidth, "side 宽度");
  assert.equal(m.sideCollapsedWidth, f.sideCollapsedWidth, "折叠宽度");
  assert.equal(m.mainWidth, f.mainWidth, "主面宽度");
  return `rail ${m.railWidth} / side ${m.sideWidth} / 折叠 ${m.sideCollapsedWidth} / main ${m.mainWidth}`;
});

await run("布局度量：折叠态保留 56px 可见条（不是收成 0 把侧栏弄消失）", () => {
  assert.ok(nav.PROTOTYPE_METRICS.sideCollapsedWidth > 0, "折叠态宽度必须 > 0");
  const m = codeOnly(shell);
  assert.ok(/56px/.test(m), "Shell 布局未出现 56px 折叠宽");
  assert.ok(/230px/.test(m), "Shell 布局未出现 230px 展开宽");
  assert.ok(/60px/.test(m), "Shell 布局未出现 60px rail 宽");
  return "60 / 230 / 56 三者均在 Shell 布局中落值";
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. 员工 / 会话双入口与部门分组
// ═══════════════════════════════════════════════════════════════════════════

await run("员工目录：9 组 15 人 = 原型部门分组实测", () => {
  const actual = nav.PROTOTYPE_STAFF_GROUPS;
  assert.equal(actual.length, FIXTURE.staffGroups.length, "分组数不符");
  for (let i = 0; i < actual.length; i += 1) {
    assert.equal(actual[i].name, FIXTURE.staffGroups[i].name, `第 ${i + 1} 组名不符`);
    assert.equal(actual[i].count, FIXTURE.staffGroups[i].count, `第 ${i + 1} 组计数不符`);
  }
  const total = actual.reduce((s, g) => s + g.count, 0);
  return `9 组 / 合计 ${total} 人`;
});

await run("双入口：员工 / 对话 两项 = 原型 segmented", () => {
  assert.deepEqual([...nav.PROTOTYPE_SIDE_TABS], FIXTURE.sideTabs, "双入口名称不符");
  const m = codeOnly(subnav);
  assert.ok(m.includes("员工"), "Subnav 未承载员工入口");
  assert.ok(m.includes("对话"), "Subnav 未承载对话入口");
  return nav.PROTOTYPE_SIDE_TABS.join(" / ");
});

await run("模式胶囊：工作台 ⇄ 收银台 两项 = 原型顶栏", () => {
  assert.deepEqual([...nav.PROTOTYPE_MODES], FIXTURE.modes);
  return nav.PROTOTYPE_MODES.join(" ⇄ ");
});

await run("红线：原型演示员工姓名不得被搬进实现源码（假数据冒充真实名单）", () => {
  const banned = FIXTURE.prototypeMockStaffNames;
  assert.ok(banned.length > 0, "黑名单为空，无法起到护栏作用");
  const hits = [];
  for (const file of [
    "shared/workbench/prototype-nav.ts",
    "shared/workbench/agent-directory.ts",
    "layouts/WorkbenchShell.vue",
    "layouts/WorkbenchSubnav.vue",
  ]) {
    const text = readFileSync(path.join(SRC, file), "utf8");
    for (const name of banned) {
      if (text.includes(name)) hits.push(`${file} 出现「${name}」`);
    }
  }
  assert.deepEqual(hits, [], `原型 mock 员工被搬进实现：\n  - ${hits.join("\n  - ")}`);
  return `${banned.length} 个原型姓名在 4 个文件零命中`;
});

await run("真实员工端点失败 ⇒ error + 空组，绝不返回伪造条目", async () => {
  const dir = await import(
    pathToFileURL(path.join(SRC, "shared", "workbench", "agent-directory.ts")).href
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("ENDPOINT_TEST_OFFLINE");
  };
  try {
    const staff = await dir.loadAgentDirectory();
    assert.equal(staff.state, "error", "真实端点请求失败必须 error");
    assert.deepEqual(staff.groups, [], "失败不得附带任何条目");
    assert.ok(staff.message.length > 0, "必须给出失败原因文案");
  } finally {
    globalThis.fetch = originalFetch;
  }
  // 会话归档：改用 AI 底座真实 GET /api/admin/session-archive，按 sessionId 去重并取首条用户消息作标题。
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      total: 2,
      items: [
        {
          sessionId: "sess_archive_1",
          messagesJson: [
            { role: "user", content: "查询五粮液库存" },
            { role: "assistant", content: "总店 76 箱" },
          ],
          messageCount: 2,
          endedAt: "2026-11-13T08:00:00.000Z",
        },
        {
          sessionId: "sess_archive_1",
          messagesJson: [{ role: "user", content: "旧重复" }],
          messageCount: 1,
          endedAt: "2026-11-12T08:00:00.000Z",
        },
      ],
    }),
  });
  const conv = await dir.loadHistoryConversations();
  assert.equal(conv.state, "ready", `历史会话应 ready：${conv.message}`);
  assert.equal(conv.enabledCount, 1, "同一 sessionId 必须去重");
  assert.equal(conv.groups[0]?.staffs[0]?.name, "查询五粮液库存");
  assert.equal(conv.groups[0]?.staffs[0]?.conversationId, "sess_archive_1");
  return "员工端点 error / groups=0；历史会话 archive ready / 去重 1";
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. 二级目录接线计划：原型结构不得被「现有接口没有」吃掉
// ═══════════════════════════════════════════════════════════════════════════

/** 造 manifest 项：只给 planPrototypeSubnav 需要的形状 */
const item = (title) => ({ title, groupCode: "wb.sales", path: "/x", routeName: "x", component: () => null });

await run("planPrototypeSubnav：manifest 全空 ⇒ 条目数不减、全 pending（不静默丢弃结构）", () => {
  const labels = nav.PROTOTYPE_SUBCATALOG.inventory;
  const plan = nav.planPrototypeSubnav("inventory", []);
  assert.equal(plan.length, labels.length, "原型条目数必须守恒");
  assert.ok(plan.every((e) => e.status === "pending"), "应全部 pending");
  assert.deepEqual(plan.map((e) => e.label), [...labels], "label 与顺序必须保持原型口径");
  return `${plan.length}/${labels.length} 全 pending`;
});

await run("planPrototypeSubnav：部分命中 ⇒ wired/pending 混排且 label 仍为原型文案", () => {
  const plan = nav.planPrototypeSubnav("inventory", [item("库存盘点"), item("库存报表")]);
  const wired = plan.filter((e) => e.status === "wired").map((e) => e.label);
  const pending = plan.filter((e) => e.status === "pending").map((e) => e.label);
  assert.deepEqual(wired, ["库存盘点", "库存报表"], "wired 应为命中的两项");
  assert.equal(pending.length, plan.length - 2, "其余仍应保留为 pending");
  // 顺序必须仍是原型顺序：库存列表(0) 库存盘点(1) ... 库存报表(11)
  assert.equal(plan[1].status, "wired");
  assert.equal(plan.at(-1).status, "wired");
  return `${wired.length} wired / ${pending.length} pending，顺序不变`;
});

await run("planPrototypeSubnav：同一 manifest 项不被两个二级目录重复消费", () => {
  const only = [item("库存盘点")];
  const plan = nav.planPrototypeSubnav("inventory", only);
  const wired = plan.filter((e) => e.status === "wired");
  assert.equal(wired.length, 1, "一个 manifest 项只能被消费一次");
  assert.equal(wired[0].item.title, "库存盘点");
  return "1 项命中、消费一次";
});

await run("wiringRatio：真实计数（pending 不计入 wired，且不大于总数）", () => {
  const r = nav.wiringRatio("inventory", [item("库存盘点")]);
  assert.equal(r.total, nav.PROTOTYPE_SUBCATALOG.inventory.length);
  assert.equal(r.wired, 1);
  assert.ok(r.wired <= r.total, "wired 不得大于 total");
  const zero = nav.wiringRatio("finance", []);
  assert.equal(zero.wired, 0);
  return `inventory ${r.wired}/${r.total}；finance ${zero.wired}/${zero.total}`;
});

await run("planPrototypeSubnav：manifest 含原型未声明的多余项 ⇒ 不进绑定的不会产生幽灵 UI", () => {
  const plan = nav.planPrototypeSubnav("report", [item("报表中心"), item("客户分析"), item("多出来的页面")]);
  assert.equal(plan.length, nav.PROTOTYPE_SUBCATALOG.report.length, "输出长度只由原型决定");
  assert.ok(plan.every((e) => e.status === "wired"), "report 两项均已接线");
  assert.ok(!plan.some((e) => e.label === "多出来的页面"), "多余项不得污染二级目录");
  return `多余项被隔离，输出恒为 ${plan.length} 项`;
});

await run("planPrototypeSubnav 无副作用：不就地改写传入的 manifestItems", () => {
  const input = [item("库存盘点"), item("库存报表")];
  const snapshot = JSON.stringify(input.map((i) => i.title));
  nav.planPrototypeSubnav("inventory", input);
  assert.equal(JSON.stringify(input.map((i) => i.title)), snapshot, "入参数组被就地修改");
  assert.equal(input.length, 2, "入参长度被改变");
  return "入参数组与长度均未变";
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. 一级 rail 选中态：二次点击恢复常用功能（原型 §动态交互 1/2）
// ═══════════════════════════════════════════════════════════════════════════

await run("toggleRailSelection：首次点击 ⇒ 选中该模块", () => {
  assert.equal(nav.toggleRailSelection(null, "sales"), "sales");
  assert.equal(nav.toggleRailSelection("desk", "order"), "order");
  return "null→sales；desk→order";
});

await run("toggleRailSelection：再次点击同项 ⇒ 取消选中（第二栏恢复常用功能）", () => {
  assert.strictEqual(nav.toggleRailSelection("sales", "sales"), null, "必须返回 null");
  return "sales→sales ⇒ null（恢复常用功能）";
});

await run("原型复证：13 项二次点击后 active 清空且二级目录复位 6 项", () => {
  const expected = FIXTURE.secondClickResetsToCommon;
  assert.equal(expected.length, FIXTURE.railNames.length, "夹具复位清单应覆盖全部 rail 项");
  for (const name of expected) {
    const toggle = FIXTURE.toggleByName[name];
    assert.equal(toggle.restoredCount, 6, `${name} 复位后应为常用功能 6 项`);
  }
  // 业务模块（不含工作台）二次点击后 rail 上不再有 active
  const business = expected.filter((n) => n !== "工作台");
  for (const name of business) {
    assert.deepEqual(FIXTURE.toggleByName[name].activeAfterSecond, [], `${name} 二次点击后仍 active`);
  }
  return `${business.length} 个模块二次点击后 active 清空、复位 6 项`;
});

await run("findRailItem：未知/空 key fail-closed 返回 null", () => {
  assert.strictEqual(nav.findRailItem(null), null);
  assert.strictEqual(nav.findRailItem(undefined), null);
  assert.strictEqual(nav.findRailItem("no-such"), null);
  return "3 种异常入参均 null";
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. 模板接线：Shell / Subnav 必须消费真相源，不得回退写死
// ═══════════════════════════════════════════════════════════════════════════

await run("约束：Shell rail 必须真相源排序 + 保留 data-rail-key DOM 契约", () => {
  const m = codeOnly(shell);
  assert.ok(m.includes("decorateRailGroups"), "Shell 未按原型顺序装饰分组");
  assert.ok(m.includes(':data-rail-key="group.groupCode"'), "rail DOM 契约键丢失");
  assert.ok(m.includes('data-rail-key="desk"'), "缺少 desk 项标记");
  assert.ok(m.includes('data-rail-key="set"'), "缺少 set 项标记");
  assert.ok(m.includes("wb-rail-gap"), "缺少把设置压到底部的留白");
  return "真相源排序 + desk/模块/set 三类 DOM 键齐备";
});

await run("约束：Shell 不得把 rail 顺序写回 manifest 原顺序（顺序必须由真相源决定）", () => {
  const m = codeOnly(shell);
  assert.ok(
    !/v-for="group in visibleGroups"/.test(m),
    "rail 仍在按 manifest 原顺序渲染（visibleGroups 顺序 ≠ 原型顺序）",
  );
  const arr = [
    ...m.matchAll(/const railModules[\s\S]{0,200}?decorateRailGroups\(([^)]*)\)/g),
  ];
  assert.ok(arr.length > 0, "未找到 railModules 的真相源派生链");
  return "rail 序列来自 decorateRailGroups";
});

await run("约束：Subnav 常用功能按真实使用频率排序并受 S2 生产集合约束", () => {
  const m = codeOnly(subnav);
  assert.ok(m.includes("rankFrequentMenuItems"), "Subnav 未按真实使用频率生成常用功能");
  assert.ok(m.includes("productionSnapshot.routeNames"), "Subnav 常用功能未受 S2 生产集合约束");
  assert.ok(!m.includes("planPrototypeSubnav"), "Subnav 不得再消费原型 pending 计划");
  assert.ok(!m.includes("待接入"), "Subnav 生产 DOM 源不得出现黑名单占位词");
  return "使用频率排序 + S2 生产集合 + 黑名单零命中";
});

// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 8. 运行态取证实测发现的缺陷回归（2026-10-31 Playwright 双通道取证）
//    三处缺陷均由浏览器真点暴露，非静态推断；此处补断言防止回归。
// ═══════════════════════════════════════════════════════════════════════════

await run("运行态回归①：desk 已占用的 wb.dashboard 不得在 rail 尾部重复渲染", () => {
  const rows = nav.decorateRailGroups([
    { groupCode: "wb.dashboard", title: "工作台" },
    { groupCode: "wb.sales", title: "销售管理" },
  ]);
  const codes = rows.map((r) => r.groupCode);
  assert.ok(
    !codes.includes("wb.dashboard"),
    `wb.dashboard 已由固定 desk 项承载，不得再渲染一个 rail 项（实际 ${codes.join("/")}）`,
  );
  assert.deepEqual(codes, ["wb.sales"]);
  return "rail 仅 wb.sales，「工作台」由 desk 固定项承载，不重复";
});

await run("运行态回归②：原型未声明分组标签回落 title，绝不把 groupCode 暴露到 UI", () => {
  const rows = nav.decorateRailGroups([
    { groupCode: "wb.sales", title: "销售管理" },
    { groupCode: "wb.orphan", title: "孤儿分组" },
  ]);
  const orphan = rows.find((r) => r.protoKey === "+wb.orphan");
  assert.ok(orphan, "原型未声明分组被静默丢弃（派单卡 §六禁止）");
  assert.equal(orphan.protoLabel, "孤儿分组");
  assert.equal(orphan.protoTitle, "孤儿分组");
  assert.ok(
    !rows.some((r) => r.protoLabel.startsWith("wb.") || /^[a-z-]+\.[a-z-]+$/.test(r.protoLabel)),
    `rail 文案出现分组码（实测曾在 rail 上显示 "wb.dashboard"）`,
  );
  return "回落 title，UI 文案无分组码";
});

await run("运行态回归③：Shell 必须把折叠态传给 Subnav（否则折叠缩略条永不渲染）", () => {
  const m = codeOnly(shell);
  assert.ok(
    /:collapsed="sideCollapsed"/.test(m),
    "Shell 未绑定 :collapsed ⇒ Subnav 折叠态恒 false，缩略条与按钮 aria 不翻面，56px 列只剩被裁掉的内容",
  );
  return "折叠态绑定闭环（Shell ↔ Subnav）";
});

await run("运行态回归④：Subnav 必须 border-box，否则实测 57/231 而非原型 56/230", () => {
  const css = subnav.slice(subnav.indexOf("<style"));
  assert.ok(
    /\.wb-subnav\s*\{[^}]*box-sizing:\s*border-box/.test(css),
    ".wb-subnav 缺 box-sizing:border-box ⇒ 1px border-right 外溢，实测侧栏 231/57（原型 230/56）",
  );
  return "列宽含边框，实测回到 230/56";
});

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n小结：${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);
