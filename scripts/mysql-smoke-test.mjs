#!/usr/bin/env node

import http from "node:http";
import mysql from "mysql2/promise";

const DB = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "zhixiang_app",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "liquor_inventory"
};

const API_BASE = process.env.API_BASE || "http://localhost:8080";
// 冒烟测试登录账号（生产密码若被修改，用 SMOKE_ADMIN_PASSWORD 环境变量覆盖）
const ADMIN_USERNAME = process.env.SMOKE_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "admin123";

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const body = options.body ? JSON.stringify(options.body) : null;
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: options.method || "GET",
      timeout: 8000,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {})
      }
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function databaseChecks() {
  console.log("\n[A] MySQL 数据库层");
  const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 4 });
  try {
    await pool.query("SELECT 1");
    check("数据库连接成功", true);

    const tables = [
      "t_sys_user", "t_store", "t_product_spu", "t_product_sku", "t_product_price",
      "t_inventory_balance", "t_miniapp_order", "t_sale_bill", "t_collection_link",
      "t_payment_order", "t_hold_order", "t_refund_order"
    ];
    for (const table of tables) {
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
        [DB.database, table]
      );
      check(`表存在：${table}`, Number(rows[0]?.count ?? 0) === 1);
    }

    const countChecks = [
      ["默认账号 >= 1", "SELECT COUNT(*) AS count FROM t_sys_user"],
      ["默认门店 >= 1", "SELECT COUNT(*) AS count FROM t_store"],
      ["默认商品 >= 1", "SELECT COUNT(*) AS count FROM t_product_sku"],
      ["默认库存 >= 1", "SELECT COUNT(*) AS count FROM t_inventory_balance"]
    ];
    for (const [name, sql] of countChecks) {
      const [rows] = await pool.query(sql);
      check(name, Number(rows[0]?.count ?? 0) >= 1);
    }
  } catch (error) {
    check("数据库层检查", false, error.message);
  } finally {
    await pool.end();
  }
}

async function apiChecks() {
  console.log("\n[B] API 层");

  const health = await request("/health");
  check("健康检查 /health", health.status === 200 && health.body?.code === "0");

  const login = await request("/api/admin/auth/login", {
    method: "POST",
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  const token = login.body?.data?.token;
  check("工作台登录", login.status === 200 && login.body?.code === "0" && Boolean(token));
  // 写操作需携带 x-csrf-token（auto-routes csrfMiddleware 契约）
  const csrfToken = login.body?.data?.csrfToken;
  const auth = token
    ? { Authorization: `Bearer ${token}`, ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) }
    : {};

  const products = await request("/api/admin/products", { headers: auth });
  check("工作台商品列表", products.body?.code === "0" && Array.isArray(products.body?.data?.records));

  const dashboard = await request("/api/admin/dashboard", { headers: auth });
  check("工作台看板", dashboard.body?.code === "0" && dashboard.body?.data);

  const miniProducts = await request("/api/miniapp/products?storeId=1", { headers: auth });
  check("小程序商品列表", miniProducts.body?.code === "0" && Array.isArray(miniProducts.body?.data?.records));

  const miniOrder = await request("/api/miniapp/orders", {
    method: "POST",
    headers: { ...auth, "x-customer-type": "RETAIL" },
    body: {
      storeId: 1,
      fulfillmentType: "PICKUP",
      receiverName: "冒烟测试",
      receiverMobile: "13900002222",
      items: [{ skuId: 1, quantity: 1 }]
    }
  });
  const orderNo = miniOrder.body?.data?.orderNo;
  check("小程序下单", miniOrder.body?.code === "0" && Boolean(orderNo));

  const storeDashboard = await request("/api/store/dashboard?storeId=1", { headers: auth });
  check("门店工作台", storeDashboard.body?.code === "0" && storeDashboard.body?.data);

  const saleBill = await request("/api/store/sale-bills", {
    method: "POST",
    headers: auth,
    body: {
      storeId: 1,
      customerName: "冒烟客户",
      items: [{ skuId: 1, boxQty: 0, bottleQty: 1, totalBottleQty: 1 }]
    }
  });
  check("门店创建销售单", saleBill.body?.code === "0" && Boolean(saleBill.body?.data?.billNo));

  const extraGetChecks = [
    ["后台支付记录", "/api/admin/payment-orders"],
    ["后台库存总览", "/api/admin/inventory-balance"],
    ["后台库存流水", "/api/admin/inventory-logs"],
    ["后台库存预警", "/api/admin/inventory-alerts"],
    ["门店支付记录", "/api/store/payment-orders?storeId=1"],
    ["门店库存流水", "/api/store/inventory/logs?storeId=1"],
    ["门店库存预警", "/api/store/inventory/alerts?storeId=1"]
  ];
  for (const [name, path] of extraGetChecks) {
    const res = await request(path, { headers: auth });
    check(name, res.body?.code === "0", `status=${res.status}, body=${JSON.stringify(res.body).slice(0, 120)}`);
  }

  const adjust = await request("/api/store/inventory/adjust", {
    method: "POST",
    headers: auth,
    body: { storeId: 1, skuId: 1, stockType: "OFFLINE", change: -1, remark: "MySQL冒烟测试" }
  });
  check("门店库存调整", adjust.body?.code === "0");
}

console.log("智享全链管理系统 MySQL 冒烟测试");
console.log(`数据库：${DB.host}:${DB.port}/${DB.database}`);
console.log(`API：${API_BASE}`);

await databaseChecks();
await apiChecks();

console.log(`\n测试结果：✅ ${passed} 通过 / ❌ ${failed} 失败 / 共 ${passed + failed} 项`);
if (failed > 0) process.exit(1);
