/**
 * WORKBENCH-PROTOTYPE-12 · S2 唯一生产能力源 —— 断言用例
 *
 * 覆盖派单卡 §三 必须完成 / §四 硬验收：
 *   1. 生产集合 = 服务端菜单 ∩ 路由 manifest ∩ 角色 ∩ launched（交集不放开，反测变红）；
 *   2. rail / subnav / quick entry / AI / task center 共用同一集合，差集为 0；
 *   3. 未知角色、空菜单、接口失败 fail-closed（不回退全量）；
 *   4. 未上线能力不进 DOM/搜索/深链（isEffectiveRoute / canDeepLinkPath 准入门）；
 *   5. 原型目录只允许开发态/设计预览（生产投影无「待接入」占位，文案黑名单零命中）；
 *   6. 四组角色测试：SUPER_ADMIN、SUPPORT、未知角色、菜单失败；
 *      角色一律来自真实路由表 meta.roles（import 真实 router），不用测试注入替代。
 *
 * 运行（admin-web 目录）：node tests/prototype12-capability-source.spec.mjs
 * 机制：沿用 workbench-shell.spec.mjs 的 Node 原生 TS 剥离 + 模块钩子（不依赖 vitest/esbuild）。
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

// ── 模块钩子：.vue → 桩组件；element-plus → 桩；无扩展名相对导入 → 补 .ts ──
const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS = "data:text/javascript,export const ElMessage={warning(){},success(){},info(){},error(){}};";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) {
      return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    }
    if (specifier === "element-plus") {
      return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    }
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  },
});

// ── 浏览器环境垫片（真实 router 依赖 createWebHistory / auth store 依赖 localStorage）──
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

// 真实路由表：角色判据与路由守卫同源，不使用任何注入夹具
const { default: router } = await import(pathToFileURL(path.join(SRC, "router", "index.ts")).href);
const eff = await import(
  pathToFileURL(path.join(SRC, "shared", "workbench", "effective-capabilities.ts")).href
);
const nav = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "prototype-nav.ts")).href);
const registry = await import(
  pathToFileURL(path.join(SRC, "shared", "workbench", "capability-registry.ts")).href
);
const parityLedger = await import(
  pathToFileURL(path.join(SRC, "shared", "workbench", "parity-ledger.ts")).href
);
const menuAccess = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "menu-access.ts")).href);
const manifest = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "route-manifest.ts")).href);

/** 与 WorkbenchShell.vue 中 resolveRoles 同一语义：未知路由 → null（fail-closed） */
function resolveRoles(routeName) {
  const record = router.getRoutes().find((entry) => entry.name === routeName);
  if (!record) return null;
  const roles = record.meta?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role) => typeof role === "string");
}

/** 全量服务端菜单（桥接全码 + 1 个未知码，验证未知码只登记不渲染） */
const FULL_MENU_ROWS = [
  ...menuAccess.SERVER_MENU_BRIDGE.map((entry) => ({
    menuCode: entry.serverCode,
    menuName: entry.serverCode,
    menuType: "C",
    path: null,
    status: "1",
  })),
  { menuCode: "legacy:ghost-module", menuName: "未知码模块", menuType: "C", path: null, status: "1" },
];

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

function routeNamesOf(entries) {
  return new Set(entries.map((entry) => entry.routeName));
}

/** 所有消费者投影里出现的生产文案（黑名单扫描面） */
function productionLabels(snapshot) {
  const labels = [];
  for (const row of snapshot.rail) labels.push(row.label, row.title);
  for (const entry of snapshot.entries) labels.push(entry.title, entry.groupTitle);
  for (const entry of snapshot.subnav) labels.push(entry.label);
  for (const entry of snapshot.quickEntry) labels.push(entry.title);
  for (const command of snapshot.quickCommands) labels.push(command.label);
  for (const capability of snapshot.ai) labels.push(capability.title);
  for (const entry of snapshot.taskCenter) labels.push(entry.title);
  return labels;
}

// ═══════════════════════════════════════════════════════════════════════════
// 一、SUPER_ADMIN × 完整服务端菜单：交集、顺序、五消费者差集为 0
// ═══════════════════════════════════════════════════════════════════════════

