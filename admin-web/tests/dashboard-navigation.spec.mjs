/**
 * WORKBENCH-08 · 工作台入口权限与动态链接语义契约测试
 *
 * 覆盖派单卡 §五 硬验收：
 *   ① 快捷入口可见性只由真实路由 meta.roles 派生（WB-AUDIT-06）
 *   ② 四角色真值表 SUPER_ADMIN / STORE_MANAGER / STORE_OPERATOR / READONLY
 *   ③ 未知 route/path fail-closed
 *   ④ STORE_MANAGER 动态信息流零"会被守卫拦回"的链接（WB-AUDIT-09）
 *   ⑤ 库存预警 → /inventory-alerts、客户会员 → /customers（WB-AUDIT-10）
 *   ⑥ 渠道订单无论返回多少，最终合并列表 ≤ 10 且总数守恒（WB-AUDIT-07）
 *
 * 真相源：**直读 `admin-web/src/router/index.ts` 源码**解析出真实路由表（含 meta.roles），
 * 不使用任何 mock 角色表；运行态另有一条 `collectRouteEntries(router)` 读 router 实例，
 * 两条路径共用同一套判定逻辑，本文件交叉验证二者一致。
 *
 * 契约依据（直读源码，非文档）：
 *   - `admin-web/src/router/index.ts`（163 条真实路由）
 *   - 入口目标权限：order-center / finance/receipts 仅 SUPER_ADMIN；
 *     inventory-alerts / customers 为 SUPER_ADMIN + STORE_MANAGER
 *   - `backend/src/services/admin/dashboard.service.ts:360-406` getOverview **不返回 recentBills**，
 *     故前端必然走"线下 10 条 + 渠道订单"兜底合并路径 —— 未截断时最多 110 条进 DOM。
 *
 * 运行：node admin-web/tests/dashboard-navigation.spec.mjs（已串入 npm test）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");

// ── 以 .ts 直载（Node 原生 type stripping）；Windows 绝对路径必须转 file:// URL ──
const nav = await import(pathToFileURL(path.join(SRC, "utils", "dashboard-navigation.ts")).href);

/** 真实路由表（契约态：静态解析 router/index.ts 源码） */
const ROUTER_SRC = readFileSync(path.join(SRC, "router", "index.ts"), "utf8");
const ROUTES = nav.parseRouteTable(ROUTER_SRC);
/** 运行态等价路由表（由 parseRouteTable 的产出喂给 collectRouteEntries 的 router 形状） */
const COLLECTED = nav.collectRouteEntries({
  getRoutes: () => ROUTES.map((r) => ({ path: r.path, name: r.name, meta: { roles: [...r.roles], title: r.title } })),
});

