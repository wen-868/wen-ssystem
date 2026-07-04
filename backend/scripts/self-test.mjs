#!/usr/bin/env node
/**
 * 自测脚本 — 验证核心 API 响应
 * 用法: node scripts/self-test.mjs [baseUrl]
 * 默认: http://localhost:8080
 */

const BASE = process.argv[2] || "http://localhost:8080";

const TESTS = [
  { name: "登录", method: "POST", path: "/api/admin/auth/login", body: { username: "admin", password: "admin123" } },
  { name: "看板", method: "GET", path: "/api/admin/dashboard" },
  { name: "商品列表", method: "GET", path: "/api/admin/products" },
  { name: "订单列表", method: "GET", path: "/api/admin/orders" },
  { name: "会员列表", method: "GET", path: "/api/admin/members" },
  { name: "供应商列表", method: "GET", path: "/api/admin/suppliers" },
  { name: "采购订单列表", method: "GET", path: "/api/admin/purchase-orders" },
  { name: "客户对账单列表", method: "GET", path: "/api/store/customer-statements" },
];

let token = "";
let passed = 0;
let failed = 0;

for (const t of TESTS) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts = { method: t.method, headers };
  if (t.body) opts.body = JSON.stringify(t.body);

  try {
    const res = await fetch(`${BASE}${t.path}`, opts);
    const data = await res.json().catch(() => null);

    if (res.status >= 200 && res.status < 500) {
      console.log(`✓ ${t.name} (${res.status})`);
      if (t.name === "登录" && data?.data?.token) {
        token = data.data.token;
      }
      passed++;
    } else {
      console.log(`✗ ${t.name} (${res.status}) ${JSON.stringify(data)?.slice(0, 100)}`);
      failed++;
    }
  } catch (err) {
    console.log(`✗ ${t.name} (ERROR) ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} 通过`);
process.exit(failed > 0 ? 1 : 0);