/**
 * MS-WB-CONTENT-WIRING-B-01 · 生产菜单桥与业务内容接线 B 批 —— 契约断言
 *
 * 三块判据（权威卡 §三）：
 *   §一 树载荷扁平化：后端 buildTree 树（menu-permission.service.ts:134）递归展开后再进桥，
 *       嵌套子码（finance:expenses / goods:stock-warning 等）不再被顶层解析丢弃；
 *   §二 桥扩条：SERVER_MENU_BRIDGE 20 条（旧 10 条矩阵证据 + 新 10 条 menu-bridge-alignment.md 立证）
 *       ⇒ 隔离库真实 57 码目录 → 14 路由 10 组；wb.order / wb.instant-retail 服务端缺码（卡 §五）；
 *   §三 权限差集 + 越权拦截：超管 14 项 vs 店长 5 项双向差集；越权直输路由被真实路由守卫页面级拦截。
 *
 * 数据真实性：57 码目录=隔离库 zxql_wb_verify_isolated t_sys_menu 只读探查快照
 *   （evidence raw/01-menu-dir-probe.txt，2026-11-15）；店长 5 码=业主授权灌备绑定（dashboard/sale/goods/goods:stock-warning/customer）。
 *
 * 运行（admin-web 目录）：node tests/wb-menu-wiring.spec.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

// 拒绝提示桩（守卫只用到 ElMessage.warning；须早于任何 element-plus 模块求值）
const warnLog = [];
globalThis.__elMessageStub = {
  warning: (message) => { warnLog.push(message); return { close: () => undefined }; },
};

const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS = "data:text/javascript,export const ElMessage=globalThis.__elMessageStub;";
// api/request 引 axios + import.meta.env（node 下不可用）——契约测试里用零网络桩替换
const STUB_REQUEST = "data:text/javascript,export const api={get(){throw new Error('contract test: network disabled');}};";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    if (specifier === "element-plus") return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    if (specifier === "./request") return { url: STUB_REQUEST, shortCircuit: true, format: "module" };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier, context);
  },
});

const menuAccess = await import("../src/shared/workbench/menu-access.ts");
const manifest = await import("../src/shared/workbench/route-manifest.ts");
const eff = await import("../src/shared/workbench/effective-capabilities.ts");
const apiMenu = await import("../src/api/workbench-menu.ts");

// —— 浏览器环境（真实 vue-router 需要 window/document；role-guard.spec.mjs 同款）——
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, location: dom.window.location,
  history: dom.window.history, localStorage: dom.window.localStorage,
  navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver,
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const { createPinia, setActivePinia } = await import("pinia");
const { useAuthStore } = await import("../src/stores/auth.ts");
const routerModule = await import("../src/router/index.ts");
const router = routerModule.default;

/** 真实路由表快照（resolveRoles 数据源；须在 jsdom 就绪后取） */
const ROUTE_RECORDS = { value: router.getRoutes() };

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
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

// ── 隔离库真实 57 码目录（evidence raw/01-menu-dir-probe.txt 快照；menuCode:status）────────
const ISOLATED_DIR_57 = Object.entries({
  dashboard: 1, goods: 10, sale: 20, purchase: 30, customer: 40, finance: 50, marketing: 60,
  store: 70, trace: 80, report: 90, system: 100,
  "goods:create": 200, "goods:edit": 201, "goods:delete": 202, "goods:inventory:adjust": 203,
  "sale:create": 210, "sale:void": 211, "sale:edit": 212, "purchase:create": 220, "purchase:approve": 221,
  "customer:create": 230, "customer:edit": 231, "customer:credit:adjust": 232,
  "finance:receipt:create": 240, "finance:payment:create": 241, "marketing:create": 250,
  "store:create": 260, "store:edit": 261, "system:user:create": 270, "system:user:edit": 271,
  "system:role:create": 272, "system:role:edit": 273,
  "customer:address": 274, "customer:level": 275, "customer:points": 276, "customer:stored-card": 277,
  "finance:expenses": 278, "finance:reconciliation": 279, "finance:transfer": 280,
  "goods:loss-gain": 281, "goods:stock-check": 282, "goods:stock-warning": 283, "goods:trace": 284,
  "marketing:activities": 285, "marketing:bargain": 286, "marketing:community": 287, "marketing:seckill": 288,
  "report:dashboard": 289, "report:finance-report": 290, "report:inventory": 291, "report:purchase": 292,
  "store:employees": 293, "store:roles": 294, "system:more": 295, "system:operation-log": 296,
  "system:permission": 297, "system:print": 298,
});
const rows57 = ISOLATED_DIR_57.map(([menuCode, id]) => ({
  menuCode, menuName: String(id), menuType: id < 200 ? "CATALOG" : id < 274 ? "BUTTON" : "MENU",
  path: null, status: "1",
}));
const rows5 = ["dashboard", "sale", "goods", "goods:stock-warning", "customer"].map((menuCode) => ({
  menuCode, menuName: menuCode, menuType: "CATALOG", path: null, status: "1",
}));