const ROLES = {
  SUPER_ADMIN: ["SUPER_ADMIN"],
  STORE_MANAGER: ["STORE_MANAGER"],
  STORE_OPERATOR: ["STORE_OPERATOR"],
  READONLY: ["READONLY"],
};

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
/** 取模板中某个 class 块（到下一个同级 </div> 为止） */
function blockOf(code, cls) {
  const at = code.indexOf(`class="${cls}"`);
  if (at < 0) return "";
  const end = code.indexOf("</div>", at);
  return code.slice(at, end < 0 ? code.length : end);
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
// 一、真相源：真实路由表
// ═══════════════════════════════════════════════════════════════════════════

await run("真相源：路由表由真实 router/index.ts 解析（≥150 条、6 个入口目标全在表内）", () => {
  assert.ok(ROUTES.length >= 150, `真实路由应 ≥150 条，实际 ${ROUTES.length}`);
  for (const def of nav.QUICK_ENTRY_DEFS) {
    const hit = ROUTES.find((r) => r.path === def.target);
    assert.ok(hit, `入口目标 ${def.target} 必须在真实路由表内`);
    assert.ok(hit.roles.length > 0, `${def.target} 必须声明 meta.roles（否则入口应 fail-closed）`);
  }
  return `${ROUTES.length} 条真实路由；6 个入口目标全部在表内`;
});

await run("真相源：嵌套子路由归一化为完整路径（sales/create ⇒ /sales/create）", () => {
  const src = codeOnly(ROUTER_SRC);
  assert.ok(/path:\s*["']sales\/create["']/.test(src), "路由表里是嵌套写法 path:'sales/create'");
  const hit = ROUTES.find((r) => r.path === "/sales/create");
  assert.ok(hit, "必须解析为完整路径 /sales/create（只认嵌套字面量会误判为路由不存在）");
  assert.deepEqual(hit.roles, ["SUPER_ADMIN", "STORE_MANAGER"], "roles 必须与 meta.roles 原文一致");
  assert.equal(hit.title, "销售开单", "title 必须取自 meta.title");
  return "/sales/create（roles=[SUPER_ADMIN,STORE_MANAGER] title=销售开单）";
});

await run("真相源：collectRouteEntries 与 parseRouteTable 产出同一套路由表", () => {
  assert.equal(COLLECTED.length, ROUTES.length, `两条路径条数应一致：${COLLECTED.length} vs ${ROUTES.length}`);
  const key = (r) => `${r.path}|${r.name}|${r.title}|${r.roles.join(",")}`;
  const a = ROUTES.map(key).sort();
  const b = COLLECTED.map(key).sort();
  assert.deepEqual(a, b, "运行态与契约态路由表必须逐项一致");
  return `${ROUTES.length} 条逐项一致（path/name/title/roles）`;
});

// ═══════════════════════════════════════════════════════════════════════════
// 二、快捷入口四角色真值表（WB-AUDIT-06）
// ═══════════════════════════════════════════════════════════════════════════

const visibleFor = (role) => nav.visibleQuickEntries(ROUTES, role);

await run("快捷入口：SUPER_ADMIN 可见 6/6", () => {
  const v = visibleFor(ROLES.SUPER_ADMIN);
  assert.equal(v.length, nav.QUICK_ENTRY_DEFS.length, `SUPER_ADMIN 应可见全部 6 项，实际 ${v.length}`);
  return "6/6：" + v.map((e) => e.label).join("/");
});

await run("快捷入口：STORE_MANAGER 可见 6/6（六个目标均对店长开放）", () => {
  const v = visibleFor(ROLES.STORE_MANAGER);
  assert.equal(v.length, 6, `STORE_MANAGER 应可见 6 项，实际 ${v.length}`);
  return "6/6：" + v.map((e) => e.label).join("/");
});

await run("快捷入口：STORE_OPERATOR 可见 0/6", () => {
  const v = visibleFor(ROLES.STORE_OPERATOR);
  assert.equal(v.length, 0, `STORE_OPERATOR 应可见 0 项，实际 ${v.length}：${v.map((e) => e.label)}`);
  return "0/6（六个目标均不含 STORE_OPERATOR）";
});

await run("快捷入口：READONLY 可见 0/6", () => {
  const v = visibleFor(ROLES.READONLY);
  assert.equal(v.length, 0, `READONLY 应可见 0 项，实际 ${v.length}：${v.map((e) => e.label)}`);
  return "0/6（六个目标均不含 READONLY）";
});

await run("快捷入口：四角色真值表 6/6 · 6/6 · 0/6 · 0/6（一次性断言四行）", () => {
  const matrix = ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR", "READONLY"].map((r) => ({
    role: r,
    count: visibleFor([r]).length,
  }));
  assert.deepEqual(
    matrix.map((m) => m.count),
    [6, 6, 0, 0],
    `四角色真值表应恒为 6/6/0/0，实际 ${matrix.map((m) => `${m.role}=${m.count}`).join(" · ")}`,
  );
  return matrix.map((m) => `${m.role}=${m.count}`).join(" · ");
});

