#!/usr/bin/env node
/**
 * 全域名自动化验收脚本
 * 运行环境：服务器本地（可直接访问 127.0.0.1:8080）
 * 覆盖：api / admin / m / www / saas 5 个域名
 *
 * S3-205（收口总清单第 23 项）：**面向生产却内置默认凭据 / 默认地址** ⇒ 一律改为 env 注入。
 * 必需项缺任何一项即打印缺项清单并 **exit 1**，不再回落到任何内置默认值。
 * 必需项（env 名沿用同族脚本 scripts/acceptance-production.mjs 的既有约定）：
 *   API_BASE（例 https://api.onepan.cn/api）／ ADMIN_URL ／ SAAS_URL ／ M_URL ／ WWW_URL
 *   ADMIN_USERNAME ／ ADMIN_PASSWORD（旧名 DEMO_PASSWORD 亦可，二者等价、ADMIN_PASSWORD 优先）
 */

const REQUIRED_ENV = [
  ["API_BASE"],
  ["ADMIN_URL"],
  ["SAAS_URL"],
  ["M_URL"],
  ["WWW_URL"],
  ["ADMIN_USERNAME"],
  ["ADMIN_PASSWORD", "DEMO_PASSWORD"],
];

const missingEnv = REQUIRED_ENV
  .filter((names) => !names.some((n) => (process.env[n] ?? "").trim() !== ""))
  .map((names) => names.join(" | "));
if (missingEnv.length > 0) {
  console.error(
    `[验收·全域名] 缺少必需环境变量 ${missingEnv.length} 项：${missingEnv.join(" / ")} ⇒ 不回落内置默认值，退出`
  );
  process.exit(1);
}

const API_BASE = process.env.API_BASE;
const ADMIN_URL = process.env.ADMIN_URL;
const SAAS_URL = process.env.SAAS_URL;
const M_URL = process.env.M_URL;
const WWW_URL = process.env.WWW_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
// S3-205：旧名 DEMO_PASSWORD 仍受支持（脚本既有约定）；两者都未设置时已在上面 exit 1。
const ADMIN_PASSWORD =
  (process.env.ADMIN_PASSWORD ?? "").trim() !== "" ? process.env.ADMIN_PASSWORD : process.env.DEMO_PASSWORD;

/** /health 在 /api 前缀之外（与 acceptance-production.mjs 同一口径） */
const HEALTH_URL = `${API_BASE.replace(/\/api$/, "")}/health`;

/** HTTP→HTTPS 重定向检查用的同址 http:// 形态（由 env 地址推导，不写死域名） */
function toHttp(url) {
  const u = new URL(url);
  u.protocol = "http:";
  return u.toString();
}

const results = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS", detail: "" });
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    results.push({ name, status: "FAIL", detail: err.message });
    failed++;
    console.log(`  [FAIL] ${name} — ${err.message}`);
  }
}

async function mustFetch(url, expectStatus = 200) {
  const res = await fetch(url, { redirect: "manual" });
  if (res.status !== expectStatus && res.status !== 301 && res.status !== 308) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function apiCall(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok || body.code === "500") {
    throw new Error(`${res.status} ${body.message || ""}`);
  }
  return body;
}

// ===================== 阶段 1：连通性检查 =====================
console.log("\n========== 阶段 1：域名连通性检查 ==========");

await test("api /health 可访问", async () => {
  const text = await fetchText(HEALTH_URL);
  if (!text.includes("ok") && !text.includes("OK")) throw new Error("健康检查未返回 ok");
});

await test("admin 首页可访问", async () => {
  const html = await fetchText(ADMIN_URL);
  if (!html.includes("<html") && !html.includes("<!DOCTYPE")) throw new Error("返回非 HTML");
  if (html.includes("localhost:8080")) throw new Error("HTML 包含 localhost");
});

await test("m 首页可访问", async () => {
  const html = await fetchText(M_URL);
  if (!html.includes("<html")) throw new Error("返回非 HTML");
});

