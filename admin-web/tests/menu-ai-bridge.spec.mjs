/**
 * WORKBENCH-04 断言用例 —— 动态菜单（/api/admin/menus/user）与 AI 代办桥
 *
 * 覆盖派单卡硬验收：
 *   ① 动态菜单接真实服务端集合，人工/AI 共用同一可见集合；未知码/未知路由/失败/空集 fail-closed，不回退全量
 *   ② AI 代办当前页只交上下文给既有会话，不直接执行写操作；PLANNED/BLOCKED 明确不能代办并给人工回退
 *   ③ 对等台账运行时裁剪，静态基线 80/80、254/254 不变
 *   ④ 反测点名：服务失败回退全量（A）、越权菜单透传（B）、AI 代办直接写（C）
 *
 * 运行（admin-web 目录）：npm test
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const REPO_ROOT = path.join(here, "..", "..");
const BASELINE = "db350f2f6758e3005f48d2226d639bdf230448f3";
const GIT = "C:\\Program Files\\Git\\bin\\git.exe";

const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS = "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";
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

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  history: dom.window.history,
  localStorage: dom.window.localStorage,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const { default: router } = await import("../src/router/index.ts");
const {
  ALL_MANIFEST_ITEMS,
  ALL_MANIFEST_ROUTE_NAMES,
  MANUAL_GROUPS,
  CASHIER_ITEMS,
  filterVisibleGroups,
  filterVisibleItems,
} = await import("../src/shared/workbench/route-manifest.ts");
const {
  SERVER_MENU_BRIDGE,
  MenuPayloadError,
  parseUserMenusPayload,
  resolveMenuAccess,
  restrictManifestGroups,
  restrictManifestItems,
  isRouteVisible,
} = await import("../src/shared/workbench/menu-access.ts");
const { buildPageDelegation, selectPageActionRows } = await import(
  "../src/shared/workbench/ai-bridge.ts"
);
const { PARITY, PARITY_ACTION_ROWS, projectParityRuntime } = await import(
  "../src/shared/workbench/parity-ledger.ts"
);

const EXPECTED_BRIDGE_COUNT = 10;
const EXPECTED_VISIBLE_ROUTES = [
  "dashboard",
  "finance-reconciliation",
  "marketing",
  "marketing-coupon",
  "marketing-flash-sale",
  "marketing-full-reduction",
  "system-config",
  "system-print",
];
const EXPECTED_UNROUTABLE = ["finance-expenses", "system"];

function resolveRoles(routeName) {
  const record = router.getRoutes().find((entry) => entry.name === routeName);
  if (!record) return null;
  const roles = record.meta?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role) => typeof role === "string");
}

function serverRows(codes, status = "1") {
  return codes.map((menuCode) => ({
    menuCode,
    menuName: menuCode,
    menuType: "MENU",
    path: null,
    status,
  }));
}

const FULL_MENU_CODES = SERVER_MENU_BRIDGE.map((entry) => entry.serverCode);

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

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".vue")) out.push(full);
  }
  return out;
}

await run("桥接表：10 条显式映射，serverCode 唯一，均带矩阵行号证据", () => {
  assert.equal(SERVER_MENU_BRIDGE.length, EXPECTED_BRIDGE_COUNT, "桥接条目应为 10");
  const codes = SERVER_MENU_BRIDGE.map((entry) => entry.serverCode);
  assert.equal(new Set(codes).size, codes.length, "serverCode 不得重复");
  const routes = SERVER_MENU_BRIDGE.map((entry) => entry.routeName);
  assert.equal(new Set(routes).size, routes.length, "同一 routeName 不得被两个服务端菜单码冒名映射");
  for (const entry of SERVER_MENU_BRIDGE) {
    assert.match(entry.evidence, /^10-route-menu-matrix\.md:\d+$/, `证据格式不合法：${entry.serverCode}`);
  }
  return `${SERVER_MENU_BRIDGE.length} 条（含 2 条白名单缺失，见下）`;
});

await run("正常菜单：10 码 → 8 条白名单路由；system / finance-expenses 登记为不可路由", () => {
  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
  });
  const visible = [...access.visibleRouteNames].sort();
  assert.deepEqual(visible, EXPECTED_VISIBLE_ROUTES, "可见路由集合与矩阵判定不一致");
  assert.deepEqual([...access.unroutableRouteNames].sort(), EXPECTED_UNROUTABLE, "白名单缺失项应显式登记");
  assert.equal(access.unmappedMenuCodes.length, 0, "10 码均应命中桥接");
  assert.equal(access.serverMenuCount, 10, "服务端菜单码计数应为 10");
  assert.equal(access.empty, false, "正常菜单不应为空集");
  assert.ok(access.notice.includes("已映射 8 项"), "文案须披露映射数量");
  return `${visible.length}/10 可路由；unroutable=${EXPECTED_UNROUTABLE.join(",")}`;
});

await run("停用菜单：status=0 的行不计入可见集合", () => {
  const rows = serverRows(FULL_MENU_CODES);
  rows[0] = { ...rows[0], status: "0" };
  const access = resolveMenuAccess({ state: "ready", rows, manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES, userRoles: ["SUPER_ADMIN"], resolveRoles });
  assert.equal(access.serverMenuCount, 9, "停用行应在计数前剔除");
  assert.equal(access.visibleRouteNames.has("dashboard"), false, "停用菜单不得可见");
  return "status=0 已剔除";
});

await run("反测点 A：服务失败 → 空集且不回退全量（回退全量必红）", () => {
  const access = resolveMenuAccess({
    state: "error",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
  });
  assert.equal(access.visibleRouteNames.size, 0, "服务失败必须空集，禁止回退全量");
  assert.equal(access.restricted, true, "失败态仍须标记为受限视图");
  assert.equal(access.canRetry, true, "失败态必须提供重试");
  assert.ok(access.notice.includes("不回退全量菜单"), "文案须明确不回退全量");
  assert.equal(
    access.trimmedRouteNames.length,
    ALL_MANIFEST_ROUTE_NAMES.length,
    "全量路由均被裁剪（证明没有悄悄回退）",
  );
  return `trimmed ${access.trimmedRouteNames.length}/${ALL_MANIFEST_ROUTE_NAMES.length}`;
});

await run("反测点 B：未知菜单码只登记不渲染（越权透传必红）", () => {
  const rows = serverRows([...FULL_MENU_CODES, "ghost:page"]);
  const access = resolveMenuAccess({ state: "ready", rows, manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES, userRoles: ["SUPER_ADMIN"], resolveRoles });
  assert.deepEqual(access.unmappedMenuCodes, ["ghost:page"], "未知码须登记");
  assert.equal(access.visibleRouteNames.has("ghost:page"), false, "未知码不得进入可见集合");
  assert.equal(access.visibleRouteNames.size, EXPECTED_VISIBLE_ROUTES.length, "未知码不得放大可见集");
  return "ghost:page 已隐藏";
});

await run("未知 routeName：桥接存在但白名单缺失 → fail-closed 且登记 unroutable", () => {
  const bridge = [
    { serverCode: "dashboard", routeName: "route-not-exists", evidence: "test:1" },
  ];
  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(["dashboard"]),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
    bridge,
  });
  assert.equal(access.visibleRouteNames.size, 0, "未知 routeName 必须不可见");
  assert.deepEqual(access.unroutableRouteNames, ["route-not-exists"], "未知路由须登记");
  return "route-not-exists 不可见";
});

await run("空菜单：ready 空数组 → 空集 + 联系管理员文案", () => {
  const access = resolveMenuAccess({ state: "ready", rows: [], manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES, userRoles: ["SUPER_ADMIN"], resolveRoles });
  assert.equal(access.visibleRouteNames.size, 0, "空菜单必须空集");
  assert.equal(access.empty, true, "空菜单须标记 empty");
  assert.ok(access.notice.includes("无可见入口"), "空菜单须给出联系管理员提示");
  return "空集 + 提示";
});

await run("加载中：idle/loading 均为空集，且不可重试", () => {
  for (const state of ["idle", "loading"]) {
    const access = resolveMenuAccess({ state, manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES, userRoles: ["SUPER_ADMIN"], resolveRoles });
    assert.equal(access.visibleRouteNames.size, 0, `${state} 不得预展示菜单`);
    assert.equal(access.canRetry, false, `${state} 不应出现重试按钮`);
    assert.ok(access.notice.includes("正在加载"), `${state} 文案应为加载中`);
  }
  return "idle/loading 空集";
});

await run("载荷解析：兼容 {data:[]} 与裸数组；非数组/缺 menuCode 一律抛错", () => {
  const wrapped = parseUserMenusPayload({ data: [{ menuCode: "dashboard" }] });
  assert.equal(wrapped.length, 1, "data 包装应可解析");
  const bare = parseUserMenusPayload([{ menuCode: "dashboard", menuName: "工作台" }]);
  assert.equal(bare[0].menuCode, "dashboard", "裸数组应可解析");
  assert.throws(() => parseUserMenusPayload({ code: 0 }), MenuPayloadError, "非数组必须抛错");
  assert.throws(() => parseUserMenusPayload([{ menuName: "x" }]), MenuPayloadError, "缺 menuCode 必须抛错");
  return "wrapped/bare ok，异常形状抛错";
});

await run("人工/AI 同源：人工侧栏路由 ⊆ 最终角色集；收银 9 项按角色保底不参与菜单交集", () => {
  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
  });
  const groups = filterVisibleGroups(
    restrictManifestGroups(MANUAL_GROUPS, access.visibleRouteNames),
    ["SUPER_ADMIN"],
    resolveRoles,
  );
  const cashier = filterVisibleItems(CASHIER_ITEMS, ["SUPER_ADMIN"], resolveRoles);
  const sources = new Set();
  for (const entry of groups.flatMap((group) => group.items)) {
    const source = entry.routeName ?? entry.visibilityFrom ?? "";
    assert.ok(source, `可见入口缺少来源：${entry.menuCode}`);
    assert.ok(access.visibleRouteNames.has(source), `人工侧出现角色不可见入口：${entry.menuCode}`);
    sources.add(source);
  }
  assert.equal(sources.size, access.visibleRouteNames.size, "可见路由必须全部有人工入口承接");
  assert.equal(cashier.length, CASHIER_ITEMS.length, "收银项只按角色保底，不受 /menus/user 交集影响");
  return `人工 ${groups.flatMap((group) => group.items).length} 项 / 收银 ${cashier.length} 项 / 路由 ${sources.size}`;
});
await run("对等裁剪：运行时视图收缩，静态台账仍为 80/80、254/254", () => {
  const full = projectParityRuntime(null);
  assert.equal(full.restricted, false, "null 应为全量视图");
  assert.equal(full.manualCount, PARITY.manualCovered, "全量人工入口应为 80");
  assert.equal(full.actionCount, PARITY.actionCovered, "全量动作应为 254");

  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
  });
  const runtime = projectParityRuntime([...access.visibleRouteNames]);
  assert.equal(runtime.restricted, true, "动态菜单下须标记受限");
  assert.equal(runtime.manualCount, 8, "SUPER_ADMIN 8 条业务路由应命中 8 个入口");
  assert.equal(runtime.actionCount, 27, "SUPER_ADMIN 8 条业务路由应命中 27 条动作");
  assert.equal(PARITY.manualCovered, 80, "静态人工基线不得被改写");
  assert.equal(PARITY.actionCovered, 254, "静态动作基线不得被改写");
  return `运行时 ${runtime.manualCount}/80 · ${runtime.actionCount}/254（静态基线不变）`;
});
await run("AI 代办：只交上下文，含真实 routeName/path/实体 ID/动作清单与确认链要求", () => {
  const routeName = ALL_MANIFEST_ROUTE_NAMES.find((name) => selectPageActionRows([name]).length > 0);
  assert.ok(routeName, "应存在带写动作的页面");
  const entry = ALL_MANIFEST_ITEMS.find((item) => item.routeName === routeName);
  const rows = selectPageActionRows([routeName]);
  const delegation = buildPageDelegation({
    menuCode: entry.menuCode,
    title: entry.title,
    routeName,
    path: entry.path,
    entityId: "ORDER-20261023-001",
    actionRows: rows,
  });
  assert.ok(delegation.prompt.includes("【AI 代办当前页】"), "缺少代办标识");
  assert.ok(delegation.prompt.includes("不要直接执行任何写操作"), "缺少禁止直接写声明");
  assert.ok(delegation.prompt.includes("预览→确认→执行→撤销"), "缺少确认链要求");
  assert.ok(delegation.prompt.includes(routeName), "缺少 routeName");
  assert.ok(delegation.prompt.includes(entry.path), "缺少 path");
  assert.ok(delegation.prompt.includes("ORDER-20261023-001"), "缺少实体 ID");
  assert.equal(delegation.actions.length, rows.length, "动作清单须与静态台账逐行一致");
  assert.ok(delegation.prompt.includes(rows[0].id), "缺少动作 ID");
  return `${delegation.actions.length} 项动作 / 可代办 ${delegation.delegableCount}`;
});

await run("AI 代办：PLANNED/BLOCKED 明确不能代办并给人工回退，不做已可执行暗示", () => {
  const candidate = ALL_MANIFEST_ROUTE_NAMES.map((routeName) => ({
    routeName,
    rows: selectPageActionRows([routeName]),
  })).find((item) => item.rows.some((row) => row.status === "PLANNED" || row.status === "BLOCKED"));
  assert.ok(candidate, "台账中应存在 PLANNED/BLOCKED 动作页");
  const delegation = buildPageDelegation({
    menuCode: "web.test",
    title: "测试页",
    routeName: candidate.routeName,
    path: "/test",
    actionRows: candidate.rows,
  });
  assert.ok(delegation.blockedCount > 0, "应统计不能代办项");
  assert.ok(delegation.prompt.includes("不能代办"), "须明确不能代办");
  assert.ok(delegation.prompt.includes("不要给出“已可执行”的暗示"), "须阻止误导");
  assert.ok(delegation.prompt.includes("人工："), "须给出人工回退路径");
  return `${candidate.routeName}: 不能代办 ${delegation.blockedCount}/${delegation.actions.length}`;
});

await run("AI 代办：只读页不编造写入口", () => {
  const routeName = ALL_MANIFEST_ROUTE_NAMES.find(
    (name) => selectPageActionRows([name]).length === 0,
  );
  assert.ok(routeName, "应存在只读页");
  const delegation = buildPageDelegation({
    menuCode: "web.readonly",
    title: "只读页",
    routeName,
    path: "/readonly",
  });
  assert.equal(delegation.hasWrites, false, "只读页不应有写动作");
  assert.ok(delegation.prompt.includes("只读页"), "须声明只读");
  return routeName;
});

await run("UI 接线：Shell 菜单状态/重试/空态/代办按钮，AI 容器接运行时裁剪", () => {
  const shell = readFileSync(path.join(SRC, "layouts", "WorkbenchShell.vue"), "utf8");
  for (const marker of [
    'data-testid="menu-fault"',
    'data-testid="menu-retry"',
    'data-testid="menu-empty"',
    'data-testid="ai-delegate-current"',
    "fetchUserMenus",
    "restrictManifestGroups",
    "visibleRouteNames",
  ]) {
    assert.ok(shell.includes(marker), `Shell 缺少接线：${marker}`);
  }
  const feed = readFileSync(path.join(SRC, "components", "workbench", "AiFeedContainer.vue"), "utf8");
  assert.ok(feed.includes("projectParityRuntime"), "AI 容器须使用运行时裁剪视图");
  assert.ok(feed.includes('data-testid="menu-notice"'), "AI 容器须展示菜单状态说明");
  assert.ok(feed.includes("visibleRouteNames"), "AI 容器须接收可见集合");
  const chat = readFileSync(path.join(SRC, "components", "workbench", "AiChatPanel.vue"), "utf8");
  assert.ok(chat.includes("pendingCommands"), "异步面板未就绪时须排队，不丢代办上下文");
  return "Shell / AI 容器 / 会话面板接线就绪";
});

await run("【F1】STORE_OPERATOR：收银 9/9（菜单 ready 与 error 两态），业务路由为空", () => {
  const ready = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_OPERATOR"],
    resolveRoles,
  });
  const fault = resolveMenuAccess({
    state: "error",
    rows: [],
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_OPERATOR"],
    resolveRoles,
  });
  const readyCashier = filterVisibleItems(
    restrictManifestItems(CASHIER_ITEMS, ready.visibleRouteNames),
    ["STORE_OPERATOR"],
    resolveRoles,
  );
  const faultCashier = filterVisibleItems(
    restrictManifestItems(CASHIER_ITEMS, fault.visibleRouteNames),
    ["STORE_OPERATOR"],
    resolveRoles,
  );
  assert.equal(ready.visibleRouteNames.size, 0, "STORE_OPERATOR 在业务菜单中无角色可访问路由");
  assert.equal(readyCashier.length, 9, "ready 态收银必须保持 9 项");
  assert.equal(faultCashier.length, 9, "error 态收银不得被清空");
  assert.equal(readyCashier.length, CASHIER_ITEMS.length, "收银 9 项须与静态清单一致");
  return "收银 9/9（ready + error）";
});

await run("【F1】STORE_MANAGER：业务集合 8 与最终角色集 1 分离，AI 对等与人工入口一致", () => {
  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"],
    resolveRoles,
  });
  assert.deepEqual([...access.businessVisibleRouteNames].sort(), EXPECTED_VISIBLE_ROUTES, "业务层应为 8 条");
  assert.deepEqual([...access.visibleRouteNames].sort(), ["dashboard"], "店长最终集应为 dashboard");
  const groups = filterVisibleGroups(
    restrictManifestGroups(MANUAL_GROUPS, access.visibleRouteNames),
    ["STORE_MANAGER"],
    resolveRoles,
  );
  const roleRoutes = [
    ...new Set(
      groups
        .flatMap((group) => group.items)
        .map((entry) => entry.routeName ?? entry.visibilityFrom)
        .filter(Boolean),
    ),
  ].sort();
  const parity = projectParityRuntime(roleRoutes);
  assert.deepEqual(roleRoutes, ["dashboard"], "人工侧栏路由集须与 AI 对等输入一致");
  assert.equal(parity.manualCount, 1, `对等人工数应为 1，实际 ${parity.manualCount}`);
  assert.equal(parity.actionCount, 0, `对等动作数应为 0，实际 ${parity.actionCount}`);
  return "业务 8 → 角色 1；parity 1/0";
});

await run("【F1】SUPER_ADMIN 不回退：业务 8 = 最终 8，对等 8/27", () => {
  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
  });
  assert.equal(access.businessVisibleRouteNames.size, 8, "业务集合应为 8");
  assert.equal(access.visibleRouteNames.size, 8, "超管最终集不得被裁掉");
  const parity = projectParityRuntime([...access.visibleRouteNames]);
  assert.equal(parity.manualCount, 8);
  assert.equal(parity.actionCount, 27);
  return "8/8，parity 8/27";
});

await run("【F1】非 SUPER_ADMIN 不能经 AI 对等看到无权路由动作", () => {
  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    userRoles: ["STORE_MANAGER"],
    resolveRoles,
  });
  const parity = projectParityRuntime([...access.visibleRouteNames]);
  assert.equal(parity.actionCount, 0, "店长不得看到营销/系统写动作");
  const domains = parity.domains.map((entry) => entry.domain);
  for (const forbidden of ["marketing", "system", "reconciliation"]) {
    assert.equal(domains.includes(forbidden), false, `无权域不得出现在对等视图：${forbidden}`);
  }
  return `domains=${domains.join(",") || "（无写域）"}`;
});

await run("【F1】无角色上下文：业务集合仅诊断，最终集为空（不回退业务全量）", () => {
  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
  });
  assert.equal(access.visibleRouteNames.size, 0, "缺角色必须空集");
  assert.equal(access.businessVisibleRouteNames.size, 8, "业务层仍可诊断，但不得驱动 UI");
  return "业务 8 / 最终 0";
});

await run("【F1】源码护栏：Shell 用最终角色集、收银不接菜单、AI 容器只吃最终集", () => {
  const shell = readFileSync(path.join(SRC, "layouts", "WorkbenchShell.vue"), "utf8");
  assert.ok(shell.includes("userRoles: auth.userRoles"), "Shell 必须传 auth.userRoles");
  assert.ok(
    shell.includes("filterVisibleItems(CASHIER_ITEMS, auth.userRoles, resolveRoles)"),
    "收银只按 meta.roles 判定",
  );
  assert.ok(!shell.includes("restrictManifestItems"), "收银不得再接 /menus/user 交集");
  assert.ok(shell.includes(':visible-route-names="visibleRouteNameList"'), "AI 容器必须接收最终角色集");
  assert.ok(
    shell.includes("computed(() => [...access.value.visibleRouteNames])"),
    "AI 容器集合必须取自最终角色集",
  );
  assert.ok(!shell.includes("businessVisibleRouteNames"), "业务原始集合不得驱动 UI/对等");
  const feed = readFileSync(path.join(SRC, "components", "workbench", "AiFeedContainer.vue"), "utf8");
  assert.ok(feed.includes("projectParityRuntime(props.visibleRouteNames"), "对等统计必须用最终集");
  return "Shell / 收银 / AI 容器接线符合";
});
await run("唯一消费点：/admin/menus/user 只出现在 src/api/workbench-menu.ts", () => {
  const hits = [];
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    if (/["'`]\/admin\/menus\/user/.test(text)) hits.push(path.relative(SRC, file).replace(/\\/g, "/"));
  }
  assert.deepEqual(hits, ["api/workbench-menu.ts"], `动态菜单调用点应唯一，实际：${hits.join(", ")}`);
  return hits[0];
});

await run("反测点 C：AI 代办不直接写——无写接口调用、桥模块只产上下文", () => {
  const files = [
    path.join(SRC, "shared", "workbench", "ai-bridge.ts"),
    path.join(SRC, "layouts", "WorkbenchShell.vue"),
    path.join(SRC, "components", "workbench", "AiFeedContainer.vue"),
    path.join(SRC, "components", "workbench", "AiChatPanel.vue"),
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const writeApi of [
      "sendChatMessage",
      "confirmAiOperation",
      "cancelAiOperation",
      "revokeAiOperation",
    ]) {
      assert.ok(!text.includes(writeApi), `不得出现第二套写链路 ${writeApi}：${path.basename(file)}`);
    }
    assert.ok(!/axios|fetch\(/.test(text), `代办链路不得直连接口：${path.basename(file)}`);
  }
  const bridge = readFileSync(path.join(SRC, "shared", "workbench", "ai-bridge.ts"), "utf8");
  assert.ok(!bridge.includes("confirmChain ="), "桥模块不得改写确认链配置");
  const shell = readFileSync(path.join(SRC, "layouts", "WorkbenchShell.vue"), "utf8");
  assert.ok(
    shell.includes("chatPanel.value?.sendQuickCommand?.(delegation.prompt)"),
    "代办必须只把 prompt 交给既有会话",
  );
  return "仅上下文，无直接写";
});

/**
 * 业务冻结守卫 —— WORKBENCH-07 口径修正（变更依据，非放宽）：
 *   WORKBENCH-07 派单卡 §三 明确授权修改两个看板页（WB-AUDIT-01/02/04/08 修复面）。
 *   改为**授权白名单**：允许卡内点名文件，卡外改动一律判红。
 * WORKBENCH-10-UIUX-PARITY-F1 二次修正（同为变更依据，非放宽）：F1 卡 §二 列名授权
 *   `views/dashboard/**`、`views/pos/**`、`views/system/**`（补齐项 B/D.3/E 施工面）；
 *   backend、迁移、权限码、菜单桥接不在授权面内，仍一律判红。
 */
