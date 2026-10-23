#!/usr/bin/env node
/**
 * WORKBENCH-04F1 · 角色运行时对等探针（带角色上下文，真实计算）
 *
 * 背景：凌舟验收探针 runtime-permission-probe.mjs 未传角色上下文，
 *       `resolveMenuAccess` 在无角色时对角色层 fail-closed，故 raw/role 均为 0/0、
 *       pass=true 只能证明「不越权」，无法证明「角色实际数值」。
 *       本探针显式传入 STORE_OPERATOR / STORE_MANAGER / SUPER_ADMIN，
 *       证明收银 9/9、STORE_MANAGER 1/0、SUPER_ADMIN 8/27、业务集合恒为 8。
 *
 * 用法：node runtime-role-probe.mjs <WORKBENCH-04F1 工作树绝对路径>
 * 输出：单行 JSON，pass=true 时 exit 0，否则 exit 1
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const worktree = process.argv[2];
if (!worktree) {
  console.error("用法: node runtime-role-probe.mjs <WORKBENCH-04F1 工作树绝对路径>");
  process.exit(2);
}

const SRC = path.join(worktree, "admin-web", "src");
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

// vue-router createWebHistory 需要浏览器环境
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

const { default: router } = await import(pathToFileURL(path.join(SRC, "router", "index.ts")).href);
const manifest = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "route-manifest.ts")).href);
const access = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "menu-access.ts")).href);
const ledger = await import(pathToFileURL(path.join(SRC, "shared", "workbench", "parity-ledger.ts")).href);

/** 与 WorkbenchShell.vue 中 resolveRoles 同一语义：未知路由 → null（fail-closed） */
function resolveRoles(routeName) {
  const record = router.getRoutes().find((entry) => entry.name === routeName);
  if (!record) return null;
  const roles = record.meta?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role) => typeof role === "string");
}

const rows = access.SERVER_MENU_BRIDGE.map((entry) => ({
  menuCode: entry.serverCode,
  menuName: entry.serverCode,
  menuType: "menu",
  path: null,
  status: "1",
}));

const base = {
  rows,
  manifestRouteNames: manifest.ALL_MANIFEST_ROUTE_NAMES,
  resolveRoles,
};

function snapshotFor(userRoles) {
  return access.resolveMenuAccess({ ...base, state: "ready", userRoles });
}

function cashierFor(userRoles) {
  // Shell 收银计算：只按 meta.roles 过滤，不接 /menus/user
  return manifest.filterVisibleItems(manifest.CASHIER_ITEMS, userRoles, resolveRoles).length;
}

function parityOf(snapshot) {
  return ledger.projectParityRuntime([...snapshot.visibleRouteNames]);
}

const operator = snapshotFor(["STORE_OPERATOR"]);
const manager = snapshotFor(["STORE_MANAGER"]);
const superAdmin = snapshotFor(["SUPER_ADMIN"]);
const anonymous = snapshotFor(null);

// 菜单失败态：角色层不放行，但收银仍按角色保底
const errorState = access.resolveMenuAccess({ ...base, state: "error", userRoles: ["STORE_OPERATOR"] });

const operatorParity = parityOf(operator);
const managerParity = parityOf(manager);
const superAdminParity = parityOf(superAdmin);

const businessCount = superAdmin.businessVisibleRouteNames.size;
const result = {
  serverVisibleRoutes: [...superAdmin.businessVisibleRouteNames],
  businessVisible: businessCount,
  storeOperator: {
    visibleRoutes: [...operator.visibleRouteNames],
    cashierBeforeMenu: cashierFor(["STORE_OPERATOR"]),
    cashierAfterMenu: operator.visibleRouteNames.size === 0 ? cashierFor(["STORE_OPERATOR"]) : null,
    cashierOnMenuError: manifest.filterVisibleItems(manifest.CASHIER_ITEMS, ["STORE_OPERATOR"], resolveRoles).length,
    parityManual: operatorParity.manualCount,
    parityActions: operatorParity.actionCount,
    menuErrorVisible: [...errorState.visibleRouteNames],
  },
  storeManager: {
    visibleRoutes: [...manager.visibleRouteNames],
    cashier: cashierFor(["STORE_MANAGER"]),
    parityManual: managerParity.manualCount,
    parityActions: managerParity.actionCount,
  },
  superAdmin: {
    visibleRoutes: [...superAdmin.visibleRouteNames],
    parityManual: superAdminParity.manualCount,
    parityActions: superAdminParity.actionCount,
  },
  noRoles: {
    businessVisible: anonymous.businessVisibleRouteNames.size,
    visibleRoutes: [...anonymous.visibleRouteNames],
  },
  staticLedger: {
    manualCovered: ledger.PARITY.manualCovered,
    manualTotal: ledger.PARITY.manualTotal,
    actionCovered: ledger.PARITY.actionCovered,
    actionTotal: ledger.PARITY.actionTotal,
    statusCounts: ledger.PARITY.statusCounts,
  },
};

const checks = {
  businessIs8: businessCount === 8,
  operatorCashier9: result.storeOperator.cashierBeforeMenu === 9,
  operatorCashierOnError9: result.storeOperator.cashierOnMenuError === 9,
  operatorRoutesEmpty: operator.visibleRouteNames.size === 0,
  operatorParityZero: operatorParity.manualCount === 0 && operatorParity.actionCount === 0,
  operatorMenuErrorEmpty: errorState.visibleRouteNames.size === 0,
  managerVisible1: manager.visibleRouteNames.size === 1 && manager.visibleRouteNames.has("dashboard"),
  managerParity1_0: managerParity.manualCount === 1 && managerParity.actionCount === 0,
  managerCashier9: cashierFor(["STORE_MANAGER"]) === 9,
  superAdmin8_27: superAdminParity.manualCount === 8 && superAdminParity.actionCount === 27,
  // 凌舟驳回项：AI 对等不得再用服务端原始路由（8/27），必须落到角色实际（1/0）
  aiParityUsesRoleNotRaw: managerParity.manualCount === 1 && managerParity.actionCount === 0 && businessCount === 8,
  noRolesFailClosed: anonymous.visibleRouteNames.size === 0 && anonymous.businessVisibleRouteNames.size === 8,
  staticLedgerUnchanged:
    ledger.PARITY.manualCovered === 80 &&
    ledger.PARITY.manualTotal === 80 &&
    ledger.PARITY.actionCovered === 254 &&
    ledger.PARITY.actionTotal === 254,
};

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ...result, checks, pass }));
process.exit(pass ? 0 : 1);