await test("www 首页可访问", async () => {
  const html = await fetchText(WWW_URL);
  if (!html.includes("<html")) throw new Error("返回非 HTML");
});

await test("saas 首页可访问", async () => {
  const html = await fetchText(SAAS_URL);
  if (!html.includes("<html")) throw new Error("返回非 HTML");
});

// ===================== 阶段 2：HTTP→HTTPS 重定向 =====================
console.log("\n========== 阶段 2：HTTP 重定向检查 ==========");

await test("api HTTP→HTTPS 重定向", async () => {
  const res = await fetch(toHttp(HEALTH_URL), { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

await test("admin HTTP→HTTPS 重定向", async () => {
  const res = await fetch(toHttp(ADMIN_URL), { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

await test("m HTTP→HTTPS 重定向", async () => {
  const res = await fetch(toHttp(M_URL), { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

await test("www HTTP→HTTPS 重定向", async () => {
  const res = await fetch(toHttp(WWW_URL), { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

await test("saas HTTP→HTTPS 重定向", async () => {
  const res = await fetch(toHttp(SAAS_URL), { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

// ===================== 阶段 3：API 核心接口 =====================
console.log("\n========== 阶段 3：API 核心接口检查 ==========");

await test("admin 登录接口正常", async () => {
  const body = await apiCall("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
  });
  if (!body.data?.token) throw new Error("未返回 token");
});

await test("admin 商品列表接口正常", async () => {
  const login = await apiCall("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
  });
  const auth = { Authorization: `Bearer ${login.data.token}` };
  const body = await apiCall("/admin/products", { headers: auth });
  if (!Array.isArray(body.data?.records)) throw new Error("商品列表格式异常");
});

await test("平台登录接口正常", async () => {
  const body = await apiCall("/platform/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
  });
  if (!body.data?.token) throw new Error("未返回 token");
});

await test("CSRF token 接口正常", async () => {
  const res = await fetch(`${API_BASE}/csrf-token`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body.data?.token) throw new Error("未返回 CSRF token");
});

// ===================== 阶段 4：静态资源检查 =====================
console.log("\n========== 阶段 4：静态资源检查 ==========");

await test("admin HTML 不含 localhost API 地址", async () => {
  const html = await fetchText(ADMIN_URL);
  if (html.includes("localhost:8080")) throw new Error("包含 localhost:8080");
});

await test("saas HTML 不含 localhost API 地址", async () => {
  const html = await fetchText(SAAS_URL);
  if (html.includes("localhost:8080")) throw new Error("包含 localhost:8080");
});

await test("m HTML 不含 localhost API 地址", async () => {
  const html = await fetchText(M_URL);
  if (html.includes("localhost:8080")) throw new Error("包含 localhost:8080");
});

// ===================== 阶段 5：CORS / API 跨域 =====================
console.log("\n========== 阶段 5：CORS 预检检查 ==========");

await test("admin 前端可访问 API", async () => {
  const res = await fetch(`${API_BASE}/admin/products`, {
    method: "OPTIONS",
    headers: {
      "Origin": new URL(ADMIN_URL).origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization,content-type"
    }
  });
  if (!res.ok && res.status !== 204) throw new Error(`CORS 预检失败: ${res.status}`);
});

await test("saas 前端可访问 API", async () => {
  const res = await fetch(`${API_BASE}/platform/dashboard/overview`, {
    method: "OPTIONS",
    headers: {
      "Origin": new URL(SAAS_URL).origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization,content-type"
    }
  });
  if (!res.ok && res.status !== 204) throw new Error(`CORS 预检失败: ${res.status}`);
});

// ===================== 汇总 =====================
console.log("\n========== 验收结果汇总 ==========");
console.log(`通过: ${passed} / 总计: ${passed + failed}`);

if (failed > 0) {
  console.log("\n失败的测试项:");
  results.filter(r => r.status === "FAIL").forEach(r => {
    console.log(`  - ${r.name}: ${r.detail}`);
  });
  process.exit(1);
} else {
  console.log("\nACCEPTANCE_ALL_DOMAINS_PASS");
  process.exit(0);
}
