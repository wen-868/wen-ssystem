/**
 * WORKBENCH-10-UIUX-PARITY-F1 补齐项 6 断言用例 —— 12 模块测试注入的边界（诚实侧）
 *
 * 判据（派单卡 §四 原文四条要求 + §六 红线）：
 *   1. 保留静态 rail 12 组真相源（`MANUAL_GROUPS` 12 组 71 项不得被改动或替换）；
 *   2. 注入只服务 UIUX 走查：生产 `SERVER_MENU_BRIDGE` 真值一条不动（10 条 ⇒ 4 组 8 项）；
 *   3. 注入必须自证：仅开发态 + 精确参数才激活，且 DOM 留「测试注入」角标；
 *   4. 真实生产态仍按权限 fail-closed：注入只跳过 `/menus/user` 交集这一步，
 *      `meta.roles` 角色裁剪照常 ⇒ 低权限角色即使带参数也看不到 12 组。
 *
 * 运行（admin-web 目录）：node tests/wb-g-injection.spec.mjs
 * 说明：沿用仓内 Node 原生 TS 剥离 + 模块钩子方案，不依赖 vitest；本用例不需要浏览器环境，
 *      且刻意不注入 window——`readUiuxInjection()` 的无浏览器分支正是要验的 fail-closed 路径。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

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

const inject = await import("../src/shared/workbench/wb-uiux-injection.ts");
const manifest = await import("../src/shared/workbench/route-manifest.ts");
const menuAccess = await import("../src/shared/workbench/menu-access.ts");

function read(rel) {
  return readFileSync(path.join(SRC, rel), "utf8");
}

/** 注释里出现桥接名/角色名是允许的（正是边界说明），所以「不得引用」类断言只看可执行代码 */
function codeOnly(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

const INJECT_SRC = "shared/workbench/wb-uiux-injection.ts";
const SHELL_SRC = "layouts/WorkbenchShell.vue";
const WB_UIUX_PARAM_LITERAL = "wb_uiux";
const PARAM = inject.WB_UIUX_INJECT_PARAM;
const VALUE = inject.WB_UIUX_INJECT_VALUE;

// ═══ 一、生产上界：桥接真值未被本单改动，注入存在的理由就是这道缺口 ═══

await run("生产上界：SERVER_MENU_BRIDGE 仍 10 条 ⇒ 交集只覆盖 4 组 8 项（12 组 71 项真相源不动）", () => {
  assert.equal(menuAccess.SERVER_MENU_BRIDGE.length, 10, "菜单桥条数被改动即越权（卡§六禁改桥接真值）");
  assert.ok(
    menuAccess.SERVER_MENU_BRIDGE.every((entry) => typeof entry.evidence === "string" && entry.evidence.includes(".md:")),
    "每条桥接都必须有证据行号，不得有空口",
  );
  const bridgeNames = new Set(menuAccess.SERVER_MENU_BRIDGE.map((entry) => entry.routeName));
  const restricted = menuAccess.restrictManifestGroups(manifest.MANUAL_GROUPS, bridgeNames);
  const restrictedItems = restricted.reduce((sum, group) => sum + group.items.length, 0);
  assert.equal(manifest.MANUAL_GROUPS.length, 12, "静态 rail 12 组真相源必须保留");
  assert.equal(manifest.countManualItems(), 71, "71 项真相源必须保留");
  assert.equal(restricted.length, 4, "生产交集覆盖组数就是 4（卡§四口径），多或少都说明桥被改过");
  assert.equal(restrictedItems, 8);
  return `桥 10 条 · 生产 ${restricted.length}/12 组 ${restrictedItems}/71 项`;
});

// ═══ 二、激活条件：开发态 + 精确参数，两缺一不激活 ═══

await run("生产构建恒不激活：isDev=false 时即使带注入参数也不展开 12 组", () => {
  const res = inject.resolveUiuxInjection({ search: `?${PARAM}=${VALUE}`, isDev: false });
  assert.equal(res.active, false, "生产构建可激活注入 = 越权口子（红线）");
  assert.match(res.reason, /生产构建/, `未激活原因必须可追：${res.reason}`);
  assert.match(res.reason, /不开放测试注入/);
  return res.reason;
});

await run("缺参数与参数值不符都不激活（两种原因文案不同，可核对）", () => {
  const none = inject.resolveUiuxInjection({ search: "", isDev: true });
  assert.equal(none.active, false);
  assert.match(none.reason, /未带注入参数/);
  const wrong = inject.resolveUiuxInjection({ search: `?${PARAM}=all`, isDev: true });
  assert.equal(wrong.active, false, "参数值放宽即等于给生产开后门");
  assert.match(wrong.reason, /未带注入参数/);
  const otherKey = inject.resolveUiuxInjection({ search: "?wb_uiuxx=12-groups", isDev: true });
  assert.equal(otherKey.active, false);
  return "空串 / 值不符 / 参数名不符 ⇒ 三态全不激活";
});

await run("开发态 + 精确参数才激活，且 reason 自证仍受角色裁剪", () => {
  const res = inject.resolveUiuxInjection({ search: `?x=1&${PARAM}=${VALUE}`, isDev: true });
  assert.equal(res.active, true, "开发态带精确参数应激活（否则 12 组走查无法进行）");
  assert.match(res.reason, /12 组/);
  assert.match(res.reason, /角色裁剪/, `激活说明必须写清边界：${res.reason}`);
  return res.reason;
});

await run("跳过交集只发生在激活态：未激活一律走生产链（resolveMenuAccess 那一步不省）", () => {
  assert.equal(inject.shouldSkipMenuBridgeTrimming({ active: false, reason: "生产构建" }), false);
  assert.equal(inject.shouldSkipMenuBridgeTrimming({ active: true, reason: "开发态" }), true);
  const dev = inject.resolveUiuxInjection({ search: `?${PARAM}=${VALUE}`, isDev: true });
  assert.equal(inject.shouldSkipMenuBridgeTrimming(dev), true);
  const prod = inject.resolveUiuxInjection({ search: `?${PARAM}=${VALUE}`, isDev: false });
  assert.equal(inject.shouldSkipMenuBridgeTrimming(prod), false, "生产态跳过菜单桥 = 用注入冒充权限态");
  return "false⇒走生产 / true⇒仅跳过交集";
});

await run("无浏览器环境按生产处理：readUiuxInjection 不猜窗口状态", () => {
  assert.equal(typeof window, "undefined", "本用例必须在无 window 环境跑（否则测的是浏览器分支）");
  const res = inject.readUiuxInjection();
  assert.equal(res.active, false);
  assert.match(res.reason, /无浏览器环境/);
  return res.reason;
});

await run("角标文案自证非生产态（截图即可核对，不当权限证据用）", () => {
  assert.ok(inject.WB_UIUX_INJECT_WATERMARK.length > 0, "水印文案不得为空");
  assert.match(inject.WB_UIUX_INJECT_WATERMARK, /测试注入/);
  assert.match(inject.WB_UIUX_INJECT_WATERMARK, /非生产权限态/);
  assert.equal(inject.WB_UIUX_INJECT_PARAM, "wb_uiux");
  assert.equal(inject.WB_UIUX_INJECT_VALUE, "12-groups");
  return `${inject.WB_UIUX_INJECT_PARAM}=${inject.WB_UIUX_INJECT_VALUE} · ${inject.WB_UIUX_INJECT_WATERMARK}`;
});

// ═══ 三、角色裁剪不被绕过（注入 ≠ 提权） ═══

await run("注入展开的 12 组经 fail-closed 角色解析 ⇒ 0 组可见（未知路由一律不可见）", () => {
  const denyAll = () => null;
  const visible = manifest.filterVisibleGroups(manifest.MANUAL_GROUPS, ["STORE_OPERATOR"], denyAll);
  assert.equal(visible.length, 0, "角色解析取不到路由 ⇒ 必须清空，注入不得绕过这一步");
  const noRolesUser = manifest.filterVisibleGroups(manifest.MANUAL_GROUPS, null, denyAll);
  assert.equal(noRolesUser.length, 0);
  return "注入分支后仍接 filterVisibleGroups ⇒ 0/12 组";
});

await run("只授权部分路由时可见集 < 12 组（注入不放大权限，只放大结构可达）", () => {
  const firstTwo = manifest.MANUAL_GROUPS.slice(0, 2);
  const allowed = new Set(
    firstTwo.flatMap((group) => group.items.map((entry) => entry.routeName ?? entry.visibilityFrom).filter(Boolean)),
  );
  const resolveRoles = (routeName) => (allowed.has(routeName) ? ["STORE_OPERATOR"] : null);
  const visible = manifest.filterVisibleGroups(manifest.MANUAL_GROUPS, ["STORE_OPERATOR"], resolveRoles);
  const items = visible.reduce((sum, group) => sum + group.items.length, 0);
  assert.ok(visible.length > 0 && visible.length < 12, `可见组数应落在 (0,12) 区间，实测 ${visible.length}`);
  assert.ok(items < manifest.countManualItems(), `项数不得放大：${items} < 71`);
  assert.deepEqual(
    visible.map((group) => group.groupCode),
    firstTwo.map((group) => group.groupCode),
    "可见组必须恰好是被授权的那两组",
  );
  return `${visible.length}/12 组 · ${items}/71 项`;
});

// ═══ 四、壳层接线与「不写进生产菜单桥」 ═══

await run("壳层接线：注入读取 + data-uiux-inject 属性 + 角标元素三者齐备", () => {
  const shell = read(SHELL_SRC);
  assert.ok(shell.includes("readUiuxInjection"), "壳层未读取注入态");
  assert.ok(/data-uiux-inject="\s*uiuxInjected \? 'on' : 'off'"/.test(shell), "缺少生产/注入两态属性标注");
  assert.ok(shell.includes('data-testid="uiux-inject-flag"'), "缺少注入角标元素");
  assert.ok(shell.includes("WB_UIUX_INJECT_WATERMARK"), "角标文案必须来自常量（不得另抄一份）");
  assert.ok(shell.includes("uiuxInjected"), "角标与属性必须同源");
  return "readUiuxInjection + data-uiux-inject + 角标常量";
});

await run("壳层可见集：注入只替换「菜单桥交集」这一步，角色过滤参数一字不动", () => {
  const shell = read(SHELL_SRC);
  const at = shell.indexOf("const visibleGroups");
  assert.ok(at > -1, "壳层可见集计算缺失");
  const block = shell.slice(at, shell.indexOf(");", at) + 2);
  assert.match(block, /shouldSkipMenuBridgeTrimming\(uiuxInjection\)/, "未接线注入判定");
  assert.match(block, /\?\s*MANUAL_GROUPS\s*:/, "注入分支必须是「跳过交集」而非替换真相源");
  assert.match(block, /restrictManifestGroups\(MANUAL_GROUPS,\s*access\.value\.visibleRouteNames\)/, "生产分支不得被改写");
  assert.match(block, /filterVisibleGroups\([\s\S]*auth\.userRoles,[\s\S]*resolveRoles,?\s*\)/, "角色裁剪必须仍在链路上");
  return block.replace(/\s+/g, " ").slice(0, 150);
});

await run("注入不写生产菜单桥：注入模块代码不引用 SERVER_MENU_BRIDGE，菜单桥也不引用注入参数", () => {
  const injectCode = codeOnly(read(INJECT_SRC));
  assert.ok(!injectCode.includes("SERVER_MENU_BRIDGE"), "注入模块不得读写菜单桥真值");
  assert.ok(!/from "\.\/menu-access"/.test(injectCode), "注入模块不应依赖菜单桥实现");
  const menuCode = codeOnly(read("shared/workbench/menu-access.ts"));
  assert.ok(!menuCode.includes(WB_UIUX_PARAM_LITERAL), "生产菜单桥解析里出现注入参数 = 把测试态写进生产");
  assert.ok(!menuCode.includes("wb-uiux-injection"), "菜单桥不得反向依赖注入模块");
  return "注入侧无桥引用 · 桥侧无注入引用（单向，按可执行代码判定）";
});

await run("注入只放大人工侧结构可达，不放大收银权限（收银 9 项仍只按 meta.roles）", () => {
  const shell = read(SHELL_SRC);
  const at = shell.indexOf("const visibleCashierItems");
  assert.ok(at > -1, "收银可见集计算缺失");
  const block = shell.slice(at, shell.indexOf(");", at) + 2);
  assert.match(block, /filterVisibleItems\(CASHIER_ITEMS,\s*auth\.userRoles,\s*resolveRoles\)/, "收银必须仍按角色派生");
  assert.ok(!block.includes("shouldSkipMenuBridgeTrimming"), "收银被注入放大 = 提权（红线）");
  const injectCode = codeOnly(read(INJECT_SRC));
  assert.ok(!/SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR|READONLY/.test(injectCode), "注入模块不得自带角色名单");
  return "收银链无注入分支 · 注入模块代码 0 角色字面量";
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
if (failed.length) {
  console.log("失败项：");
  for (const f of failed) console.log(`  ✗ ${f.name}`);
}
process.exitCode = failed.length === 0 ? 0 : 1;
