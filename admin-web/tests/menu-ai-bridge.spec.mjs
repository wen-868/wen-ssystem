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
  const access = resolveMenuAccess({ state: "ready", rows, manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES });
  assert.equal(access.serverMenuCount, 9, "停用行应在计数前剔除");
  assert.equal(access.visibleRouteNames.has("dashboard"), false, "停用菜单不得可见");
  return "status=0 已剔除";
});

await run("反测点 A：服务失败 → 空集且不回退全量（回退全量必红）", () => {
  const access = resolveMenuAccess({
    state: "error",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
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
  const access = resolveMenuAccess({ state: "ready", rows, manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES });
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
    bridge,
  });
  assert.equal(access.visibleRouteNames.size, 0, "未知 routeName 必须不可见");
  assert.deepEqual(access.unroutableRouteNames, ["route-not-exists"], "未知路由须登记");
  return "route-not-exists 不可见";
});

await run("空菜单：ready 空数组 → 空集 + 联系管理员文案", () => {
  const access = resolveMenuAccess({ state: "ready", rows: [], manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES });
  assert.equal(access.visibleRouteNames.size, 0, "空菜单必须空集");
  assert.equal(access.empty, true, "空菜单须标记 empty");
  assert.ok(access.notice.includes("无可见入口"), "空菜单须给出联系管理员提示");
  return "空集 + 提示";
});

await run("加载中：idle/loading 均为空集，且不可重试", () => {
  for (const state of ["idle", "loading"]) {
    const access = resolveMenuAccess({ state, manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES });
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

await run("人工/AI 同源：两侧可见集合完全一致，且所有可见路由均有白名单入口", () => {
  const access = resolveMenuAccess({
    state: "ready",
    rows: serverRows(FULL_MENU_CODES),
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
  });
  const groups = filterVisibleGroups(
    restrictManifestGroups(MANUAL_GROUPS, access.visibleRouteNames),
    ["SUPER_ADMIN"],
    resolveRoles,
  );
  const cashier = filterVisibleItems(
    restrictManifestItems(CASHIER_ITEMS, access.visibleRouteNames),
    ["SUPER_ADMIN"],
    resolveRoles,
  );
  const sources = new Set();
  for (const entry of [...groups.flatMap((group) => group.items), ...cashier]) {
    const source = entry.routeName ?? entry.visibilityFrom ?? "";
    assert.ok(source, `可见入口缺少来源：${entry.menuCode}`);
    assert.ok(access.visibleRouteNames.has(source), `人工侧出现服务端不可见入口：${entry.menuCode}`);
    sources.add(source);
  }
  assert.equal(sources.size, access.visibleRouteNames.size, "可见路由必须全部有人工入口承接");
  for (const routeName of access.visibleRouteNames) {
    assert.equal(isRouteVisible(routeName, access.visibleRouteNames), true, `${routeName} 可见性判定不一致`);
  }
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
  });
  const runtime = projectParityRuntime([...access.visibleRouteNames]);
  assert.equal(runtime.restricted, true, "动态菜单下须标记受限");
  assert.ok(runtime.manualCount > 0 && runtime.manualCount < 80, `运行时人工入口应被裁剪：${runtime.manualCount}`);
  assert.ok(runtime.actionCount >= 0 && runtime.actionCount < 254, `运行时动作应被裁剪：${runtime.actionCount}`);
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

await run("业务冻结：views 与 backend 相对基线零改动", () => {
  const out = execSync(
    `"${GIT}" -C "${REPO_ROOT}" diff --name-only ${BASELINE} -- admin-web/src/views backend`,
    { encoding: "utf8" },
  ).trim();
  assert.equal(out, "", `不得改动业务页面或后端：\n${out}`);
  return "views/backend 零 diff";
});

const failed = results.filter((result) => !result.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;