const superSnapshot = eff.resolveEffectiveCapabilities({
  menuState: "ready",
  menuRows: FULL_MENU_ROWS,
  userRoles: ["SUPER_ADMIN"],
  resolveRoles,
});

await run("SUPER：交集不放开 —— 集合 = 桥接路由 ∩ manifest ∩ SUPER_ADMIN（逐项独立复算）", () => {
  assert.equal(superSnapshot.ok, true, `应解析成功：${superSnapshot.notice}`);
  const manifestRoutes = new Set(manifest.ALL_MANIFEST_ROUTE_NAMES);
  const expected = new Set();
  for (const entry of menuAccess.SERVER_MENU_BRIDGE) {
    if (!manifestRoutes.has(entry.routeName)) continue; // 白名单缺失 → 隐藏
    const roles = resolveRoles(entry.routeName);
    if (roles === null) continue; // 未知路由 → 隐藏
    if (roles.length > 0 && !roles.includes("SUPER_ADMIN")) continue; // 角色不命中 → 隐藏
    expected.add(entry.routeName);
  }
  assert.ok(expected.size > 0, "独立复算期望集不应为空（SUPER_ADMIN 全量菜单）");
  assert.equal(
    superSnapshot.routeNames.size,
    expected.size,
    `集合大小应等于独立复算交集（实际 ${[...superSnapshot.routeNames].join(",")}）`,
  );
  for (const routeName of expected) {
    assert.ok(superSnapshot.routeNames.has(routeName), `交集缺项：${routeName}`);
  }
  for (const routeName of superSnapshot.routeNames) {
    assert.ok(expected.has(routeName), `集合多出交集外路由：${routeName}`);
  }
  return `${superSnapshot.routeNames.size} 项 = 桥接 ∩ manifest ∩ SUPER_ADMIN`;
});

await run("SUPER：manifest 有而服务端未返回 ⇒ 裁剪（fail-closed 不回退全量）", () => {
  const trimmed = superSnapshot.diagnostics.trimmedRouteNames;
  assert.ok(
    trimmed.length > manifest.ALL_MANIFEST_ROUTE_NAMES.length - superSnapshot.routeNames.size - 40,
    "诊断应登记裁剪项",
  );
  for (const routeName of manifest.ALL_MANIFEST_ROUTE_NAMES) {
    if (superSnapshot.routeNames.has(routeName)) continue;
    assert.ok(
      !superSnapshot.quickEntry.some((entry) => entry.routeName === routeName) &&
        !superSnapshot.taskCenter.some((entry) => entry.routeName === routeName),
      `未授权路由泄漏进 quickEntry/taskCenter：${routeName}`,
    );
  }
  assert.equal(superSnapshot.diagnostics.restricted, true);
  assert.ok(superSnapshot.diagnostics.unmappedMenuCodes.includes("legacy:ghost-module"), "未知菜单码应登记且不渲染");
  for (const routeName of superSnapshot.routeNames) {
    assert.ok(
      !superSnapshot.diagnostics.unroutableRouteNames.includes(routeName),
      "白名单缺失路由不得出现在集合内",
    );
  }
  return `裁剪 ${trimmed.length} 项 / 集合 ${superSnapshot.routeNames.size} 项`;
});

await run("SUPER：rail —— 13 项原型顺序保留、按真实授权裁剪、空组整块不渲染", () => {
  const protoOrder = nav.PROTOTYPE_RAIL_ITEMS.map((item) => item.key);
  const railKeys = superSnapshot.rail.map((row) => row.protoKey);
  // 顺序：rail 键序列必须与原型声明顺序的相对次序完全一致
  const filteredProto = protoOrder.filter((key) => railKeys.includes(key));
  assert.deepEqual(
    railKeys.filter((key) => !key.startsWith("+")),
    filteredProto,
    `rail 次序偏离原型顺序：${railKeys.join(" → ")}`,
  );
  const moduleRowCount = railKeys.filter((key) => key !== "desk" && !key.startsWith("+")).length;
  assert.ok(moduleRowCount <= nav.PROTOTYPE_BUSINESS_MODULE_COUNT, "业务模块行不得超过原型 11 项");
  const railRouteNames = new Set(superSnapshot.rail.flatMap((row) => row.entries.map((entry) => entry.routeName)));
  assert.equal(railRouteNames.size, superSnapshot.routeNames.size, "rail 覆盖的 routeName 必须等于集合（差集 0）");
  for (const routeName of superSnapshot.routeNames) {
    assert.ok(railRouteNames.has(routeName), `rail 缺少集合内路由：${routeName}`);
  }
  for (const row of superSnapshot.rail) {
    assert.ok(row.entries.length > 0, "空组不得渲染 rail 行");
  }
  return `${railKeys.length} 行，顺序 = 原型次序`;
});