await run("快捷入口：空角色 ⇒ 0（fail-closed，不出现「跳过校验直接放行」）", () => {
  assert.equal(visibleFor([]).length, 0, "空角色不得看到任何入口");
  assert.equal(visibleFor(["UNKNOWN_ROLE"]).length, 0, "未登记角色不得看到任何入口");
  return "空角色 0、未知角色 0";
});

// ═══════════════════════════════════════════════════════════════════════════
// 三、fail-closed（硬验收 §3）
// ═══════════════════════════════════════════════════════════════════════════

await run("fail-closed：未知 route 目标 ⇒ 不可见（不显示可点击入口）", () => {
  const defs = [{ key: "ghost", label: "幽灵入口", target: "/no-such-page" }];
  assert.equal(nav.visibleQuickEntries(ROUTES, ROLES.SUPER_ADMIN, defs).length, 0, "未知路径必须不可见");
  const t = nav.decorateNavTarget(ROUTES, ROLES.SUPER_ADMIN, "/no-such-page");
  assert.deepEqual(t, { route: null, canOpen: false }, "未知路径必须不可点击");
  return "未知路径：入口 0 项、链接 null";
});

await run("fail-closed：目标路由被删除 ⇒ 入口自动消失（无需改代码）", () => {
  // 模拟路由表里摘掉 /sales/reports：可见集应自动少一项
  const pruned = ROUTES.filter((r) => r.path !== "/sales/reports");
  const before = visibleFor(ROLES.STORE_MANAGER).length;
  const after = nav.visibleQuickEntries(pruned, ROLES.STORE_MANAGER).length;
  assert.equal(after, before - 1, `删路由后应自动少 1 项（${before}→${after}）`);
  assert.ok(
    !nav.visibleQuickEntries(pruned, ROLES.STORE_MANAGER).some((e) => e.target === "/sales/reports"),
    "被删目标不得再出现在可见集里",
  );
  return `删除 /sales/reports 后 ${before}→${after}（自动派生，非硬编码）`;
});

await run("fail-closed：目标路由未声明 meta.roles ⇒ 不可见", () => {
  const login = ROUTES.find((r) => r.path === "/login");
  assert.ok(login, "/login 应在真实路由表内");
  assert.deepEqual(login.roles, [], "/login 确实未声明 roles（用真实路由当样本）");
  const defs = [{ key: "login", label: "登录", target: "/login" }];
  assert.equal(nav.visibleQuickEntries(ROUTES, ROLES.SUPER_ADMIN, defs).length, 0, "无 roles 声明 ⇒ fail-closed");
  return "/login（roles=[]）⇒ 入口 0 项";
});

// ═══════════════════════════════════════════════════════════════════════════
// 四、动态链接权限（WB-AUDIT-09）
// ═══════════════════════════════════════════════════════════════════════════

await run("动态链接：STORE_MANAGER 收款动态不可点击（/finance/receipts 仅 SUPER_ADMIN）", () => {
  const t = nav.decorateNavTarget(ROUTES, ROLES.STORE_MANAGER, "/finance/receipts");
  assert.equal(t.canOpen, false, "STORE_MANAGER 不得拿到收款单链接");
  assert.equal(t.route, null, "无权必须置 null，不能留可点击链接");
  return "/finance/receipts ⇒ route=null";
});

await run("动态链接：STORE_MANAGER 渠道订单不可点击（/order-center 仅 SUPER_ADMIN）", () => {
  const t = nav.decorateNavTarget(ROUTES, ROLES.STORE_MANAGER, "/order-center");
  assert.equal(t.canOpen, false, "STORE_MANAGER 不得拿到订单中心链接");
  assert.equal(t.route, null, "无权必须置 null");
  return "/order-center ⇒ route=null";
});

