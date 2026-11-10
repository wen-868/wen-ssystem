/**
 * WORKBENCH-02 断言用例 —— 双模式工作台壳层骨架 / 静态 route manifest / 角色可见性
 *
 * 覆盖派单卡硬验收：
 *   ③ 非 SUPER_ADMIN / STORE_MANAGER 角色看不到无权 rail / 菜单（含未知路由 fail-closed）
 *   ④ 反测基线：摘掉一条 route role 映射或把入口改成越权页，本用例必须变红
 *   ⑤ 不接 /api/admin/menus/user 动态菜单，不接 AI 写动作
 *   ⑥ 静态 manifest 12 组 71 项 + 收银 9 项，routeName/path/component 与真实路由一致
 *
 * 运行（admin-web 目录）：npm test
 * 说明：沿用 role-guard.spec.mjs 的 Node 原生 TS 剥离 + 模块钩子方案（不依赖 vitest/esbuild）。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const ROUTER_SRC = path.join(SRC, "router", "index.ts");

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

// ── 浏览器环境（vue-router createWebHistory / shell-mode localStorage）──────
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
  MANUAL_GROUPS,
  CASHIER_ITEMS,
  countManualItems,
  filterVisibleGroups,
  filterVisibleItems,
  isManifestItemVisible,
} = await import("../src/shared/workbench/route-manifest.ts");
const {
  WORKBENCH_MODE_KEY,
  WORKBENCH_SHELL_FLAG_KEY,
  isWorkbenchShellV2Enabled,
  setWorkbenchMode,
  workbenchMode,
} = await import("../src/shared/workbench/shell-mode.ts");

const EXPECTED_GROUP_COUNT = 12;
const EXPECTED_ITEM_COUNT = 71;
const EXPECTED_CASHIER_COUNT = 9;

function normalizePath(raw) {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim().split(/[?#]/)[0].trim();
  if (!trimmed) return "";
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.length > 1 ? prefixed.replace(/\/+$/, "") : prefixed;
}

/** 与 WorkbenchShell.vue 中 resolveRoles 同一语义：未知路由 → null（fail-closed） */
function resolveRoles(routeName) {
  const record = router.getRoutes().find((entry) => entry.name === routeName);
  if (!record) return null;
  const roles = record.meta?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role) => typeof role === "string");
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

const allManualItems = MANUAL_GROUPS.flatMap((group) => group.items);

await run("结构：12 组 / 71 项 / 收银 9 项 / menuCode 唯一", () => {
  assert.equal(MANUAL_GROUPS.length, EXPECTED_GROUP_COUNT, "人工分组数应为 12");
  assert.equal(countManualItems(), EXPECTED_ITEM_COUNT, "人工项数应为 71");
  assert.equal(CASHIER_ITEMS.length, EXPECTED_CASHIER_COUNT, "收银项数应为 9");
  for (const group of MANUAL_GROUPS) {
    assert.ok(group.items.length > 0, `分组 ${group.groupCode} 不应为空`);
  }
  const codes = [...allManualItems, ...CASHIER_ITEMS].map((entry) => entry.menuCode);
  assert.equal(new Set(codes).size, codes.length, "menuCode 不得重复");
  const ids = [
    ...MANUAL_GROUPS.map((group) => group.groupCode),
  ];
  assert.equal(new Set(ids).size, ids.length, "groupCode 不得重复");
  const print = CASHIER_ITEMS.find((entry) => entry.action === "print-settings");
  assert.ok(print, "收银第 9 项应为本地打印设置动作");
  assert.equal(print.routeName, null, "本地动作不得绑定路由");
  return `${MANUAL_GROUPS.length} 组 / ${countManualItems()} 项 / 收银 ${CASHIER_ITEMS.length} 项`;
});

await run("路由对齐：每个 routeName 在真实 router 存在且 path 一致", () => {
  const records = router.getRoutes();
  const named = allManualItems.filter((entry) => entry.routeName);
  assert.equal(named.length, EXPECTED_ITEM_COUNT, "71 项均应绑定 routeName");
  for (const entry of [...named, ...CASHIER_ITEMS.filter((item) => item.routeName)]) {
    const record = records.find((item) => item.name === entry.routeName);
    assert.ok(record, `routeName ${entry.routeName} 在路由表不存在（menuCode=${entry.menuCode}）`);
    assert.equal(
      normalizePath(record.path),
      normalizePath(entry.path),
      `path 不一致：${entry.menuCode} manifest=${entry.path} route=${record.path}`,
    );
  }
  const print = CASHIER_ITEMS.find((entry) => entry.action === "print-settings");
  assert.ok(resolveRoles(print.visibilityFrom), `visibilityFrom ${print.visibilityFrom} 必须存在`);
  return `${named.length + EXPECTED_CASHIER_COUNT - 1} 条路由映射全部对齐`;
});