const WORKBENCH_07_ALLOWED_VIEWS = [
  "admin-web/src/views/dashboard/Dashboard.vue",
  "admin-web/src/views/pos/StoreDashboardView.vue",
];
/**
 * WORKBENCH-12-WIRING-BATCH-A 授权（派单卡 §二）：采购两页的 useRoute() 生命周期修复。
 * 按卡累积、逐卡留痕；清单外任何 views/backend 改动仍判红（分辨力不降低）。
 */
const WORKBENCH_12_ALLOWED_VIEWS = [
  "admin-web/src/views/purchase/PurchaseOrders.vue",
  "admin-web/src/views/purchase/PurchaseInStocks.vue",
];

const WORKBENCH_10_F1_ALLOWED_VIEW_DIRS = [
  "admin-web/src/views/dashboard/",
  "admin-web/src/views/pos/",
  "admin-web/src/views/system/",
];
/**
 * WORKBENCH-13B-MODULE-VISUAL-PARITY-01 授权（派单卡 §二 第一行 `admin-web/src/views/**`，
 * §三.C/D 要求 12 个业务模块逐页对齐 + 390 窄口）：本卡实际动过的 8 个页面文件逐名登记（变更依据，非放宽）。
 * backend、迁移、权限码、package.json 不在授权面内 ⇒ 仍一律判红；清单外的第 9 个 views 文件照样红。
 */