await run("动态链接：STORE_MANAGER 全部受限目标零可点击链接（收款动态 + 渠道订单）", () => {
  assert.equal(nav.RESTRICTED_FEED_TARGETS.length, 2, "受限目标应有 2 个（收款单、订单中心）");
  for (const target of nav.RESTRICTED_FEED_TARGETS) {
    const t = nav.decorateNavTarget(ROUTES, ROLES.STORE_MANAGER, target);
    assert.equal(t.route, null, `${target} 对 STORE_MANAGER 必须不可点击`);
  }
  return [...nav.RESTRICTED_FEED_TARGETS].join(" / ") + " ⇒ 全部 route=null";
});

await run("动态链接：SUPER_ADMIN 两个受限目标保留可点击（不得过度收紧）", () => {
  for (const target of nav.RESTRICTED_FEED_TARGETS) {
    const t = nav.decorateNavTarget(ROUTES, ROLES.SUPER_ADMIN, target);
    assert.equal(t.route, target, `${target} 对 SUPER_ADMIN 应保留可点击`);
  }
  return "SUPER_ADMIN 两个受限目标均可点击（收紧有边界）";
});

await run("动态链接：无权项 route 为 null（不存在「可点但会被守卫拦回」的链接）", () => {
  for (const target of nav.RESTRICTED_FEED_TARGETS) {
    const t = nav.decorateNavTarget(ROUTES, ROLES.STORE_MANAGER, target);
    // 关键判据：要么 null（不可点击），要么目标必须对当前角色开放；没有第三种状态
    if (t.route !== null) {
      const entry = nav.matchRouteEntry(ROUTES, t.route);
      assert.ok(nav.isRouteOpenTo(entry, ROLES.STORE_MANAGER), "非 null 的链接必须真的有权打开");
    }
  }
  // 反向：/orders（店长有权）必须保留
  assert.equal(nav.decorateNavTarget(ROUTES, ROLES.STORE_MANAGER, "/orders").route, "/orders", "店长应有 /orders 链接");
  return "收款/渠道 ⇒ null；/orders ⇒ 保留（无中间态）";
});

// ═══════════════════════════════════════════════════════════════════════════
// 五、入口语义（WB-AUDIT-10）
// ═══════════════════════════════════════════════════════════════════════════

await run("语义：库存预警入口目标 = /inventory-alerts 且目标页标题一致", () => {
  const def = nav.QUICK_ENTRY_DEFS.find((d) => d.key === "inventory-alerts");
  assert.ok(def, "必须存在库存预警入口定义");
  assert.equal(def.target, "/inventory-alerts", "库存预警必须跳预警页，不得跳库存列表 /inventory");
  const entry = nav.matchRouteEntry(ROUTES, def.target);
  assert.ok(entry, "/inventory-alerts 必须在真实路由表内");
  assert.equal(entry.title, "库存预警", "目标页标题应为「库存预警」");
  assert.equal(entry.title, def.label, "入口名称必须与目标页标题一致");
  return "库存预警 ⇒ /inventory-alerts（title=库存预警，与入口名一致）";
});

await run("语义：客户会员入口目标 = /customers（与真实路由逐项对齐）", () => {
  const def = nav.QUICK_ENTRY_DEFS.find((d) => d.key === "customers");
  assert.ok(def, "必须存在客户会员入口定义");
  assert.equal(def.target, "/customers", "客户会员必须跳 /customers（WB-AUDIT-04 已订正，不是 /customer/members）");
  const entry = nav.matchRouteEntry(ROUTES, def.target);
  assert.ok(entry, "/customers 必须在真实路由表内");
  assert.equal(entry.title, "客户管理", "目标页标题应为「客户管理」");
  assert.ok(entry.roles.includes("STORE_MANAGER"), "/customers 应对店长开放");
  return "客户会员 ⇒ /customers（title=客户管理）";
});