await run("组件一致：manifest component 与 router lazy import 指向同一文件且文件存在", () => {
  const manifestDir = path.join(SRC, "shared", "workbench");
  const manifestFiles = readdirSync(manifestDir)
    .filter((name) => name.startsWith("manifest-") && name.endsWith(".ts"))
    .map((name) => path.join(manifestDir, name));
  const manifestTargets = new Set();
  for (const file of manifestFiles) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/import\("(\.[^"]+\.vue)"\)/g)) {
      const abs = path.resolve(manifestDir, match[1]);
      assert.ok(existsSync(abs), `${path.basename(file)} 引用的组件不存在：${match[1]}`);
      manifestTargets.add(abs);
    }
  }
  assert.ok(manifestTargets.size >= EXPECTED_ITEM_COUNT, "manifest 组件引用数不得少于 71");

  const routerText = readFileSync(ROUTER_SRC, "utf8");
  const routerDir = path.join(SRC, "router");
  const routerTargets = new Set();
  for (const match of routerText.matchAll(/import\("(\.[^"]+\.vue)"\)/g)) {
    routerTargets.add(path.resolve(routerDir, match[1]));
  }
  // 收银“打印设置”是本地弹窗动作（routeName=null），不在路由表中，属预期例外
  const localActionPanels = new Set([
    path.join(SRC, "modules", "print", "PrintSettingsPanel.vue"),
  ]);
  for (const target of manifestTargets) {
    if (localActionPanels.has(target)) continue;
    assert.ok(routerTargets.has(target), `manifest 组件未出现在路由表：${target}`);
  }
  return `${manifestTargets.size} 个组件文件与路由表一致（1 个本地弹窗动作除外）`;
});

await run("角色可见性：SUPER_ADMIN 全量可见（人工 71 / 收银 9）", () => {
  const groups = filterVisibleGroups(MANUAL_GROUPS, ["SUPER_ADMIN"], resolveRoles);
  const manualCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  assert.equal(groups.length, EXPECTED_GROUP_COUNT, "SUPER_ADMIN 应看到 12 组");
  assert.equal(manualCount, EXPECTED_ITEM_COUNT, "SUPER_ADMIN 应看到 71 项");
  const cashier = filterVisibleItems(CASHIER_ITEMS, ["SUPER_ADMIN"], resolveRoles);
  assert.equal(cashier.length, EXPECTED_CASHIER_COUNT, "SUPER_ADMIN 应看到收银 9 项");
  return `人工 ${manualCount} / 收银 ${cashier.length}`;
});

await run("角色可见性：STORE_MANAGER 只见授权项（系统设置 8 项不可见）", () => {
  const groups = filterVisibleGroups(MANUAL_GROUPS, ["STORE_MANAGER"], resolveRoles);
  const visible = groups.flatMap((group) => group.items);
  for (const entry of visible) {
    const roles = resolveRoles(entry.routeName);
    assert.ok(roles && roles.includes("STORE_MANAGER"), `越权可见：${entry.menuCode}（${entry.routeName}）`);
  }
  const system = groups.find((group) => group.groupCode === "wb.system");
  assert.equal(system, undefined, "STORE_MANAGER 不得看到系统设置组");
  assert.ok(groups.length > 0, "STORE_MANAGER 至少应看到一组授权模块");
  assert.equal(visible.length, 23, "STORE_MANAGER 基线可见项应为 23（全部来自 meta.roles 授权）");
  const cashier = filterVisibleItems(CASHIER_ITEMS, ["STORE_MANAGER"], resolveRoles);
  assert.equal(cashier.length, EXPECTED_CASHIER_COUNT, "STORE_MANAGER 应看到收银 9 项");
  return `人工 ${visible.length}（11 组）/ 收银 ${cashier.length}`;
});

await run("角色可见性：STORE_OPERATOR 不可见人工 12 组、可见收银 9 项", () => {
  const groups = filterVisibleGroups(MANUAL_GROUPS, ["STORE_OPERATOR"], resolveRoles);
  assert.equal(groups.length, 0, "STORE_OPERATOR 不应看到人工 12 组里任何一组");
  const cashier = filterVisibleItems(CASHIER_ITEMS, ["STORE_OPERATOR"], resolveRoles);
  assert.equal(cashier.length, EXPECTED_CASHIER_COUNT, "STORE_OPERATOR 应看到收银 9 项（路由已授权）");
  return "人工 0 组 / 收银 9 项";
});

await run("角色可见性：READONLY 全不可见 + 未知路由 fail-closed", () => {
  const groups = filterVisibleGroups(MANUAL_GROUPS, ["READONLY"], resolveRoles);
  assert.equal(groups.length, 0, "READONLY 不得看到任何人工分组");
  const cashier = filterVisibleItems(CASHIER_ITEMS, ["READONLY"], resolveRoles);
  assert.equal(cashier.length, 0, "READONLY 不得看到收银入口");
  const ghost = {
    menuCode: "web.ghost",
    routeName: "route-not-exists",
    path: "/route-not-exists",
    title: "幽灵入口",
    component: () => Promise.resolve({}),
  };
  assert.equal(
    isManifestItemVisible(ghost, ["SUPER_ADMIN"], resolveRoles),
    false,
    "未知 routeName 必须 fail-closed",
  );
  return "READONLY 0 / 幽灵路由不可见";
});