/** 真实路由表 resolveRoles（与 WorkbenchShell.vue:536 同一语义；未知路由 → null） */
function makeResolveRoles() {
  const records = ROUTE_RECORDS.value;
  return (routeName) => {
    const record = records.find((entry) => entry.name === routeName);
    if (!record) return null;
    const roles = record.meta?.roles;
    if (!Array.isArray(roles)) return [];
    return roles.filter((role) => typeof role === "string");
  };
}

// ═══ §一 树载荷扁平化 ═══

await run("§一1 树载荷递归扁平化：顶层 + 嵌套子码全部成行（旧顶层解析丢子码的缺陷不再复现）", () => {
  const tree = {
    data: [
      {
        menuCode: "finance", menuName: "财务管理", menuType: "CATALOG", path: "/finance", status: 1,
        children: [
          { menuCode: "finance:expenses", menuName: "费用支出", menuType: "MENU", path: "/finance/expenses", status: 1 },
          { menuCode: "finance:reconciliation", menuName: "收银对账", menuType: "MENU", path: "/finance/reconciliation", status: 1 },
        ],
      },
      { menuCode: "dashboard", menuName: "仪表盘", menuType: "CATALOG", path: "/dashboard", status: 1 },
      {
        menuCode: "goods", menuName: "商品管理", menuType: "CATALOG", path: "/goods", status: 1,
        children: [{ menuCode: "goods:stock-warning", menuName: "库存预警", menuType: "MENU", path: "/goods/stock-warning", status: 1 }],
      },
    ],
  };
  const flat = apiMenu.flattenUserMenusPayload(tree);
  assert.deepEqual(flat.map((row) => row.menuCode), ["finance", "finance:expenses", "finance:reconciliation", "dashboard", "goods", "goods:stock-warning"]);
  assert.equal(flat.find((row) => row.menuCode === "finance:expenses").menuName, "费用支出");
  return "6 行 · 顺序=顶层+子树 · 字段保留";
});

await run("§一2 嵌套行缺 menuCode 一律抛 MenuPayloadError（fail-closed 与顶层同语义）", () => {
  assert.throws(
    () => apiMenu.flattenUserMenusPayload({ data: [{ menuCode: "finance", children: [{ menuName: "缺码行" }] }] }),
    (err) => err instanceof menuAccess.MenuPayloadError && /menuCode/.test(err.message),
  );
  return "MenuPayloadError 点名";
});

await run("§一3 children 非对象行抛 MenuPayloadError（不猜数据）", () => {
  assert.throws(
    () => apiMenu.flattenUserMenusPayload({ data: [{ menuCode: "finance", children: [null] }] }),
    (err) => err instanceof menuAccess.MenuPayloadError && /children/.test(err.message),
  );
  return "MenuPayloadError 点名";
});

await run("§一4 api 接线：fetchUserMenus 必须经 flattenUserMenusPayload 再出参", () => {
  const code = read("api/workbench-menu.ts");
  assert.match(code, /export async function fetchUserMenus[\s\S]*?flattenUserMenusPayload\(data\)/, "fetchUserMenus 未接扁平化");
  assert.match(code, /parseUserMenusPayload/, "扁平化必须复用 shared 行校验");
  return "源码接线断言";
});

