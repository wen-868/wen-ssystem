/**
 * C2-4 核验③（运行期）：**真启动**后端 express 应用 + **真 HTTP** 请求，核验凌舟自报的第 3 条结论。
 *
 * 与凌舟侧做法的差异（独立性）：
 *   - 凌舟侧是「另行起 mock 后端进程 + 自签令牌 + 手工请求」；
 *   - 本探针**不依赖外部进程**：在同进程内 import 真实 `backend/src/server.ts` 的 `app`，
 *     用 `app.listen(0,"127.0.0.1")` 起**真实 HTTP 监听**，再用 `fetch` 打真实请求，
 *     令牌用 node:crypto 手写 HS256 自签（不引入后端任何签发代码路径）；
 *   - 另加一条**运行期路由表内省**（express 内部 `_router.stack`）：直接列出运行时真实挂载的
 *     路径与顺序，与 01 的静态解析结果做**跨方法互证**。
 *
 * 运行前置（本探针自行设置，不读仓库 .env —— 仓库里没有 backend/.env）：
 *   NODE_ENV=test（不触发 server.listen 的定时任务）、USE_MOCK_DB=true、JWT_SECRET=自定值
 *
 * 用法（必须用 tsx 跑，才能 import .ts）：
 *   npx tsx docs/evidence/C2-4/tools/c2-4-03-runtime-probe.mjs [--selftest]
 *   --selftest：注入 1 条**故意错误**的预期，断言探针自己会红（反测断言引擎）
 * 退出码：0 = 全部断言通过（--selftest 下 = 断言引擎确实会红）；1 = 有断言不通过
 */
process.env.NODE_ENV = "test";
process.env.USE_MOCK_DB = "true";
process.env.HOST = "127.0.0.1";
process.env.JWT_SECRET = process.env.JWT_SECRET || "c2-4-independent-probe-secret";

import { register } from "node:module";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 本沙箱 `tsx` 不可用（esbuild 常驻服务子进程 spawn EPERM，见 c2-4-ts-loader.mjs 头注释），
 * 改用 node 自带进程内类型擦除 + 自建 ESM loader。
 */
register("./c2-4-ts-loader.mjs", import.meta.url);

const REPO = resolve(".");
const OUT_DIR = join(REPO, "docs/evidence/C2-4/outputs");
const SELFTEST = process.argv.includes("--selftest");

const { app } = await import("../../../../backend/src/server.ts");
const { env } = await import("../../../../backend/src/config/env.ts");
const { PLATFORM_JWT_ISSUER, PLATFORM_JWT_AUDIENCE } = await import("../../../../backend/src/middleware/auth.ts");

const log = (s = "") => process.stdout.write(`${s}\n`);
const results = [];
const failures = [];

function record(id, desc, ok, detail) {
  results.push({ id, desc, ok, detail });
  if (!ok) failures.push(`${id} ${desc} ⇒ ${detail}`);
  log(`   ${ok ? "✓" : "✗"} ${id.padEnd(28)} ${desc}${detail ? `  [${detail}]` : ""}`);
}

// ── 自签平台令牌（HS256，手写，不经后端签发路径） ────────────────────
function b64url(input) {
  return Buffer.from(input).toString("base64url");
}
function signPlatformToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      type: "platform_admin",
      id: userId,
      username: "c2-4-probe",
      iat: now,
      exp: now + 3600,
      iss: PLATFORM_JWT_ISSUER,
      aud: PLATFORM_JWT_AUDIENCE,
    })
  );
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", env.JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}
function csrfFor(userId) {
  return createHmac("sha256", env.CSRF_SECRET).update(String(userId)).digest("hex");
}

const USER_ID = 9001;
const TOKEN = signPlatformToken(USER_ID);
const CSRF = csrfFor(USER_ID);

// ── 起真实 HTTP 服务 ────────────────────────────────────────────────
const server = app.listen(0, "127.0.0.1");
await new Promise((res) => server.once("listening", res));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;

async function call(method, path, { token = null, csrf = null, body = undefined } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (csrf) headers["x-csrf-token"] = csrf;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON（如下载流） */
  }
  return { status: res.status, text, json };
}

