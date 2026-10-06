#!/usr/bin/env node
/**
 * S3-165 自检脚本 —— 「演示免密登录环境门控」的离线复核（纯 node 直跑，零子进程）
 *
 * 为什么需要它（本沙箱的既定边界，见 docs/踩坑日志.md[104]/[118]/[143]）：
 *   本沙箱禁止 node 的子进程能力（esbuild `spawn EPERM`）⇒ vitest / vite / tsx / playwright 一律起不来。
 *   S3-165 新增的 vitest 断言（生产被拒 / 非生产可用 / 既有幂等与自动恢复不回归）在本通道**无法真跑**，
 *   按项目规则必须同时交付一个「可直跑、不 spawn」的自检脚本，把「源码判据 ↔ 预期结果」复刻成断言。
 *
 * 本脚本做什么（只读，不改任何文件）：
 *   A. 从**源码**抽取 `isDemoLoginEnabled()` 的返回表达式并求值：production ⇒ false，development/test ⇒ true；
 *      ——把门控条件去掉（如 `return true;`）本组必 FAIL（这就是本脚本的反测钩子）。
 *   B. 编译产物交叉印证：直接 import `backend/dist/config/env.js`（query 破缓存）复算同一门控；
 *      缺 dist 时本组记 SKIP 并提示先构建。
 *   C. 单一口径扫描：backend/src 下 `NODE_ENV !== "production"` 只能出现在 config/env.ts 一处；
 *      controller 必须以 `!isDemoLoginEnabled()` 拦截并抛「演示登录在生产环境已禁用」+ 403。
 *   D. 移动端降级文案：login.vue 必须给出可操作出路，且旧死路文案 `演示通道不可用` 已清除。
 *
 * 用法（任意工作目录）：
 *   node backend/scripts/s3-165-demo-login-gate-selfcheck.mjs
 * 退出码：0 = 全部 PASS（SKIP 不影响退出码）；1 = 存在 FAIL。
 *
 * 真后端取证（本单已做，凌舟可复跑）：
 *   cd backend && tsc -p tsconfig.json && node ../scripts/fix-esm-extensions.js dist
 *   $env:NODE_ENV="production"; $env:USE_MOCK_DB="true"; $env:JWT_SECRET="x"; $env:PORT="18080"; node dist/server.js
 *   curl -s -o - -w "%{http_code}" -X POST http://127.0.0.1:18080/api/admin/auth/demo-login -H "Content-Type: application/json" -d "{}"
 *   ⇒ 期望 403 + {"code":"403","msg":"演示登录在生产环境已禁用",...}
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const backendSrc = path.join(repoRoot, "backend", "src");

const results = [];
function check(group, name, ok, detail) {
  results.push({ group, name, ok, detail });
  const tag = ok === null ? "SKIP" : ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${group} · ${name}${detail ? ` — ${detail}` : ""}`);
}

function readText(p) {
  return readFileSync(p, "utf8");
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__") continue;
      walk(full, out);
    } else if (/\.(ts|mts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// ─────────────────────────── A. 源码门控判据 ───────────────────────────
const envPath = path.join(backendSrc, "config", "env.ts");
const envSrc = readText(envPath);
const gateMatch = envSrc.match(
  /export function isDemoLoginEnabled\(\)\s*:\s*boolean\s*\{\s*return\s+([\s\S]*?);\s*\}/
);

if (!gateMatch) {
  check("A 源码门控", "isDemoLoginEnabled() 返回表达式可抽取", false, "未匹配到 export function isDemoLoginEnabled");
} else {
  const expr = gateMatch[1].trim();
  const evalGate = new Function("env", `return (${expr});`);
  const cases = [
    { nodeEnv: "production", expect: false },
    { nodeEnv: "development", expect: true },
    { nodeEnv: "test", expect: true },
  ];
  for (const c of cases) {
    const got = evalGate({ NODE_ENV: c.nodeEnv });
    check(
      "A 源码门控",
      `NODE_ENV=${c.nodeEnv} ⇒ ${c.expect}`,
      got === c.expect,
      `实际 ${got}（表达式：${expr}）`
    );
  }
}

// ─────────────────────────── B. 编译产物交叉印证 ───────────────────────────
const distEnvPath = path.join(repoRoot, "backend", "dist", "config", "env.js");
if (!existsSync(distEnvPath)) {
  check("B 编译产物", "dist/config/env.js 存在", null, "缺 dist，先跑 tsc + fix-esm-extensions");
} else {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedJwt = process.env.JWT_SECRET;
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "s3-165-selfcheck-secret";
  try {
    for (const [nodeEnv, expect] of [
      ["production", false],
      ["development", true],
    ]) {
      process.env.NODE_ENV = nodeEnv;
      const mod = await import(`${pathToFileURL(distEnvPath).href}?case=${nodeEnv}`);
      const got = mod.isDemoLoginEnabled();
      check("B 编译产物", `dist 下 NODE_ENV=${nodeEnv} ⇒ ${expect}`, got === expect, `实际 ${got}`);
    }
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (savedJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedJwt;
  }
}

// ─────────────────────────── C. 单一口径扫描 ───────────────────────────
// 已知例外（与本单无关、先于本单存在）：shared/logger.ts 的 pino transport 开关
// `process.env.NODE_ENV !== "production"`。它不门控 demo-login，白名单放行但必须写死在此处。
const PRE_EXISTING_NODE_ENV_SWITCHES = [path.join("backend", "src", "shared", "logger.ts")];
const hits = [];
for (const file of walk(backendSrc)) {
  const text = readText(file);
  const n = (text.match(/NODE_ENV !== "production"/g) || []).length;
  if (n > 0) hits.push({ file: path.relative(repoRoot, file), n });
}
const demoLoginHits = hits.filter((h) => !PRE_EXISTING_NODE_ENV_SWITCHES.includes(h.file));
check(
  "C 单一口径",
  "除 logger.ts 预存 pino 开关外，`NODE_ENV !== \"production\"` 只出现在 config/env.ts 一处",
  demoLoginHits.length === 1 &&
    demoLoginHits[0].file.endsWith(path.join("config", "env.ts")) &&
    demoLoginHits[0].n === 1,
  `demo-login 相关：${demoLoginHits.map((h) => `${h.file}×${h.n}`).join(", ") || "0 处"}；白名单：${PRE_EXISTING_NODE_ENV_SWITCHES.join(", ")}`
);
check(
  "C 单一口径",
  "isDemoLoginEnabled 定义处唯一（config/env.ts）",
  (() => {
    const defs = [];
    for (const file of walk(backendSrc)) {
      const n = (readText(file).match(/export function isDemoLoginEnabled/g) || []).length;
      if (n > 0) defs.push({ file: path.relative(repoRoot, file), n });
    }
    return defs.length === 1 && defs[0].file.endsWith(path.join("config", "env.ts")) && defs[0].n === 1;
  })()
);

const controllerPath = path.join(backendSrc, "controllers", "admin", "auth.controller.ts");
const controllerSrc = readText(controllerPath);
check(
  "C 单一口径",
  "controller 以 !isDemoLoginEnabled() 拦截",
  controllerSrc.includes("if (!isDemoLoginEnabled())")
);
check(
  "C 单一口径",
  "controller 抛「演示登录在生产环境已禁用」+ 403",
  controllerSrc.includes('throw new AppError("演示登录在生产环境已禁用", 403)')
);
const serverSrc = readText(path.join(backendSrc, "server.ts"));
check(
  "C 单一口径",
  "server.ts 仍注册 POST /api/admin/auth/demo-login",
  serverSrc.includes('app.post("/api/admin/auth/demo-login", authController.demoLogin)')
);

// ─────────────────────────── D. 移动端降级文案 ───────────────────────────
const loginVuePath = path.join(repoRoot, "app-mobile", "src", "pages", "login", "login.vue");
const loginVue = readText(loginVuePath);
check(
  "D 移动端文案",
  "降级失败给出可操作出路「演示通道已停用，请用演示账号登录」",
  loginVue.includes("演示通道已停用，请用演示账号登录")
);
check(
  "D 移动端文案",
  "旧死路文案「演示通道不可用」已清除",
  !loginVue.includes("'演示通道不可用，请稍后重试'")
);

// ─────────────────────────── 汇总 ───────────────────────────
const failed = results.filter((r) => r.ok === false);
const skipped = results.filter((r) => r.ok === null);
console.log(
  `\nS3-165 自检汇总：PASS ${results.length - failed.length - skipped.length} / FAIL ${failed.length} / SKIP ${skipped.length}`
);
process.exit(failed.length > 0 ? 1 : 0);