await run("SUPER：五消费者差集为 0 —— rail/quickEntry/taskCenter = 集合，subnav/AI 双向无泄漏", () => {
  const set = superSnapshot.routeNames;
  assert.deepEqual(
    [...routeNamesOf(superSnapshot.quickEntry)].sort(),
    [...set].sort(),
    "quickEntry ≠ 集合",
  );
  assert.deepEqual(
    [...routeNamesOf(superSnapshot.taskCenter)].sort(),
    [...set].sort(),
    "taskCenter ≠ 集合",
  );
  // subnav：双向 —— 不多（无集合外项）不少（集合内命中原型目录的已接线项全覆盖）
  const subnavRoutes = routeNamesOf(superSnapshot.subnav);
  for (const routeName of subnavRoutes) {
    assert.ok(set.has(routeName), `subnav 泄漏集合外路由：${routeName}`);
  }
  // 独立复算「应出现在生产二级栏」的项：模块 rail 键 × 原型目录逐字命中 manifest 标题 × 集合内
  const expectedSubnav = new Set();
  for (const row of superSnapshot.rail) {
    const group = manifest.MANUAL_GROUPS.find((candidate) => candidate.groupCode === row.groupCode);
    if (!group) continue;
    for (const label of nav.PROTOTYPE_SUBCATALOG[row.protoKey] ?? []) {
      for (const item of group.items) {
        if (item.title === label && item.routeName && set.has(item.routeName)) {
          expectedSubnav.add(item.routeName);
        }
      }
    }
  }
  assert.deepEqual(
    [...subnavRoutes].sort(),
    [...expectedSubnav].sort(),
    `subnav 与独立复算不一致：实际 ${[...subnavRoutes].sort().join(",")}`,
  );
  // AI：不泄漏集合外锚点；已上线 ∧（AI 原生 ∨ 锚点命中）全覆盖
  // 独立复算源：parity-ledger.AI_CAPABILITIES（19 项台账 + 锚点人工路由）
  const launchedIds = new Set(
    parityLedger.AI_CAPABILITIES.filter((capability) => registry.isCapabilityLaunched(capability.status)).map(
      (capability) => capability.id,
    ),
  );
  for (const capability of superSnapshot.ai) {
    assert.ok(launchedIds.has(capability.id), `未上线能力进入生产 AI 投影：${capability.id}`);
    for (const routeName of capability.anchoredRouteNames) {
      assert.ok(set.has(routeName), `AI 能力锚点越权：${capability.id} → ${routeName}`);
    }
  }
  const expectedAi = parityLedger.AI_CAPABILITIES.filter(
    (capability) =>
      registry.isCapabilityLaunched(capability.status) &&
      (capability.aiOnly ||
        (capability.manualRouteNames ?? []).some((routeName) => set.has(routeName))),
  ).map((capability) => capability.id);
  assert.deepEqual(
    superSnapshot.ai.map((capability) => capability.id).sort(),
    [...new Set(expectedAi)].sort(),
    "AI 生产投影与独立复算不一致",
  );
  return `subnav ${subnavRoutes.size} 项 / ai ${superSnapshot.ai.length} 项，差集 0`;
});

await run("SUPER：未上线能力不进集合 —— PLANNED/BLOCKED 能力与挂靠指令全部缺席", () => {
  const planned = registry.CAPABILITIES.filter(
    (capability) => capability.status === "PLANNED" || capability.status === "BLOCKED",
  );
  assert.ok(planned.length > 0, "台账应存在未上线能力（否则断言无意义）");
  const aiIds = new Set(superSnapshot.ai.map((capability) => capability.id));
  for (const capability of planned) {
    assert.ok(!aiIds.has(capability.id), `未上线能力 ${capability.id} 出现在生产 AI 投影`);
  }
  for (const command of superSnapshot.quickCommands) {
    const capability = registry.getCapability(command.capabilityId);
    assert.ok(capability && registry.isCapabilityLaunched(capability.status), `指令挂靠未上线能力：${command.label}`);
  }
  assert.deepEqual(
    superSnapshot.quickCommands.map((command) => command.label),
    registry.launchedQuickCommands().map((command) => command.label),
    "生产快捷指令应与 launchedQuickCommands 一致",
  );
  return `未上线 ${planned.length} 项全部缺席；指令 ${superSnapshot.quickCommands.length} 条全为上线能力`;
});