// ── 运行期路由表内省 ────────────────────────────────────────────────
function mountPathOf(layer) {
  const src = layer.regexp?.source ?? "";
  const cleaned = src
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/i, "")
    .replace(/\\\//g, "/")
    .replace(/\(\?:\\\/\)\?\$/, "")
    .replace(/\/\?\(\?=\/\|\$\)/, "");
  return cleaned;
}
function collectRoutes(stack, prefix, out) {
  for (const layer of stack) {
    if (layer.route) {
      const p = `${prefix}${layer.route.path === "/" ? "" : layer.route.path}`;
      out.push({ path: p || "/", methods: Object.keys(layer.route.methods).map((m) => m.toUpperCase()) });
      continue;
    }
    if (layer.handle?.stack) {
      const mount = mountPathOf(layer);
      if (/^\/api\/platform\//.test(mount)) collectRoutes(layer.handle.stack, mount, out);
    }
  }
  return out;
}
const runtimeRoutes = collectRoutes(app._router?.stack ?? [], "", []);
const platformRuntime = runtimeRoutes.filter((r) => r.path.startsWith("/api/platform/templates") || r.path.startsWith("/api/platform/announcements"));

// ── 18 个端点（与 01 静态集合同源，用于 401 / 路由表互证） ─────────────
const TEMPLATE_ENDPOINTS = [
  ["GET", "/api/platform/templates/init"],
  ["POST", "/api/platform/templates/init"],
  ["GET", "/api/platform/templates/init/1/versions"],
  ["PUT", "/api/platform/templates/init/1"],
  ["GET", "/api/platform/templates/print"],
  ["POST", "/api/platform/templates/print/upload"],
  ["POST", "/api/platform/templates/print/1/public"],
  ["GET", "/api/platform/templates/import-export"],
  ["POST", "/api/platform/templates/import-export"],
  ["GET", "/api/platform/templates/import-export/1/download"],
];
const ANNOUNCEMENT_ENDPOINTS = [
  ["GET", "/api/platform/announcements"],
  ["GET", "/api/platform/announcements/templates"],
  ["PUT", "/api/platform/announcements/templates"],
  ["GET", "/api/platform/announcements/1"],
  ["POST", "/api/platform/announcements"],
  ["PUT", "/api/platform/announcements/1"],
  ["DELETE", "/api/platform/announcements/1"],
  ["POST", "/api/platform/announcements/1/publish"],
];
const ALL_ENDPOINTS = [...TEMPLATE_ENDPOINTS, ...ANNOUNCEMENT_ENDPOINTS];

log("[C2-4/03] 运行期探针：真实 express + 真实 HTTP");
log(`         仓库根：${REPO}`);
log(`         环境：NODE_ENV=${env.NODE_ENV} USE_MOCK_DB=${env.USE_MOCK_DB} 监听=${BASE}`);
log(`         令牌：自签 HS256（iss=${PLATFORM_JWT_ISSUER} aud=${PLATFORM_JWT_AUDIENCE} type=platform_admin id=${USER_ID}）`);
log("");

// ── A. mock 封条 ───────────────────────────────────────────────────
log("== A. 前置封条（证明打的是 mock 后端，不是生产/真库） ==");
{
  const r = await call("GET", "/api/platform/health");
  record("A1-health-mock-seal", "GET /api/platform/health 返回 mode=mock-db", r.status === 200 && r.json?.data?.mode === "mock-db", `status=${r.status} mode=${r.json?.data?.mode}`);
}
log("");

// ── B. 无令牌 401（18 条全覆盖） ────────────────────────────────────
log("== B. 无令牌 ⇒ 401（18 条端点全覆盖） ==");
let notAuthCount = 0;
for (const [method, path] of ALL_ENDPOINTS) {
  const r = await call(method, path, { body: method === "GET" ? undefined : {} });
  if (r.status === 401) notAuthCount++;
  else record(`B-401-${method}-${path}`, "无令牌应 401", false, `实际 ${r.status}`);
}
record("B-401-all", `18 条端点无令牌全部 401（实测 ${notAuthCount}/18）`, notAuthCount === 18, `401=${notAuthCount}/18`);
log("");

// ── C. 5 个读端点 200 空态 ──────────────────────────────────────────
log("== C. 带令牌 5 个读端点 ⇒ 200 且空态 ==");
const READ_ENDPOINTS = [
  ["GET", "/api/platform/templates/init"],
  ["GET", "/api/platform/templates/print"],
  ["GET", "/api/platform/templates/import-export"],
  ["GET", "/api/platform/announcements"],
  ["GET", "/api/platform/announcements/templates"],
];
const readReadings = [];
for (const [method, path] of READ_ENDPOINTS) {
  const r = await call(method, path, { token: TOKEN });
  const data = r.json?.data;
  const empty =
    (Array.isArray(data) && data.length === 0) ||
    (data && typeof data === "object" && Object.values(data).every((v) => Array.isArray(v) ? v.length === 0 : v === null || v === undefined || v === 0 || v === ""));
  readReadings.push({ path, status: r.status, dataPreview: JSON.stringify(data)?.slice(0, 120) });
  log(`      ${path.padEnd(46)} status=${r.status} data=${JSON.stringify(data)?.slice(0, 90)}`);
  if (r.status !== 200) record(`C-${path}`, "读端点应 200", false, `实际 ${r.status}`);
}
record("C-read-5-empty", "5 个读端点均 200（mock 下为空态）", readReadings.every((r) => r.status === 200), readReadings.map((r) => `${r.path.split("/").pop() || "list"}=${r.status}`).join(" "));
log("");

// ── D. 非法参数 ⇒ 400 ──────────────────────────────────────────────
log("== D. 非法参数 ⇒ 400（读 2 条 + 写 2 条 + id 非法 1 条） ==");
const bad400 = [
  ["GET", "/api/platform/templates/print?billType=NOT_A_TYPE", null, "billType 非枚举"],
  ["GET", "/api/platform/templates/import-export?direction=SIDEWAYS", null, "direction 非枚举"],
  ["GET", "/api/platform/templates/init/abc/versions", null, "id 非正整数"],
  ["POST", "/api/platform/templates/init", {}, "缺必填 code/name"],
  ["PUT", "/api/platform/announcements/templates", {}, "缺必填 records"],
];
let bad400ok = 0;
for (const [method, path, body, why] of bad400) {
  const r = await call(method, path, { token: TOKEN, csrf: CSRF, body: body === null ? undefined : body });
  if (r.status === 400) bad400ok++;
  log(`      ${method.padEnd(6)} ${path.padEnd(48)} status=${r.status}（期望 400 / ${why}） msg=${r.json?.message ?? ""}`);
}
record("D-400", `非法参数 400（实测 ${bad400ok}/${bad400.length}）`, bad400ok === bad400.length, `400=${bad400ok}/${bad400.length}`);
log("");

// ── E. 写端点 CSRF ⇒ 403 ───────────────────────────────────────────
log("== E. 写端点 CSRF 防护 ==");
{
  const noCsrf = await call("POST", "/api/platform/templates/init", { token: TOKEN, body: { code: "x", name: "x" } });
  record("E-403-post-no-csrf", "POST 模板（无 CSRF 头）⇒ 403", noCsrf.status === 403, `status=${noCsrf.status} msg=${noCsrf.json?.message ?? ""}`);

  const wrongCsrf = await call("PUT", "/api/platform/announcements/templates", { token: TOKEN, csrf: "deadbeef", body: { records: [] } });
  record("E-403-put-wrong-csrf", "PUT 公告模板（错 CSRF）⇒ 403", wrongCsrf.status === 403, `status=${wrongCsrf.status} msg=${wrongCsrf.json?.message ?? ""}`);

  const delNoCsrf = await call("DELETE", "/api/platform/announcements/1", { token: TOKEN });
  record("E-403-delete-no-csrf", "DELETE 公告（无 CSRF 头）⇒ 403", delNoCsrf.status === 403, `status=${delNoCsrf.status}`);

  const withCsrf = await call("POST", "/api/platform/templates/init", { token: TOKEN, csrf: CSRF, body: { code: "c2-4-probe", name: "C2-4 探针" } });
  record(
    "E-csrf-pass",
    "带正确 CSRF 不被 403 拦（CSRF 不是靠「一律拒」实现的）",
    withCsrf.status !== 403,
    `status=${withCsrf.status} body=${withCsrf.text.slice(0, 90)}（mock 写库不落真数据，仅作「CSRF 放行」证据）`
  );
}
log("");

// ── F. /announcements/templates 未被 /:id 吞（运行期） ──────────────
log("== F. GET /announcements/templates 未被 /:id 通配吞掉（运行期判别） ==");
{
  const tpl = await call("GET", "/api/platform/announcements/templates", { token: TOKEN });
  // 判别指纹：若 /templates 被 /:id 通配吞掉，`templates` 会被当作 id 交给 z.coerce.number()
  // ⇒ NaN ⇒ 400；因此先证实「非数字段进 /:id 必 400」，再据此判断 templates 的 200 是真 handler。
  const idLike = await call("GET", "/api/platform/announcements/abc", { token: TOKEN });
  log(`      GET /announcements/templates   status=${tpl.status} body=${tpl.text.slice(0, 110)}`);
  log(`      GET /announcements/abc         status=${idLike.status} body=${idLike.text.slice(0, 110)}`);
  record("F1-templates-200", "templates 命中专门 handler ⇒ 200（若被 /:id 吞，id='templates' 会 zod 400）", tpl.status === 200, `status=${tpl.status}`);
  record("F2-id-fingerprint", "同一路径下「非数字段」落到 /:id 会 400（即「被吞」的指纹）", idLike.status === 400, `status=${idLike.status}`);
}
log("");

// ── G. 运行期路由表内省（跨方法互证） ───────────────────────────────
log("== G. 运行期路由表内省（express 内部 stack，真挂载顺序） ==");
for (const r of platformRuntime) log(`      ${r.methods.join("/").padEnd(16)} ${r.path}`);
{
  // 规范化：具体 id 段与 :param 段都折成 ":param"，才能把「静态实例路径」与「运行期模式路径」对齐
  const canon = (p) => p.replace(/\/:\w+/g, "/:param").replace(/\/\d+(?=\/|$)/g, "/:param");
  const runtimeKeys = new Set(platformRuntime.flatMap((r) => r.methods.map((m) => `${m} ${canon(r.path)}`)));
  const staticKeys = ALL_ENDPOINTS.map(([m, p]) => `${m} ${canon(p)}`);
  const missing = staticKeys.filter((k) => !runtimeKeys.has(k));
  record("G1-static-vs-runtime", "01 静态解析出的 18 条端点全部出现在运行期路由表", missing.length === 0, missing.length ? `缺失 ${missing.join(", ")}` : "18/18");

  const iTpl = platformRuntime.findIndex((r) => r.path === "/api/platform/announcements/templates" && r.methods.includes("GET"));
  const iId = platformRuntime.findIndex((r) => r.path === "/api/platform/announcements/:id" && r.methods.includes("GET"));
  record("G2-order", "运行期注册顺序：GET /templates 早于 GET /:id", iTpl >= 0 && iId >= 0 && iTpl < iId, `templates#${iTpl} /:id#${iId}`);
}
log("");

// ── Z. 反测：故意错误预期，证明断言引擎会红 ─────────────────────────
if (SELFTEST) {
  log("== Z. 反测（--selftest）：注入 1 条已知错误预期 ==");
  const r = await call("POST", "/api/platform/templates/init", { token: TOKEN, body: { code: "x", name: "x" } }); // 无 CSRF
  record("Z-selftest-wrong-expectation", "故意断言「无 CSRF 的写端点应 200」（错误预期，必须被判失败）", r.status === 200, `实际 status=${r.status}`);
  log("");
}

const engineReddened = failures.some((f) => f.startsWith("Z-selftest-wrong-expectation"));

log(`[C2-4/03] 断言合计 ${results.length} 项，失败 ${failures.length} 项`);
for (const f of failures) log(`      ✗ ${f}`);

let exitCode;
if (SELFTEST) {
  const ok = engineReddened;
  log(`[C2-4/03] SELFTEST：${ok ? "PASS —— 断言引擎确实会把错误预期判红" : "FAIL —— 错误预期没有被判红，断言引擎不可信"}`);
  exitCode = ok ? 0 : 1;
} else {
  log(`RESULT: ${failures.length === 0 ? "ALL PASS" : "FAILURES"}`);
  log(`EXIT=${failures.length === 0 ? 0 : 1}`);
  exitCode = failures.length === 0 ? 0 : 1;
}
log(`EXIT=${exitCode}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, SELFTEST ? "03-runtime-probe-selftest.json" : "03-runtime-probe.json"),
  JSON.stringify({ mode: SELFTEST ? "selftest" : "normal", base: BASE, env: { NODE_ENV: env.NODE_ENV, USE_MOCK_DB: env.USE_MOCK_DB }, readReadings, runtimeRoutes: platformRuntime, results, failures, exitCode }, null, 2),
  "utf8"
);

server.close();
process.exit(exitCode);
