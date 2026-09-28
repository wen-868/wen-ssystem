/**
 * S3-132 断言用例 —— 落地页解析纯函数 + 真实守卫「回跳环已消除」
 *
 * 覆盖（对应派单卡验收标准① ② ③）：
 *   一、真值表（角色 × default_homepage 空/非空 × 路由可达性）：逐格断言 resolveLandingPath 结论；
 *       路由可达性用**真实路由表**（router.getRoutes()）判定，与守卫 meta.roles 同一语义；
 *   二、环已消除：从「被拒目标」出发导航，断言最终落点 ≠ 被拒目标，且不出现 vue-router 的
 *       "possibly infinite redirection" 告警、拒绝提示次数不为 30+（旧代码会循环 30 次后中止）。
 *
 * 运行（admin-web 目录）：npm test   （= node tests/role-guard.spec.mjs && node tests/landing.spec.mjs）
 *
 * 说明：与 tests/role-guard.spec.mjs 同一套 harness（Node 原生 TS 剥离 + 进程内模块钩子 + jsdom），
 *      不依赖 vitest / vite / esbuild；被测对象是真实 vue-router 路由实例 + 真实纯函数模块。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROUTER_SRC = path.join(here, "..", "src", "router", "index.ts");

// ── 捕获 vue-router 的告警（含 "possibly infinite redirection"）────────────────
const consoleWarnings = [];
const originalWarn = console.warn.bind(console);
console.warn = (...args) => {
  consoleWarnings.push(args.map((a) => String(a)).join(" "));
  originalWarn(...args);
};

// ── 拒绝提示桩（守卫只用到 ElMessage.warning）──────────────────────────────
const warnLog = [];
globalThis.__elMessageStub = {
  warning: (message) => {
    warnLog.push(message);
    return { close: () => undefined };
  },
};

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
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ".ts", context);
      }
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

const { createPinia, setActivePinia } = await import("pinia");
const { useAuthStore } = await import("../src/stores/auth.ts");
const { default: router } = await import("../src/router/index.ts");
const { resolveLandingPath, normalizePath, LOGIN_PATH } = await import("../src/router/landing.ts");

const ROUTES = router.getRoutes();

function futureToken() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `header.${Buffer.from(JSON.stringify({ exp })).toString("base64")}.signature`;
}

async function pushWithRoles(roles, target, extraUser = {}) {
  warnLog.length = 0;
  consoleWarnings.length = 0;
  setActivePinia(createPinia());
  await router.replace("/login");
  useAuthStore().setAuth(futureToken(), { roles, ...extraUser });

  let failure = null;
  try {
    await router.push(target);
  } catch (err) {
    failure = err;
  }
  const infinite = consoleWarnings.filter((line) => line.includes("infinite redirection"));
  return { path: router.currentRoute.value.path, warnCount: warnLog.length, failure, infinite };
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

// 守卫判定块（证据：确认拒绝分支当前生效的落地解析与护栏）
const guardBlock = readFileSync(ROUTER_SRC, "utf8")
  .split(/\r?\n/)
  .map((line, idx) => `${idx + 1}: ${line}`)
  .filter((line) => line.includes("resolveLandingPath(") || line.includes("allowedRoles.length > 0"))
  .join("\n  ");
console.log(`守卫判定/落地块 →\n  ${guardBlock}\n`);

// ── 一、真值表：角色 × default_homepage × 路由可达性 ────────────────────────
// 可达性列由**真实路由表**判定（router.getRoutes()），即守卫 meta.roles 的同一份数据。
const TRUTH_TABLE = [
  { roles: ["SUPER_ADMIN"], homepage: "", expected: "/dashboard", note: "无配置 → /dashboard 可访问" },
  { roles: ["SUPER_ADMIN"], homepage: "/quick-entries", expected: "/quick-entries", note: "配置存在且可访问" },
  { roles: ["SUPER_ADMIN"], homepage: "/dashboard", expected: "/dashboard", note: "配置存在且可访问" },
  { roles: ["SUPER_ADMIN"], homepage: "/no-such-page", expected: "/dashboard", note: "配置的路径不存在 → 跳过" },
  { roles: ["STORE_MANAGER"], homepage: "", expected: "/dashboard", note: "既有落点不变" },
  { roles: ["STORE_MANAGER"], homepage: "/quick-entries", expected: "/dashboard", note: "配置存在但角色不可访问 → 跳过" },
  { roles: ["STORE_MANAGER"], homepage: "/pos/dashboard", expected: "/pos/dashboard", note: "配置存在且可访问" },
  { roles: ["STORE_OPERATOR"], homepage: "", expected: "/pos/dashboard", note: "不可访问 /dashboard → POS 映射" },
  { roles: ["STORE_OPERATOR"], homepage: "/pos/cashier", expected: "/pos/cashier", note: "配置存在且可访问" },
  { roles: ["STORE_OPERATOR"], homepage: "/dashboard", expected: "/pos/dashboard", note: "配置存在但不可访问 → 跳过" },
  { roles: ["READONLY"], homepage: "", expected: LOGIN_PATH, note: "无可用页 → /login" },
  { roles: ["READONLY"], homepage: "/dashboard", expected: LOGIN_PATH, note: "配置存在但不可访问、无 POS 映射" },
  { roles: ["FINANCE_ADMIN"], homepage: "/products/review-tasks", expected: "/products/review-tasks", note: "配置存在且可访问" },
  { roles: ["FINANCE_ADMIN"], homepage: "", expected: LOGIN_PATH, note: "无可用页 → /login" },
  { roles: [], homepage: "", expected: LOGIN_PATH, note: "空角色 → /login（fail-closed）" },
  { roles: [], homepage: "/dashboard", expected: LOGIN_PATH, note: "空角色、配置不可访问 → /login" },
  { roles: ["STORE_MANAGER"], homepage: "/", expected: "/dashboard", note: "纯重定向路由 / 不作为落地（否则再跳一次 /dashboard）" },
  { roles: ["READONLY"], homepage: "/", expected: LOGIN_PATH, note: "纯重定向路由 + 无可用页 → /login" },
];

for (const row of TRUTH_TABLE) {
  const label = `真值表 [${row.roles.join("|") || "空角色"}] homepage=${row.homepage || "空"} ⇒ ${row.expected}`;
  await run(label, async () => {
    const actual = resolveLandingPath(row.roles, row.homepage, ROUTES);
    assert.equal(actual, row.expected, `${row.note}：期望 ${row.expected}，实际 ${actual}`);
    return `${row.note}；落点=${actual}`;
  });
}

// ── 二、环已消除：真实守卫导航（落点 ≠ 被拒目标、无 infinite redirection 告警）──
const LOOP_CASES = [
  { roles: [], target: "/dashboard", expected: LOGIN_PATH, note: "空角色的旧行为=循环 30 次后中止" },
  { roles: [], target: "/quick-entries", expected: LOGIN_PATH, note: "空角色被拒" },
  { roles: ["READONLY"], target: "/dashboard", expected: LOGIN_PATH, note: "READONLY 无 /dashboard 权限" },
  { roles: ["STORE_OPERATOR"], target: "/dashboard", expected: "/pos/dashboard", note: "POS 角色改落 /pos/dashboard" },
  { roles: ["STORE_OPERATOR"], target: "/quick-entries", expected: "/pos/dashboard", note: "POS 角色改落 /pos/dashboard" },
  { roles: ["STORE_MANAGER"], target: "/quick-entries", expected: "/dashboard", note: "既有拒绝落点不变" },
  { roles: ["SUPER_ADMIN"], target: "/quick-entries", expected: "/quick-entries", note: "命中即放行", allowed: true },
];

for (const item of LOOP_CASES) {
  const label = `环消除 [${item.roles.join("|") || "空角色"}] 被拒目标=${item.target} ⇒ ${item.expected}`;
  await run(label, async () => {
    const r = await pushWithRoles(item.roles, item.target);
    assert.equal(r.path, item.expected, `${item.note}：期望落点 ${item.expected}，实际 ${r.path}`);
    assert.equal(r.infinite.length, 0, `不得出现 infinite redirection 告警，实际 ${r.infinite.length} 条`);
    assert.equal(r.failure, null, `导航不得被中止，实际 ${r.failure && r.failure.message}`);
    if (item.allowed) {
      assert.equal(r.warnCount, 0, `命中放行不应出现拒绝提示，实际 ${r.warnCount} 次`);
    } else {
      assert.notEqual(r.path, item.target, `最终落点不得是被拒目标 ${item.target}`);
      assert.ok(r.warnCount >= 1, "拒绝分支必须给出提示");
      assert.ok(r.warnCount < 30, `拒绝提示不应出现循环（旧代码 32 次），实际 ${r.warnCount} 次`);
    }
    return `${item.note}；落点=${r.path} 拒绝提示=${r.warnCount} infinite 告警=${r.infinite.length}`;
  });
}

await run("默认首页（default_homepage）优先于既有兜底", async () => {
  const landing = resolveLandingPath(["STORE_OPERATOR"], "/pos/sale-bills", ROUTES);
  assert.equal(landing, "/pos/sale-bills", "配置的可用首页应优先");
  assert.equal(normalizePath("pos/sale-bills/?x=1#y"), "/pos/sale-bills", "归一化应去 query/hash 与尾斜杠");
  return `落点=${landing}`;
});

await run("守卫链路：配置的 default_homepage 生效（STORE_OPERATOR ⇒ /pos/sale-bills）", async () => {
  const r = await pushWithRoles(["STORE_OPERATOR"], "/dashboard", { defaultHomepage: "/pos/sale-bills" });
  assert.equal(r.path, "/pos/sale-bills", `应落配置首页，实际 ${r.path}`);
  assert.equal(r.infinite.length, 0);
  return `落点=${r.path} 拒绝提示=${r.warnCount} infinite 告警=${r.infinite.length}`;
});

await run("守卫链路：配置的 default_homepage 不可访问 ⇒ 回落 /pos/dashboard", async () => {
  const r = await pushWithRoles(["STORE_OPERATOR"], "/dashboard", { defaultHomepage: "/quick-entries" });
  assert.equal(r.path, "/pos/dashboard", `应跳过不可访问的配置，实际 ${r.path}`);
  assert.equal(r.infinite.length, 0);
  return `落点=${r.path} 拒绝提示=${r.warnCount} infinite 告警=${r.infinite.length}`;
});

// ── 三、登录落地链（LoginView 用的是同一函数）：登录后 push 的落点不得反弹回环 ──
async function loginChain(roles) {
  warnLog.length = 0;
  consoleWarnings.length = 0;
  setActivePinia(createPinia());
  await router.replace("/register");
  const auth = useAuthStore();
  auth.setAuth(futureToken(), { roles });
  const landing = resolveLandingPath(auth.userRoles, auth.user?.defaultHomepage, router.getRoutes());
  await router.push(landing);
  return {
    landing,
    path: router.currentRoute.value.path,
    warnCount: warnLog.length,
    infinite: consoleWarnings.filter((line) => line.includes("infinite redirection")).length,
    tokenCleared: useAuthStore().token === "",
  };
}

await run("登录落地链 [STORE_OPERATOR] ⇒ /pos/dashboard（1 跳、0 提示）", async () => {
  const r = await loginChain(["STORE_OPERATOR"]);
  assert.equal(r.landing, "/pos/dashboard");
  assert.equal(r.path, "/pos/dashboard");
  assert.equal(r.warnCount, 0, `不应出现拒绝提示，实际 ${r.warnCount} 次`);
  assert.equal(r.infinite, 0);
  return `落点=${r.path} 提示=${r.warnCount} infinite 告警=${r.infinite}`;
});

await run("登录落地链 [READONLY] ⇒ 停在 /login（清会话、不循环）", async () => {
  const r = await loginChain(["READONLY"]);
  assert.equal(r.landing, LOGIN_PATH, "无可用页角色落地应为 /login");
  assert.equal(r.path, LOGIN_PATH);
  assert.equal(r.infinite, 0, `不得出现 infinite redirection 告警，实际 ${r.infinite} 条`);
  assert.ok(r.warnCount < 30, `拒绝提示不应循环，实际 ${r.warnCount} 次`);
  assert.equal(r.tokenCleared, true, "无可用落地的用户应被清会话（裁定 R2）");
  return `落点=${r.path} 提示=${r.warnCount} infinite 告警=${r.infinite} 已清会话=${r.tokenCleared}`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n小结：${results.length - failed.length} passed / ${failed.length} failed`);
console.log(`infinite redirection 告警累计：${consoleWarnings.filter((l) => l.includes("infinite redirection")).length} 条`);
process.exitCode = failed.length === 0 ? 0 : 1;