await run("路由装配：根布局为 WorkbenchShell，旧壳仅在 flag 关闭时回退", () => {
  const routerText = readFileSync(ROUTER_SRC, "utf8");
  assert.ok(routerText.includes('import WorkbenchShell from "../layouts/WorkbenchShell.vue"'), "路由须引用 WorkbenchShell");
  assert.ok(routerText.includes("component: WorkbenchShell"), "根路由须装配 WorkbenchShell");
  assert.ok(!routerText.includes("import MainLayout"), "根路由不得再直接装配 MainLayout");
  const shellText = readFileSync(path.join(SRC, "layouts", "WorkbenchShell.vue"), "utf8");
  assert.ok(shellText.includes("<MainLayout v-if=\"!shellEnabled\""), "flag 关闭时必须回退旧 MainLayout");
  assert.ok(shellText.includes("switchMode"), "壳层须提供人工/AI 模式切换");
  assert.ok(shellText.includes("router.getRoutes()"), "可见性须从真实路由 meta 派生");
  return "WorkbenchShell 已装配，回退路径保留";
});

await run("约束：无动态菜单调用、无新增 AI 写动作", () => {
  const files = [
    ROUTER_SRC,
    path.join(SRC, "layouts", "WorkbenchShell.vue"),
    path.join(SRC, "layouts", "ManualSidebar.vue"),
    path.join(SRC, "layouts", "AiNavRail.vue"),
    path.join(SRC, "components", "workbench", "AiFeedContainer.vue"),
    path.join(SRC, "components", "workbench", "AiChatPanel.vue"),
    ...readdirSync(path.join(SRC, "shared", "workbench")).map((name) =>
      path.join(SRC, "shared", "workbench", name),
    ),
  ];
  for (const file of files) {
    assert.ok(statSync(file).isFile(), `待检文件不存在：${file}`);
    const text = readFileSync(file, "utf8");
    assert.ok(
      !/["'`]\/admin\/menus\/user/.test(text),
      `不得接入动态菜单调用：${file}`,
    );
    for (const writeApi of ["sendChatMessage", "confirmAiOperation", "revokeAiOperation", "cancelAiOperation"]) {
      assert.ok(!text.includes(writeApi), `壳层/manifest 不得新增 AI 写动作 ${writeApi}：${file}`);
    }
  }
  return `${files.length} 个文件均未接动态菜单与 AI 写动作`;
});

await run("特征开关：默认启用，wb.shell.v2=0 关闭，=1 恢复", () => {
  localStorage.removeItem(WORKBENCH_SHELL_FLAG_KEY);
  assert.equal(isWorkbenchShellV2Enabled(), true, "默认应启用新壳");
  localStorage.setItem(WORKBENCH_SHELL_FLAG_KEY, "0");
  assert.equal(isWorkbenchShellV2Enabled(), false, "wb.shell.v2=0 应关闭新壳");
  localStorage.setItem(WORKBENCH_SHELL_FLAG_KEY, "off");
  assert.equal(isWorkbenchShellV2Enabled(), false, "wb.shell.v2=off 应关闭新壳");
  localStorage.setItem(WORKBENCH_SHELL_FLAG_KEY, "1");
  assert.equal(isWorkbenchShellV2Enabled(), true, "wb.shell.v2=1 应启用新壳");
  localStorage.removeItem(WORKBENCH_SHELL_FLAG_KEY);
  return "默认 on / 0 off / 1 on";
});

// WORKBENCH-06 口径变更（**留痕，非静默改断言**）：
//   旧口径「默认人工操作台」＝ WT-02 骨架阶段偏差（WT-05 纠正卡 §三.1 明确定性）；
//   新口径「默认 AI 信息流主面」＝ 原型 `mainMode='feed'`（paintMain L2061）+ WT-06 卡 §一.4。
//   人工页改为由第二列/路由进入（原型 actSub L2314 同语义），不再是首屏默认。
//   源文件 shell-mode.ts 内已注明同一依据，二者一致。
await run("模式状态：默认 AI 信息流主面，human ⇄ ai 双向持久化", () => {
  localStorage.removeItem(WORKBENCH_MODE_KEY);
  setWorkbenchMode("ai");
  assert.equal(workbenchMode.value, "ai", "切换后内存态应为 ai");
  assert.equal(localStorage.getItem(WORKBENCH_MODE_KEY), "ai", "切换后应写入 localStorage");
  setWorkbenchMode("human");
  assert.equal(workbenchMode.value, "human", "切换后内存态应为 human");
  assert.equal(localStorage.getItem(WORKBENCH_MODE_KEY), "human", "切回人工后应写入 human");
  return "human ⇄ ai 可持久化";
});

const failed = results.filter((result) => !result.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
