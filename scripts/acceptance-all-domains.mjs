#!/usr/bin/env node
/**
 * 全域名自动化验收脚本
 * 运行环境：服务器本地（可直接访问 127.0.0.1:8080）
 * 覆盖：api / admin / m / www / saas 5 个域名
 */

const API_BASE = "https://api.onepan.cn/api";
const ADMIN_URL = "https://admin.onepan.cn";
const SAAS_URL = "https://saas.onepan.cn";
const M_URL = "https://m.onepan.cn";
const WWW_URL = "https://www.onepan.cn";

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

await test("api.onepan.cn /health", async () => {
  const text = await fetchText("https://api.onepan.cn/health");
  if (!text.includes("ok") && !text.includes("OK")) throw new Error("健康检查未返回 ok");
});

await test("admin.onepan.cn 首页可访问", async () => {
  const html = await fetchText(ADMIN_URL);
  if (!html.includes("<html") && !html.includes("<!DOCTYPE")) throw new Error("返回非 HTML");
  if (html.includes("localhost:8080")) throw new Error("HTML 包含 localhost");
});

await test("m.onepan.cn 首页可访问", async () => {
  const html = await fetchText(M_URL);
  if (!html.includes("<html")) throw new Error("返回非 HTML");
});

await test("www.onepan.cn 首页可访问", async () => {
  const html = await fetchText(WWW_URL);
  if (!html.includes("<html")) throw new Error("返回非 HTML");
});

await test("saas.onepan.cn 首页可访问", async () => {
  const html = await fetchText(SAAS_URL);
  if (!html.includes("<html")) throw new Error("返回非 HTML");
});

// ===================== 阶段 2：HTTP→HTTPS 重定向 =====================
console.log("\n========== 阶段 2：HTTP 重定向检查 ==========");

await test("api HTTP→HTTPS 重定向", async () => {
  const res = await fetch("http://api.onepan.cn/health", { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

await test("admin HTTP→HTTPS 重定向", async () => {
  const res = await fetch("http://admin.onepan.cn/", { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

await test("m HTTP→HTTPS 重定向", async () => {
  const res = await fetch("http://m.onepan.cn/", { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

await test("www HTTP→HTTPS 重定向", async () => {
  const res = await fetch("http://www.onepan.cn/", { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

await test("saas HTTP→HTTPS 重定向", async () => {
  const res = await fetch("http://saas.onepan.cn/", { redirect: "manual" });
  if (res.status !== 301 && res.status !== 308 && res.status !== 307) {
    throw new Error(`未重定向，状态码 ${res.status}`);
  }
});

// ===================== 阶段 3：API 核心接口 =====================
console.log("\n========== 阶段 3：API 核心接口检查 ==========");

await test("admin 登录接口正常", async () => {
  const body = await apiCall("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });
  if (!body.data?.token) throw new Error("未返回 token");
});

await test("admin 商品列表接口正常", async () => {
  const login = await apiCall("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });
  const auth = { Authorization: `Bearer ${login.data.token}` };
  const body = await apiCall("/admin/products", { headers: auth });
  if (!Array.isArray(body.data?.records)) throw new Error("商品列表格式异常");
});

await test("平台登录接口正常", async () => {
  const body = await apiCall("/platform/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "admin123" })
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
      "Origin": "https://admin.onepan.cn",
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
      "Origin": "https://saas.onepan.cn",
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
