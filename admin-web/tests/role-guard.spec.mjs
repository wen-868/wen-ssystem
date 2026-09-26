/**
 * S3-124 断言用例 —— 前端路由守卫「空角色缺省拒绝（fail-closed）」三分支
 *
 * 覆盖（对应派单卡验收标准②）：
 *   用例一：userRoles 命中路由 meta.roles      ⇒ 放行到目标路由
 *   用例二：userRoles 非空但不命中 meta.roles   ⇒ 拒绝，跳既有落点 /dashboard
 *   用例三：userRoles 为空数组（fail-closed）   ⇒ 拒绝，不得停留在受保护路由
 *
 * 运行（admin-web 目录）：npm test   （= node tests/role-guard.spec.mjs）
 *
 * 说明：本用例断言的是真实守卫（src/router/index.ts 导出的 router 实例）在真实
 *       vue-router 导航下的落点，不是用例内复刻的判定表达式 —— 守卫条件一旦回退为
 *       旧写法（`userRoles.length > 0 && …`），用例三会立刻变红。
 *       本脚本不依赖 vitest/vite（本沙箱内 esbuild 无法 spawn，EPERM）：
 *       用 Node 原生 TS 剥离 + 进程内模块钩子直接加载 .ts 源码，jsdom 提供浏览器全局。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROUTER_SRC = path.join(here, "..", "src", "router", "index.ts");

// 受保护目标路由：meta.roles = ["SUPER_ADMIN"]
const PROTECTED = "/quick-entries";
// 既有拒绝分支的跳转落点：meta.roles = ["SUPER_ADMIN", "STORE_MANAGER"]
const DENY_FALLBACK = "/dashboard";

// ── 拒绝提示桩（守卫只用到 ElMessage.warning）──────────────────────────────
const warnLog = [];
globalThis.__elMessageStub = {
  warning: (message) => {
    warnLog.push(message);
    return { close: () => undefined };
  },
};

// ── 进程内模块钩子：.vue → 桩组件；element-plus → 桩；无扩展名相对导入 → 补 .ts ──
const STUB_COMPONENT = "data:text/javascript,export default{render(){return null}}";
const STUB_ELEMENT_PLUS = "data:text/javascript,export const ElMessage=globalThis.__elMessageStub;";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".vue")) {
      return { url: STUB_COMPONENT, shortCircuit: true, format: "module" };
    }
    if (specifier === "element-plus") {
      return { url: STUB_ELEMENT_PLUS, shortCircuit: true, format: "module" };
    }
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      // 源码里的无扩展名相对导入（如 "../stores/auth"）→ 指向真实 .ts 文件
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  },
});

// ── 浏览器环境（vue-router 的 createWebHistory 需要 window/document）────────
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

// ── 加载被测对象：真实 pinia store + 真实路由（守卫）────────────────────────
const { createPinia, setActivePinia } = await import("pinia");
const { useAuthStore } = await import("../src/stores/auth.ts");
const { default: router } = await import("../src/router/index.ts");

/** 构造未过期 JWT 形态 token（守卫用 isTokenExpired 判定） */
function futureToken() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `header.${Buffer.from(JSON.stringify({ exp })).toString("base64")}.signature`;
}

/** 以给定角色集合导航到 target，返回落点路径 / 拒绝提示次数 / 导航失败原因 */
async function pushWithRoles(roles, target) {
  warnLog.length = 0;
  setActivePinia(createPinia());
  // 复位：清空 token 回到 /login，避免 vue-router 的「重复导航」短路（不跑守卫）
  await router.replace("/login");
  useAuthStore().setAuth(futureToken(), { roles });

  let failure = null;
  try {
    await router.push(target);
  } catch (err) {
    failure = err;
  }
  return { path: router.currentRoute.value.path, warnCount: warnLog.length, failure };
}

const results = [];

async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail ? `  ← ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
    console.log(`FAIL  ${name}  ← ${err.message}`);
  }
}

// 守卫判定行（证据：确认当前生效的判定条件）
const guardLine = readFileSync(ROUTER_SRC, "utf8")
  .split(/\r?\n/)
  .map((line, idx) => `${idx + 1}: ${line}`)
  .find((line) => line.includes("allowedRoles.length > 0"));
console.log(`守卫判定行 → ${guardLine}\n`);

await run("用例一 命中 meta.roles ⇒ 放行", async () => {
  const r = await pushWithRoles(["SUPER_ADMIN"], PROTECTED);
  assert.equal(r.path, PROTECTED, `落点应为 ${PROTECTED}，实际 ${r.path}`);
  assert.equal(r.warnCount, 0, `放行分支不应出现拒绝提示，实际 ${r.warnCount} 次`);
  return `落点=${r.path} 拒绝提示=${r.warnCount}`;
});

await run("用例二 有角色但不命中 ⇒ 拒绝并跳既有落点", async () => {
  const r = await pushWithRoles(["STORE_MANAGER"], PROTECTED);
  assert.notEqual(r.path, PROTECTED, `不得放行到 ${PROTECTED}`);
  assert.equal(r.path, DENY_FALLBACK, `应跳既有落点 ${DENY_FALLBACK}，实际 ${r.path}`);
  assert.ok(r.warnCount > 0, "拒绝分支必须给出提示");
  return `落点=${r.path} 拒绝提示=${r.warnCount}`;
});

await run("用例三 空角色 ⇒ 拒绝（fail-closed）", async () => {
  const r = await pushWithRoles([], PROTECTED);
  assert.notEqual(r.path, PROTECTED, `空角色不得放行到 ${PROTECTED}（旧写法会放行）`);
  assert.ok(r.warnCount > 0, "空角色拒绝分支必须给出提示");
  return `落点=${r.path} 拒绝提示=${r.warnCount} 导航中止=${Boolean(r.failure)}`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