const WORKBENCH_13B_ALLOWED_VIEWS = [
  "admin-web/src/views/instant-retail/InstantRetailOrderBoard.vue",
  "admin-web/src/views/instant-retail/InstantRetailShelf.vue",
  "admin-web/src/views/marketing/CouponManage.vue",
  "admin-web/src/views/marketing/FlashSale.vue",
  "admin-web/src/views/marketing/FullReduction.vue",
  "admin-web/src/views/marketing/MarketingView.vue",
  "admin-web/src/views/pos/CashierView.vue",
  "admin-web/src/views/pos/SaleReturnView.vue",
];

await run("业务冻结：views 与 backend 仅允许卡内授权文件改动，卡外零改动", () => {
  const out = execSync(
    `"${GIT}" -C "${REPO_ROOT}" diff --name-only ${BASELINE} -- admin-web/src/views backend`,
    { encoding: "utf8" },
  ).trim();
  const changed = out
    .split(/\r?\n/)
    .map((s) => s.replace(/\\/g, "/").trim())
    .filter(Boolean);
  const allowed = new Set([...WORKBENCH_07_ALLOWED_VIEWS, ...WORKBENCH_12_ALLOWED_VIEWS, ...WORKBENCH_13B_ALLOWED_VIEWS]);
  const violations = changed.filter(
    (f) => !allowed.has(f) && !WORKBENCH_10_F1_ALLOWED_VIEW_DIRS.some((dir) => f.startsWith(dir)),
  );
  assert.deepEqual(violations, [], `views/backend 出现卡外改动（授权清单外一律红）：\n${violations.join("\n")}`);
  return `授权内 ${changed.length} 个 + 卡外 0 个`;
});

const failed = results.filter((result) => !result.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;