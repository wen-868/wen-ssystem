/**
 * WORKBENCH-05 断言用例 —— 灰度、回滚与关键路由回归
 *
 * 覆盖派单卡硬验收：
 *   ① 灰度开关双向（wb.shell.v2 = 1/0）语义正确，清除后回落构建级缺省
 *   ② 新旧壳切换不丢登录态（admin_auth 持久化值零变化）
 *   ③ 壳层渲染互斥：WorkbenchShell 只走一个分支，MainLayout 不回引新壳
 *   ④ 切换不产生循环重定向：POS 角色落地收敛（不会二次被拒又送回同一处）
 *   ⑤ 关键路由回归：命名路由数量不减、manifest 路由全部存在且唯一、POS 路由对收银角色开放
 *   ⑥ 构建级回退护栏：VITE_WORKBENCH_SHELL_V2 可关闭新壳且未被写死
 *   ⑦ 收银 9 项：8 条路由 + 1 个本地动作，且 9 项对 STORE_OPERATOR 全部可达
 *
 * 运行（admin-web 目录）：npm test
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");

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
const { WORKBENCH_SHELL_FLAG_KEY, isWorkbenchShellV2Enabled } = await import(
  "../src/shared/workbench/shell-mode.ts"
);
const { CASHIER_ITEMS, ALL_MANIFEST_ROUTE_NAMES } = await import(
  "../src/shared/workbench/route-manifest.ts"
);
const { resolveLandingPath, canAccessPath, LOGIN_PATH } = await import("../src/router/landing.ts");

const AUTH_STORAGE_KEY = "admin_auth";
const routes = router.getRoutes();

const results = [];
async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

function setFlag(value) {
  if (value === null) localStorage.removeItem(WORKBENCH_SHELL_FLAG_KEY);
  else localStorage.setItem(WORKBENCH_SHELL_FLAG_KEY, value);
  return isWorkbenchShellV2Enabled();
}

function readSrc(...parts) {
  return readFileSync(path.join(SRC, ...parts), "utf8");
}

await run("回滚开关：wb.shell.v2 缺省开启，0/off 关闭，1/on 开启", () => {
  assert.equal(setFlag(null), true, "缺省必须为新壳（灰度默认开启）");
  assert.equal(setFlag("0"), false, "0 必须回退旧壳");
  assert.equal(setFlag("off"), false, "off 必须回退旧壳");
  assert.equal(setFlag("1"), true, "1 必须恢复新壳");
  assert.equal(setFlag("on"), true, "on 必须恢复新壳");
  setFlag(null);
  return "0/off→旧壳，1/on→新壳";
});

await run("灰度双向：1→0→1→0 四连切且清除后回落缺省", () => {
  const seq = ["1", "0", "1", "0"].map((value) => setFlag(value));
  assert.deepEqual(seq, [true, false, true, false], `双向切换序列不符：${JSON.stringify(seq)}`);
  assert.equal(setFlag(null), true, "清除开关必须回落缺省（新壳）");
  return seq.join(" → ");
});

await run("切换不丢登录态：灰度往返后 admin_auth 原值不变", () => {
  const session = JSON.stringify({ token: "runtime-probe-token", user: { roles: ["SUPER_ADMIN"] } });
  localStorage.setItem(AUTH_STORAGE_KEY, session);
  for (const value of ["0", "1", "0"]) setFlag(value);
  assert.equal(localStorage.getItem(AUTH_STORAGE_KEY), session, "壳层开关落实不得触碰登录态存储");
  localStorage.removeItem(AUTH_STORAGE_KEY);
  setFlag(null);
  return "admin_auth 零变化";
});

await run("壳层渲染互斥：新壳与旧壳只渲染其一，旧壳不回引新壳", () => {
  const shell = readSrc("layouts", "WorkbenchShell.vue");
  assert.ok(shell.includes("<MainLayout v-if=\"!shellEnabled\" />"), "新壳文件缺少旧壳回退分支");
  assert.ok(shell.includes("<div v-else class=\"wb-shell\""), "新壳 v-else 分支缺失");
  assert.ok(shell.includes("const shellEnabled = isWorkbenchShellV2Enabled();"), "新壳未在装配时读取开关");
  const main = readSrc("layouts", "MainLayout.vue");
  assert.ok(!main.includes("WorkbenchShell"), "旧壳不得反向引用新壳（会形成互相嵌套）");
  return "v-if/v-else 互斥，MainLayout 无回引";
});

await run("无循环重定向：POS 角色落地自洽且二次解析收敛", () => {
  for (const roles of [["SUPER_ADMIN"], ["STORE_MANAGER"], ["STORE_OPERATOR"]]) {
    const landing = resolveLandingPath(roles, undefined, routes);
    assert.ok(landing.startsWith("/"), `落点必须是绝对路径：${landing}`);
    assert.equal(canAccessPath(routes, landing, roles), true, `${roles.join()} 落点 ${landing} 不可访问`);
    const again = resolveLandingPath(roles, landing, routes);
    assert.equal(again, landing, `${roles.join()} 二次解析不收敛：${landing} → ${again}`);
    assert.notEqual(landing, LOGIN_PATH, `${roles.join()} 有可用页却落登录页（会导致清会话循环）`);
  }
  return "SUPER_ADMIN/STORE_MANAGER/STORE_OPERATOR 均收敛";
});

await run("关键路由回归：命名路由不减、manifest 路由存在且唯一、POS 路由对收银开放", () => {
  const named = routes.filter((route) => typeof route.name === "string");
  assert.ok(named.length >= 79, `命名路由数量下降：${named.length} < 79`);
  const names = new Set(named.map((route) => route.name));
  for (const routeName of ALL_MANIFEST_ROUTE_NAMES) {
    assert.ok(names.has(routeName), `manifest 路由缺失：${routeName}`);
  }
  assert.equal(new Set(ALL_MANIFEST_ROUTE_NAMES).size, ALL_MANIFEST_ROUTE_NAMES.length, "manifest 路由名重复");
  const posRoutes = named.filter((route) => String(route.name).startsWith("pos-"));
  assert.ok(posRoutes.length >= 15, `POS 路由数量下降：${posRoutes.length} < 15`);
  for (const route of posRoutes) {
    const roles = route.meta?.roles;
    assert.ok(
      Array.isArray(roles) && roles.includes("STORE_OPERATOR"),
      `POS 路由 ${route.name} 未对 STORE_OPERATOR 开放`,
    );
  }
  return `${named.length} 命名路由 / ${posRoutes.length} 条 POS 路由`;
});

await run("构建级回退护栏：VITE_WORKBENCH_SHELL_V2 可关闭新壳且构建未写死", () => {
  const shellMode = readSrc("shared", "workbench", "shell-mode.ts");
  assert.ok(shellMode.includes("VITE_WORKBENCH_SHELL_V2"), "shell-mode 未读取构建级开关");
  const localAt = shellMode.indexOf("readLocal(WORKBENCH_SHELL_FLAG_KEY)");
  const envAt = shellMode.indexOf("env?.VITE_WORKBENCH_SHELL_V2");
  assert.ok(localAt > -1 && envAt > -1 && localAt < envAt, "运行时开关必须优先于构建级开关");
  assert.ok(shellMode.includes("configured === \"0\" || configured === \"false\""), "构建级 0/false 未映射为关闭");
  const viteConfig = path.join(here, "..", "vite.config.ts");
  if (existsSync(viteConfig)) {
    const text = readFileSync(viteConfig, "utf8");
    assert.ok(!/VITE_WORKBENCH_SHELL_V2\s*=/.test(text), "vite.config 硬编码覆盖构建级开关");
  }
  return "运行时优先，构建级 0/false 生效";
});

await run("收银 9 项：8 条路由 + 1 个本地动作，且对 STORE_OPERATOR 全可达", () => {
  assert.equal(CASHIER_ITEMS.length, 9, `收银清单必须为 9 项，实际 ${CASHIER_ITEMS.length}`);
  const routeItems = CASHIER_ITEMS.filter((entry) => entry.routeName);
  const actionItems = CASHIER_ITEMS.filter((entry) => !entry.routeName);
  assert.equal(routeItems.length, 8, `收银路由条目必须为 8，实际 ${routeItems.length}`);
  assert.equal(actionItems.length, 1, `收银本地动作必须为 1，实际 ${actionItems.length}`);
  assert.equal(actionItems[0].action, "print-settings", "本地动作必须是打印设置（不产生路由跳转）");
  for (const entry of routeItems) {
    const route = routes.find((candidate) => candidate.name === entry.routeName);
    assert.ok(route, `收银路由缺失：${entry.routeName}`);
    assert.equal(
      canAccessPath(routes, String(route.path), ["STORE_OPERATOR"]),
      true,
      `收银路由 ${entry.routeName} 对 STORE_OPERATOR 不可达`,
    );
  }
  return "9 = 8 路由 + 1 本地动作";
});

const failed = results.filter((result) => !result.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;