await run("语义：全部可见入口的 label 与目标页标题共享语义词（不做名称错配）", () => {
  const visible = visibleFor(ROLES.STORE_MANAGER);
  for (const e of visible) {
    const words = e.label.match(/[一-龥]{2}/g) || [];
    const hit = words.some((w) => e.pageTitle.includes(w));
    assert.ok(hit, `入口「${e.label}」与目标页「${e.pageTitle}」无共享语义词（名称与目标不符）`);
  }
  return `${visible.length} 个可见入口名称 ↔ 目标页标题全部语义对齐`;
});

// ═══════════════════════════════════════════════════════════════════════════
// 六、最终 10 条截断（WB-AUDIT-07）
// ═══════════════════════════════════════════════════════════════════════════

const mkOrders = (n, prefix, base) =>
  Array.from({ length: n }, (_, i) => ({
    billNo: `${prefix}${i}`,
    createdAt: `2026-10-28 ${String(10 + Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00`,
    createdAtRaw: base + i,
  }));
const epochOf = (b) => new Date(String(b.createdAt).replace(" ", "T")).getTime();

await run("最终截断：渠道 100 + 线下 10 ⇒ 合并后只出 10 条", () => {
  const r = nav.mergeRecentOrders({
    offline: mkOrders(10, "OFF", 0),
    channel: mkOrders(100, "CH", 1000),
    getTime: epochOf,
  });
  assert.equal(r.total, 110, "输入合计 110 条");
  assert.equal(r.items.length, 10, `最终必须 ≤10 条，实际 ${r.items.length}`);
  assert.equal(r.truncated, true, "应标记为已截断");
  assert.equal(r.dropped, 100, "丢弃应如实记账 100 条");
  return "110 条进 ⇒ 10 条出（dropped=100）";
});

await run("最终截断：不足 10 条时不补位（2 线下 + 3 渠道 ⇒ 5 条）", () => {
  const r = nav.mergeRecentOrders({
    offline: mkOrders(2, "OFF", 0),
    channel: mkOrders(3, "CH", 100),
    getTime: epochOf,
  });
  assert.equal(r.items.length, 5, "不足上限时不得补位，应原样输出 5 条");
  assert.equal(r.dropped, 0, "未截断时丢弃为 0");
  return "5 条（dropped=0，不伪造、不补位）";
});

await run("最终截断：总数守恒 in = out + dropped（线下与渠道分开记账）", () => {
  for (const [o, c] of [
    [10, 100],
    [10, 0],
    [0, 100],
    [3, 4],
    [0, 0],
  ]) {
    const r = nav.mergeRecentOrders({
      offline: mkOrders(o, "OFF", 0),
      channel: mkOrders(c, "CH", 1000),
      getTime: epochOf,
    });
    assert.equal(r.offlineIn + r.channelIn, o + c, `入账应等于输入 ${o}+${c}`);
    assert.equal(
      r.offlineOut + r.channelOut + r.dropped,
      o + c,
      `守恒式不成立：${r.offlineOut}+${r.channelOut}+${r.dropped} ≠ ${o + c}`,
    );
    assert.equal(r.items.length, r.offlineOut + r.channelOut, "出条目数 = 线下出 + 渠道出");
    assert.ok(r.items.length <= nav.RECENT_ORDER_LIMIT, "出条目数必须 ≤ 上限");
  }
  return "5 组配比全部守恒（in = out + dropped）";
});

await run("最终截断：上限常量 = 10，且按创建时间倒序、结果稳定", () => {
  assert.equal(nav.RECENT_ORDER_LIMIT, 10, "最终上限必须是 10");
  const r = nav.mergeRecentOrders({
    offline: mkOrders(4, "OFF", 0),
    channel: mkOrders(4, "CH", 100),
    getTime: epochOf,
  });
  const times = r.items.map((b) => epochOf(b));
  const sorted = [...times].sort((a, b) => b - a);
  assert.deepEqual(times, sorted, "输出必须按时间倒序");
  const again = nav.mergeRecentOrders({
    offline: mkOrders(4, "OFF", 0),
    channel: mkOrders(4, "CH", 100),
    getTime: epochOf,
  });
  assert.deepEqual(again.items.map((b) => b.billNo), r.items.map((b) => b.billNo), "同等输入必须得到同等输出（稳定排序）");
  return `上限 10；倒序 + 稳定（${r.items.map((b) => b.billNo).join(",")}）`;
});