await run("SUPER：生产文案黑名单与「待接入」占位零命中；深链/搜索准入口径正确", () => {
  const violations = eff.findProductionCopyViolations(productionLabels(superSnapshot));
  assert.deepEqual(violations, [], `生产文案命中黑名单：${violations.join(" | ")}`);
  const effectivePath = superSnapshot.entries.find((entry) => entry.path)?.path;
  assert.ok(effectivePath, "集合中应存在可跳转路由");
  assert.equal(eff.canDeepLinkPath(effectivePath, superSnapshot), true, "集合内路径应可深链");
  const blockedPath = manifest.ALL_MANIFEST_ITEMS.map((item) => item.path).find(
    (candidate) => candidate && !superSnapshot.routeNames.has(
      manifest.ALL_MANIFEST_ITEMS.find((item) => item.path === candidate)?.routeName ?? "",
    ),
  );
  assert.ok(blockedPath, "应存在被裁剪的 manifest 路径（否则反测无意义）");
  assert.equal(eff.canDeepLinkPath(blockedPath, superSnapshot), false, "集合外路径不得深链");
  assert.equal(eff.canDeepLinkPath("/no-such-page", superSnapshot), false, "未知路径 fail-closed");
  const outside = manifest.ALL_MANIFEST_ROUTE_NAMES.find((name) => !superSnapshot.routeNames.has(name));
  assert.equal(eff.isEffectiveRoute(outside, superSnapshot), false, "集合外路由不得进入搜索/DOM");
  return `黑名单 0 命中；深链准入口径 ${superSnapshot.routeNames.size} 项`;
});

// ═══════════════════════════════════════════════════════════════════════════
// 二、真实角色裁剪：STORE_MANAGER 只见 meta.roles 授权 ∩ 服务端菜单
// ═══════════════════════════════════════════════════════════════════════════

await run("STORE_MANAGER：角色裁剪为真实 meta.roles ∩ 菜单交集（非注入口径）", () => {
  const snapshot = eff.resolveEffectiveCapabilities({
    menuState: "ready",
    menuRows: FULL_MENU_ROWS,
    userRoles: ["STORE_MANAGER"],
    resolveRoles,
  });
  assert.equal(snapshot.ok, true, `应解析成功：${snapshot.notice}`);
  // 全量桥接码中仅 dashboard 允许 STORE_MANAGER（router meta.roles 真实判据）
  const expected = menuAccess.SERVER_MENU_BRIDGE.filter((entry) => {
    const roles = resolveRoles(entry.routeName);
    return roles !== null && (roles.length === 0 || roles.includes("STORE_MANAGER"));
  }).map((entry) => entry.routeName);
  assert.deepEqual(
    [...snapshot.routeNames].sort(),
    [...new Set(expected)].sort(),
    "STORE_MANAGER 集合应等于其真实授权交集",
  );
  return `集合 ${snapshot.routeNames.size} 项（${[...snapshot.routeNames].join(", ")}）`;
});

// ═══════════════════════════════════════════════════════════════════════════
// 三、fail-closed 四组：SUPPORT / 未知角色 / 菜单失败（error+loading+空）/ 空交集
// ═══════════════════════════════════════════════════════════════════════════

function assertFailClosed(snapshot, reason, label) {
  assert.equal(snapshot.ok, false, `${label} 应 fail-closed`);
  assert.equal(snapshot.failReason, reason, `${label} 原因码应为 ${reason}`);
  assert.equal(snapshot.routeNames.size, 0, `${label} 集合应为空`);
  assert.equal(snapshot.entries.length, 0);
  assert.equal(snapshot.rail.length, 0);
  assert.equal(snapshot.subnav.length, 0);
  assert.equal(snapshot.quickEntry.length, 0);
  assert.equal(snapshot.ai.length, 0);
  assert.equal(snapshot.taskCenter.length, 0);
  assert.ok(snapshot.notice.length > 0, `${label} 应给出状态文案`);
  assert.equal(eff.canDeepLinkPath("/dashboard", snapshot), false, `${label} 深链应关闭`);
  assert.equal(eff.isEffectiveRoute("dashboard", snapshot), false, `${label} 路由应不可见`);
}