await run("§一5 扁平化后 serverMenuCount 反映子码（finance 域样例：顶层-only 旧行为只会得 1）", () => {
  const flat = apiMenu.flattenUserMenusPayload({
    data: [{ menuCode: "finance", menuName: "财务管理", menuType: "CATALOG", path: null, status: 1, children: [{ menuCode: "finance:reconciliation", menuName: "收银对账", menuType: "MENU", path: null, status: 1 }] }],
  });
  const access = menuAccess.resolveMenuAccess({
    state: "ready", rows: flat, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(access.serverMenuCount, 2, "顶层-only 旧口径这里只会数到 1");
  assert.ok(access.visibleRouteNames.has("finance-reconciliation"), "嵌套子码必须能过桥");
  return "serverMenuCount=2 · finance:reconciliation 过桥可见";
});

// ═══ §二 桥扩条（隔离库真实 57 码目录） ═══

await run("§二1 桥扩条真值：20 条=旧 10（矩阵证据）+ 新 10（menu-bridge-alignment.md 立证），每条带证据行号", () => {
  assert.equal(menuAccess.SERVER_MENU_BRIDGE.length, 20);
  const legacy = menuAccess.SERVER_MENU_BRIDGE.filter((entry) => entry.evidence.startsWith("10-route-menu-matrix.md:"));
  const expanded = menuAccess.SERVER_MENU_BRIDGE.filter((entry) => entry.evidence.startsWith("menu-bridge-alignment.md:"));
  assert.equal(legacy.length, 10, "旧 10 条必须原样保留");
  assert.equal(expanded.length, 10, "新 10 条必须逐条引本卡对齐证据");
  assert.ok(menuAccess.SERVER_MENU_BRIDGE.every((entry) => /\.md:\d+$/.test(entry.evidence)), "证据必须带行号");
  return "20 条 · 旧10+新10 · 逐条带行号";
});

await run("§二2 桥 routeName 白名单：全部 ∈ manifest，登记例外恰为 system/finance-expenses 两条（多一条即红）", () => {
  const whitelist = new Set(manifest.ALL_MANIFEST_ROUTE_NAMES);
  const unroutable = menuAccess.SERVER_MENU_BRIDGE.filter((entry) => !whitelist.has(entry.routeName));
  assert.deepEqual(
    unroutable.map((entry) => entry.routeName).sort(),
    ["finance-expenses", "system"],
    "白名单外桥条目必须恰为已登记的两条（卡§二.4）",
  );
  return "18/20 在白名单 · 2 条登记例外";
});

await run("§二3 超管 57 码：serverMenuCount=57 · 桥命中 16 码 · 业务映射 14 码 · unmapped=41 · unroutable=[system,finance-expenses]", () => {
  const access = menuAccess.resolveMenuAccess({
    state: "ready", rows: rows57, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(access.serverMenuCount, 57);
  assert.equal(access.mappedMenuCodes.length, 14, `实际 mapped=${access.mappedMenuCodes.join(",")}`);
  assert.equal(access.unmappedMenuCodes.length, 41);
  // serverCodes 顺序：system(100) 先于 finance:expenses(278) 命中白名单外桥条目
  assert.deepEqual(access.unroutableRouteNames, ["system", "finance-expenses"]);
  assert.equal(access.visibleRouteNames.size, 14, "超管角色裁剪后可见 14 项");
  assert.equal(access.empty, false);
  return "57/16/14/41 · unroutable 2";
});

await run("§二4 扩条覆盖 10/12 组；wb.order 与 wb.instant-retail 服务端缺码不可见（诚实登记，不伪造）", () => {
  const cap = eff.resolveEffectiveCapabilities({
    menuState: "ready", menuRows: rows57, userRoles: ["SUPER_ADMIN"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(cap.ok, true);
  const groupCodes = new Set(cap.rail.map((row) => row.groupCode));
  assert.equal(cap.rail.length, 10, `实际组=${cap.rail.map((r) => r.groupCode).join(",")}`);
  assert.equal(groupCodes.has("wb.order"), false, "wb.order 服务端目录缺码 ⇒ 交集为空（卡§五）");
  assert.equal(groupCodes.has("wb.instant-retail"), false, "wb.instant-retail 服务端目录缺码 ⇒ 交集为空（卡§五）");
  assert.equal(cap.entries.length, 14);
  return "rail 10 组 · entries 14 · 缺码两域如实缺席";
});

// ═══ §三 权限差集 + 越权直输路由页面级拦截 ═══

await run("§三1 店长 5 码：可见恰为 5 项 5 组（dashboard/sales-order-create/products/inventory-alerts/customers）", () => {
  const access = menuAccess.resolveMenuAccess({
    state: "ready", rows: rows5, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(access.serverMenuCount, 5);
  assert.equal(access.mappedMenuCodes.length, 5);
  assert.deepEqual(
    [...access.visibleRouteNames].sort(),
    ["customers", "dashboard", "inventory-alerts", "products", "sales-order-create"],
  );
  return "店长可见 5/5 · 全部命中 meta.roles(STORE_MANAGER)";
});

await run("§三2 双向差集：超管 14 − 店长 5 = 9 项，且差集含采购/订单等店长无权路由", () => {
  const superVisible = menuAccess.resolveMenuAccess({
    state: "ready", rows: rows57, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"], resolveRoles: makeResolveRoles(),
  }).visibleRouteNames;
  const managerVisible = menuAccess.resolveMenuAccess({
    state: "ready", rows: rows5, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  }).visibleRouteNames;
  const diff = [...superVisible].filter((name) => !managerVisible.has(name));
  assert.equal(superVisible.size, 14);
  assert.equal(managerVisible.size, 5);
  assert.equal(diff.length, 9, `实际差集=${diff.join(",")}`);
  assert.ok(diff.includes("purchase-orders"), "差集必须包含店长越权目标 /purchase-orders");
  const reverse = [...managerVisible].filter((name) => !superVisible.has(name));
  assert.equal(reverse.length, 0, "店长可见集必须是超管可见集的子集（有权限⇒不越出超管面）");
  return "14-5=9 · purchase-orders 在差集 · 店长⊆超管";
});

await run("§三3 店长 rail 投影 5 组：集合全量投影与二级栏子集同源（S2 唯一生产能力源）", () => {
  const cap = eff.resolveEffectiveCapabilities({
    menuState: "ready", menuRows: rows5, userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(cap.ok, true);
  assert.deepEqual(cap.rail.map((row) => row.groupCode).sort(), ["wb.customer", "wb.dashboard", "wb.inventory", "wb.product", "wb.sales"]);
  assert.equal(cap.rail.length, 5);
  assert.equal(cap.taskCenter.length, 5, "任务中心 = 集合全量");
  assert.equal(cap.quickEntry.length, 5, "快捷入口 = 集合全量");
  // 二级栏 = 原型已接线项 ∩ 集合，是集合的子集（不要求等数，但不得越权）
  assert.ok(cap.subnav.length > 0, "店长二级栏不应为空");
  assert.ok(cap.subnav.length <= cap.routeNames.size, "二级栏不得超出集合");
  for (const entry of cap.subnav) {
    assert.ok(cap.routeNames.has(entry.routeName), `二级栏 ${entry.routeName} 越出生产集合`);
  }
  return `rail5 · taskCenter5 · quickEntry5 · subnav${cap.subnav.length}⊆集合（同源）`;
});

await run("§三4 权限过滤层实证：全 57 码喂店长 ⇒ 最终集必须收窄且逐项命中 STORE_MANAGER（删过滤即红）", () => {
  // rows5 的业务集本身就只有 5 项且全部有权，无法证明「角色过滤层」真实存在；
  // 用隔离库全 57 码作诊断输入，业务层命中 14 项，角色层必须裁掉超管/营销/系统路由。
  const access = menuAccess.resolveMenuAccess({
    state: "ready", rows: rows57, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  });
  const resolve = makeResolveRoles();
  assert.ok(
    access.businessVisibleRouteNames.size > access.visibleRouteNames.size,
    "角色过滤必须收窄业务集合（删过滤 ⇒ 二者相等即红）",
  );
  for (const name of access.visibleRouteNames) {
    const roles = resolve(name);
    assert.ok(roles && roles.includes("STORE_MANAGER"), `越权路由 ${name} 不得进入店长最终集`);
  }
  return `业务 ${access.businessVisibleRouteNames.size} → 角色 ${access.visibleRouteNames.size}（逐项命中 STORE_MANAGER）`;
});

// ═══ §四 四态（空/错/载入/恢复）═══

await run("§四1 error 态 fail-closed：可见集空 + canRetry=true（不回退全量菜单）", () => {
  const access = menuAccess.resolveMenuAccess({
    state: "error", rows: null, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(access.state, "error");
  assert.equal(access.visibleRouteNames.size, 0, "error 态回退全量 = 硬编码兜底（红线）");
  assert.equal(access.canRetry, true);
  assert.match(access.notice, /菜单服务不可用/);
  return "visible=0 · canRetry=true";
});

await run("§四2 loading 态 fail-closed：可见集空 + canRetry=false", () => {
  const access = menuAccess.resolveMenuAccess({
    state: "loading", rows: null, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(access.visibleRouteNames.size, 0);
  assert.equal(access.canRetry, false);
  assert.match(access.notice, /加载/);
  return "visible=0 · canRetry=false";
});

await run("§四3 empty 态：服务端空菜单（无绑定角色）⇒ empty=true + 诚实文案", () => {
  const access = menuAccess.resolveMenuAccess({
    state: "ready", rows: [], manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(access.serverMenuCount, 0);
  assert.equal(access.empty, true);
  assert.match(access.notice, /无可见入口/);
  const cap = eff.resolveEffectiveCapabilities({
    menuState: "ready", menuRows: [], userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(cap.ok, false);
  assert.equal(cap.failReason, "empty-menu");
  return "empty-menu 原因码点名";
});

await run("§四4 恢复态：error → ready(真实行) 一次解析即恢复可见（retry 链路同函数）", () => {
  const before = menuAccess.resolveMenuAccess({
    state: "error", rows: null, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(before.visibleRouteNames.size, 0);
  const after = menuAccess.resolveMenuAccess({
    state: "ready", rows: rows5, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(after.visibleRouteNames.size, 5, "恢复后必须回到真实可见集，不得停留在 error 空集");
  assert.equal(after.empty, false);
  return "error→ready 恢复 5 项";
});

// ═══ §五 越权直输路由：真实路由守卫页面级拦截（非菜单隐藏） ═══

function futureToken() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `header.${Buffer.from(JSON.stringify({ exp })).toString("base64")}.signature`;
}

async function pushWithRoles(roles, target) {
  warnLog.length = 0;
  setActivePinia(createPinia());
  await router.replace("/login");
  useAuthStore().setAuth(futureToken(), { roles });
  try {
    await router.push(target);
  } catch {
    /* 导航中止即拦截成功的一种形态 */
  }
  return { path: router.currentRoute.value.path, warnCount: warnLog.length };
}

await run("§五1 越权直输 /purchase-orders（店长）：页面级拦截，落点≠目标且给出拒绝提示", async () => {
  ROUTE_RECORDS.value = router.getRoutes();
  const r = await pushWithRoles(["STORE_MANAGER"], "/purchase-orders");
  assert.notEqual(r.path, "/purchase-orders", `店长直输采购订单被放行到 ${r.path} = 页面级拦截缺失`);
  assert.ok(r.warnCount > 0, "拦截必须给出可理解提示");
  return `落点=${r.path} · 提示=${r.warnCount} 次`;
});

await run("§五2 店长有权路由直输放行：/customers 真实进入（拦截只对无权路由）", async () => {
  ROUTE_RECORDS.value = router.getRoutes();
  const r = await pushWithRoles(["STORE_MANAGER"], "/customers");
  assert.equal(r.path, "/customers", `店长进入自己权限内页面被误拦（落点 ${r.path}）`);
  assert.equal(r.warnCount, 0);
  return "落点=/customers · 0 提示";
});

// /orders 的 meta.roles=[SUPER_ADMIN,STORE_MANAGER] 属店长有权页，不能当越权目标；
// 换另一条 SUPER_ADMIN-only 路由（router/index.ts:233 organization）作独立越权样本。
await run("§五3 越权直输 /organization（店长）：另一条 SUPER_ADMIN-only 路由同样页面级拦截", async () => {
  ROUTE_RECORDS.value = router.getRoutes();
  const r = await pushWithRoles(["STORE_MANAGER"], "/organization");
  assert.notEqual(r.path, "/organization");
  assert.ok(r.warnCount > 0);
  return `落点=${r.path} · 提示=${r.warnCount} 次`;
});

// ═══ §六 真实隔离库载荷对齐（E2E API 原始响应 e2e/11-api-menus-manager-raw.json）═══
// 后端 buildTree 对 CATALOG 绑定展开子树：店长 5 条绑定 ⇒ 真实 /menus/user 返回 12 码（不是 5 码）。
// rows5 是最小契约夹具；此处用真实树载荷闭环，证明扁平化→桥→角色裁剪在真实数据上一致。
const REAL_MANAGER_TREE = {
  data: [
    { menuCode: "dashboard", menuName: "仪表盘", menuType: "CATALOG", path: "/dashboard", status: 1, children: [] },
    { menuCode: "goods", menuName: "商品管理", menuType: "CATALOG", path: "/goods", status: 1, children: [
      { menuCode: "goods:loss-gain", menuName: "报损报益", menuType: "MENU", path: null, status: 1 },
      { menuCode: "goods:stock-check", menuName: "盘点调拨", menuType: "MENU", path: null, status: 1 },
      { menuCode: "goods:stock-warning", menuName: "库存预警", menuType: "MENU", path: null, status: 1 },
      { menuCode: "goods:trace", menuName: "溯源查询", menuType: "MENU", path: null, status: 1 },
    ] },
    { menuCode: "sale", menuName: "销售管理", menuType: "CATALOG", path: "/sale", status: 1, children: [] },
    { menuCode: "customer", menuName: "客户管理", menuType: "CATALOG", path: "/customer", status: 1, children: [
      { menuCode: "customer:address", menuName: "收货地址", menuType: "MENU", path: null, status: 1 },
      { menuCode: "customer:level", menuName: "会员等级", menuType: "MENU", path: null, status: 1 },
      { menuCode: "customer:points", menuName: "积分管理", menuType: "MENU", path: null, status: 1 },
      { menuCode: "customer:stored-card", menuName: "储值卡", menuType: "MENU", path: null, status: 1 },
    ] },
  ],
};
const REAL_MANAGER_CODES = [
  "dashboard", "goods", "goods:loss-gain", "goods:stock-check", "goods:stock-warning", "goods:trace",
  "sale", "customer", "customer:address", "customer:level", "customer:points", "customer:stored-card",
];

await run("§六1 真实 12 码树载荷：flatten 递归展开 12 行，顺序与后端 buildTree 一致", () => {
  const flat = apiMenu.flattenUserMenusPayload(REAL_MANAGER_TREE);
  assert.deepEqual(flat.map((r) => r.menuCode), REAL_MANAGER_CODES);
  return "12 行 · 顶层 4 + 子树 8";
});

await run("§六2 真实 12 码 → 桥命中 6 → 角色裁剪 5 项（与 §三1 同集，不因子树展开放大）", () => {
  const flat = apiMenu.flattenUserMenusPayload(REAL_MANAGER_TREE);
  const access = menuAccess.resolveMenuAccess({
    state: "ready", rows: flat, manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"], resolveRoles: makeResolveRoles(),
  });
  assert.equal(access.serverMenuCount, 12, "真实载荷是 12 码，不是绑定行数 5");
  assert.equal(access.mappedMenuCodes.length, 6, "子树里只有 6 码命中桥");
  assert.equal(access.unmappedMenuCodes.length, 6, "6 个未知子码如实登记 unmapped");
  assert.deepEqual(
    [...access.visibleRouteNames].sort(),
    ["customers", "dashboard", "inventory-alerts", "products", "sales-order-create"],
  );
  return "12 → 6 → 5（子树展开不放大权限）";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