// ═══════════════════════════════════════════════════════════════════════════
// 七、静态守卫（防止改回硬编码 / 绕过共享适配器）
// ═══════════════════════════════════════════════════════════════════════════

const DASH_REL = "views/dashboard/Dashboard.vue";
const dashCode = codeOnly(read(DASH_REL));

await run("静态守卫：Dashboard.vue 内零角色字面量（SUPER_ADMIN/STORE_MANAGER/STORE_OPERATOR/READONLY）", () => {
  const hits = [];
  for (const role of ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR", "READONLY"]) {
    const m = dashCode.match(new RegExp(`["']${role}["']`, "g"));
    if (m) hits.push(`${role}×${m.length}`);
  }
  assert.deepEqual(hits, [], `页面不得硬编码角色：${hits.join(" ")}`);
  return "4 个角色字面量 0 处";
});

await run("静态守卫：快捷入口区不再写死六项（v-for 派生，零写死目标）", () => {
  const grid = blockOf(dashCode, "quick-grid");
  assert.ok(grid.length > 0, "必须存在 quick-grid 区块");
  assert.ok(/v-for="\w+ in quickEntries"/.test(grid), "快捷入口必须由 quickEntries 派生渲染");
  for (const p of ["/sales/create", "/sale-bills", "/messages", "/inventory", "/sales/reports", "/customers"]) {
    assert.ok(!grid.includes(`'${p}'`), `快捷入口区块不得写死目标 ${p}`);
  }
  return "v-for 派生；6 个目标字面量 0 处";
});

await run("静态守卫：Dashboard.vue 必须经共享导航适配器取路由表与入口", () => {
  assert.ok(
    /from\s+["'][^"']*utils\/dashboard-navigation["']/.test(dashCode),
    "必须从 utils/dashboard-navigation 引入共享适配器",
  );
  assert.ok(/collectRouteEntries\(router\)/.test(dashCode), "路由表必须来自 router 实例（真实 meta.roles）");
  assert.ok(/visibleQuickEntries\(/.test(dashCode), "快捷入口必须经 visibleQuickEntries 派生");
  assert.ok(/decorateNavTarget\(/.test(dashCode), "动态链接必须经 decorateNavTarget 判定");
  assert.ok(/mergeRecentOrders\(/.test(dashCode), "最新订单必须经 mergeRecentOrders 合并截断");
  return "4 个共享入口全部在位";
});

await run("静态守卫：导航适配器内零角色字面量（roles 一律来自真实路由表）", () => {
  const util = codeOnly(read("utils/dashboard-navigation.ts"));
  const hits = [];
  for (const role of ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR", "READONLY"]) {
    const m = util.match(new RegExp(`["']${role}["']`, "g"));
    if (m) hits.push(`${role}×${m.length}`);
  }
  assert.deepEqual(hits, [], `适配器不得硬编码角色：${hits.join(" ")}`);
  assert.ok(/roles:\s*\[([^\]]*)\]/.test(util) === false, "适配器内不得出现 roles 字面量数组");
  return "4 个角色字面量 0 处、roles 数组字面量 0 处";
});

await run("静态守卫：页面内 /inventory 库存入口已消失（改用 /inventory-alerts）", () => {
  assert.ok(!/route:\s*["']\/inventory["']/.test(dashCode), "不得再有写死的 /inventory 动态链接");
  assert.ok(!/navTarget\(["']\/inventory["']\)/.test(dashCode), "不得再向 /inventory 发起导航判定");
  assert.ok(/navTarget\(["']\/inventory-alerts["']\)/.test(dashCode), "库存预警应指向 /inventory-alerts");
  return "/inventory 0 处；/inventory-alerts 在位";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