await run("SUPPORT：平台只读角色无商户工作台授权 ⇒ 空集合（原因码区别于未知角色）", () => {
  const snapshot = eff.resolveEffectiveCapabilities({
    menuState: "ready",
    menuRows: FULL_MENU_ROWS,
    userRoles: ["SUPPORT"],
    resolveRoles,
  });
  assertFailClosed(snapshot, "no-effective-capability", "SUPPORT");
  // SUPPORT 属平台已知角色：必须能从已知集合中被识别，但交集为空
  const known = eff.knownWorkbenchRoles(resolveRoles);
  assert.ok(known.has("SUPPORT"), "SUPPORT 应登记为平台已知角色");
  assert.ok(!known.has("NOT_A_ROLE"), "未知角色不应进入已知集合");
  return "SUPPORT 空集合，fail-closed";
});

await run("未知角色：无法识别 ⇒ 空集合（不回退全量，混合角色按已识别部分收敛）", () => {
  assertFailClosed(
    eff.resolveEffectiveCapabilities({
      menuState: "ready",
      menuRows: FULL_MENU_ROWS,
      userRoles: ["GHOST_ROLE"],
      resolveRoles,
    }),
    "unknown-role",
    "纯未知角色",
  );
  assertFailClosed(
    eff.resolveEffectiveCapabilities({ menuState: "ready", menuRows: FULL_MENU_ROWS, userRoles: [], resolveRoles }),
    "unknown-role",
    "空角色",
  );
  assertFailClosed(
    eff.resolveEffectiveCapabilities({ menuState: "ready", menuRows: FULL_MENU_ROWS, userRoles: null, resolveRoles }),
    "unknown-role",
    "null 角色",
  );
  // 混合：一个已识别 + 一个未知 ⇒ 按已识别角色的真实授权收敛，不因未知角色而放大也不清空
  const mixed = eff.resolveEffectiveCapabilities({
    menuState: "ready",
    menuRows: FULL_MENU_ROWS,
    userRoles: ["SUPER_ADMIN", "GHOST_ROLE"],
    resolveRoles,
  });
  assert.equal(mixed.ok, true, "混合角色应按已识别角色收敛");
  assert.ok(mixed.routeNames.size > 0 && mixed.routeNames.size <= superSnapshot.routeNames.size);
  return "未知/空/null 全部 fail-closed；混合角色按真实授权收敛";
});

await run("菜单失败：error / loading / 空菜单 / 全未知码 ⇒ 全部 fail-closed 空集合", () => {
  assertFailClosed(
    eff.resolveEffectiveCapabilities({ menuState: "error", menuRows: null, userRoles: ["SUPER_ADMIN"], resolveRoles }),
    "menu-error",
    "接口失败",
  );
  assertFailClosed(
    eff.resolveEffectiveCapabilities({ menuState: "loading", menuRows: null, userRoles: ["SUPER_ADMIN"], resolveRoles }),
    "loading",
    "加载中",
  );
  assertFailClosed(
    eff.resolveEffectiveCapabilities({ menuState: "idle", menuRows: null, userRoles: ["SUPER_ADMIN"], resolveRoles }),
    "loading",
    "未发起",
  );
  assertFailClosed(
    eff.resolveEffectiveCapabilities({ menuState: "ready", menuRows: [], userRoles: ["SUPER_ADMIN"], resolveRoles }),
    "empty-menu",
    "空菜单",
  );
  assertFailClosed(
    eff.resolveEffectiveCapabilities({
      menuState: "ready",
      menuRows: [{ menuCode: "legacy:all-unknown", menuName: "x", menuType: "C", path: null, status: "1" }],
      userRoles: ["SUPER_ADMIN"],
      resolveRoles,
    }),
    "no-effective-capability",
    "全未知码",
  );
  assert.equal(
    eff.resolveEffectiveCapabilities({ menuState: "ready", menuRows: [], userRoles: ["SUPER_ADMIN"], resolveRoles })
      .notice.includes("不回退") ||
      eff.resolveEffectiveCapabilities({ menuState: "error", menuRows: null, userRoles: ["SUPER_ADMIN"], resolveRoles })
        .notice.includes("不回退"),
    true,
    "失败文案应明示不回退全量菜单",
  );
  return "error/loading/idle/空/全未知码 五态全部空集合";
});

await run("反测：服务端菜单缺码 ⇒ 对应路由立即从集合与全部消费者投影消失", () => {
  const reducedRows = FULL_MENU_ROWS.filter((row) => row.menuCode !== "system:print");
  const snapshot = eff.resolveEffectiveCapabilities({
    menuState: "ready",
    menuRows: reducedRows,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
  });
  assert.equal(snapshot.ok, true);
  assert.ok(!snapshot.routeNames.has("system-print"), "缺码路由不得出现在集合");
  assert.ok(!routeNamesOf(snapshot.quickEntry).has("system-print"), "缺码路由泄漏 quickEntry");
  assert.ok(!routeNamesOf(snapshot.taskCenter).has("system-print"), "缺码路由泄漏 taskCenter");
  assert.ok(!snapshot.subnav.some((entry) => entry.routeName === "system-print"), "缺码路由泄漏 subnav");
  assert.ok(!snapshot.rail.some((row) => row.entries.some((entry) => entry.routeName === "system-print")), "缺码路由泄漏 rail");
  assert.equal(
    snapshot.routeNames.size,
    superSnapshot.routeNames.size - 1,
    "集合大小应恰好减一（交集精确）",
  );
  return "缺 system:print ⇒ 集合精确减一，五投影同步消失";
});

// ═══════════════════════════════════════════════════════════════════════════
// 四、口径守恒：解析器纯度与生产二级栏函数的边界
// ═══════════════════════════════════════════════════════════════════════════

await run("planProductionSubnav：未接线目录项不返回（原型目录只进开发态/设计预览）", () => {
  const group = manifest.MANUAL_GROUPS.find((candidate) => candidate.groupCode === "wb.inventory");
  assert.ok(group, "应存在库存分组");
  const fullSet = new Set(manifest.ALL_MANIFEST_ROUTE_NAMES); // 故意放大到全量白名单
  const rows = nav.planProductionSubnav("inventory", group.items, fullSet);
  for (const row of rows) {
    assert.ok(row.item.routeName && fullSet.has(row.item.routeName), `生产二级栏泄漏未授权项：${row.label}`);
    assert.equal(row.label, row.item.title, "生产二级栏文案必须来自 manifest 标题");
  }
  // 与原型结构契约对比：planPrototypeSubnav 保留 pending，本函数必须更少或相等
  const protoPlan = nav.planPrototypeSubnav("inventory", group.items);
  const pendingCount = protoPlan.filter((entry) => entry.status === "pending").length;
  assert.ok(
    rows.length <= protoPlan.length - pendingCount + 0,
    "生产二级栏不得包含未接线（pending）目录项",
  );
  // 无集合（fail-closed）⇒ 空二级栏
  assert.deepEqual(nav.planProductionSubnav("inventory", group.items, new Set()), [], "空集合 ⇒ 空二级栏");
  return `库存组生产条目 ${rows.length} / 原型目录 ${protoPlan.length}（pending ${pendingCount} 不进生产）`;
});

await run("解析器纯度：相同输入 ⇒ 相同集合；输入行不被就地改写", () => {
  const rows = FULL_MENU_ROWS.map((row) => ({ ...row }));
  const first = eff.resolveEffectiveCapabilities({
    menuState: "ready",
    menuRows: rows,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
  });
  const second = eff.resolveEffectiveCapabilities({
    menuState: "ready",
    menuRows: rows,
    userRoles: ["SUPER_ADMIN"],
    resolveRoles,
  });
  assert.deepEqual([...first.routeNames].sort(), [...second.routeNames].sort(), "两次解析结果不一致");
  assert.deepEqual(rows, FULL_MENU_ROWS, "解析器不得改写输入行");
  return "确定性成立，无副作用";
});

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log(`\n小结：${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);
