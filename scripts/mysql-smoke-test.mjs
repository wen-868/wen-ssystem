#!/usr/bin/env node
/**
 * 智享全链管理系统 —— MySQL / API 冒烟测试（S3-118 拆档）
 *
 * 档位（默认只读）：
 *   --readonly  只读档（默认）：数据库层 + 只读 API。全程不含任何写请求
 *               （登录 POST 属只读语义，保留）。
 *   --write     写入档：只读档全部检查 + 小程序下单 + 开销售单 + 库存调整。
 *
 * 🔴 写入档禁止对生产执行：只允许对测试库 / 临时实例运行，部署脚本只调用只读档。
 *    写入档需显式确认，否则在发出任何请求前以退出码 2 结束：
 *      SMOKE_ALLOW_WRITE=1 npm run test:mysql:write
 *    或：npm run test:mysql:write -- --i-know-this-writes
 *
 * 凭据（必须由环境显式提供，缺一即失败；绝不回落默认账号/默认口令）：
 *   SMOKE_ADMIN_USERNAME / SMOKE_ADMIN_PASSWORD
 *
 * 退出码：0 = 全部通过；1 = 存在失败项（含凭据缺失）；2 = 用法/安全确认错误。
 */

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

// ---- 档位解析 ----
const args = process.argv.slice(2);
const KNOWN_ARGS = ["--readonly", "--write", "--i-know-this-writes"];
const unknownArgs = args.filter((arg) => !KNOWN_ARGS.includes(arg));
if (unknownArgs.length > 0) {
  console.error(`未知参数：${unknownArgs.join(" ")}`);
  console.error("用法：node scripts/mysql-smoke-test.mjs [--readonly|--write] [--i-know-this-writes]");
  process.exit(2);
}
if (args.includes("--readonly") && args.includes("--write")) {
  console.error("--readonly 与 --write 不能同时使用");
  process.exit(2);
}
const MODE = args.includes("--write") ? "write" : "readonly";
// 写入档必须显式确认（避免误对生产库下单/开单/改库存）
const WRITE_CONFIRMED = args.includes("--i-know-this-writes") || process.env.SMOKE_ALLOW_WRITE === "1";
const MODE_LABEL = MODE === "write" ? "写入档 --write" : "只读档 --readonly";

// 冒烟登录账号：必须由部署环境显式提供（生产为专用只读账号），
// 禁止在脚本里写默认账号/默认口令。
const ADMIN_USERNAME = process.env.SMOKE_ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "";
const CREDENTIAL_MISSING_HINT = "未配置 SMOKE_ADMIN_USERNAME/SMOKE_ADMIN_PASSWORD，冒烟无法执行";

// 无凭据（或未取到 token）时无法执行的检查项：如实列出，不计为通过
const CHECKS_NEEDING_CREDENTIALS = [
  "工作台商品列表",
  "工作台看板",
  "小程序商品列表",
  "门店工作台",
  "后台支付记录",
  "后台库存总览",
  "后台库存流水",
  "后台库存预警",
  "门店支付记录",
  "门店库存流水",
  "门店库存预警"
];

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

function skip(name, reason) {
  console.log(`  ⏭  ${name}（未执行：${reason}）`);
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

// 写入档专属检查项名称（只读档不执行；缺凭据/登录失败时如实列为未执行）
const WRITE_CHECK_NAMES = ["小程序下单", "门店创建销售单", "门店库存调整"];

async function apiChecks() {
  console.log(`\n[B] API 层（${MODE === "write" ? "写入档：含写请求，仅限测试库/临时实例" : "只读档：无任何写请求"}）`);

  const health = await request("/health");
  check("健康检查 /health", health.status === 200 && health.body?.code === "0");

  // 缺少冒烟凭据：明确失败并计入失败项，不静默跳过、不回落默认口令
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.log(`  🔴 ${CREDENTIAL_MISSING_HINT}`);
    console.log("     → 请在部署环境 backend/.env 显式设置 SMOKE_ADMIN_USERNAME / SMOKE_ADMIN_PASSWORD（凭据不入仓库）。");
    check("工作台登录", false, CREDENTIAL_MISSING_HINT);
    for (const name of CHECKS_NEEDING_CREDENTIALS) {
      skip(name, "无冒烟凭据");
    }
    if (MODE === "write") {
      for (const name of WRITE_CHECK_NAMES) {
        skip(name, "无冒烟凭据");
      }
    }
    return;
  }

  const login = await request("/api/admin/auth/login", {
    method: "POST",
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }
  });
  const token = login.body?.data?.token;
  check("工作台登录", login.status === 200 && login.body?.code === "0" && Boolean(token),
    `status=${login.status}, code=${login.body?.code}`);
  // 写操作需携带 x-csrf-token（auto-routes csrfMiddleware 契约）
  const csrfToken = login.body?.data?.csrfToken;
  const auth = token
    ? { Authorization: `Bearer ${token}`, ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) }
    : {};

  // 登录失败时后续检查必然 401（级联噪声），如实标注未执行，不冒充通过
  if (!token) {
    for (const name of CHECKS_NEEDING_CREDENTIALS) {
      skip(name, "登录未取到 token");
    }
    if (MODE === "write") {
      for (const name of WRITE_CHECK_NAMES) {
        skip(name, "登录未取到 token");
      }
    }
    return;
  }

  // ---- 以下为只读检查（只读档 / 写入档共用，全部为 GET 或登录 POST）----
  const products = await request("/api/admin/products", { headers: auth });
  check("工作台商品列表", products.body?.code === "0" && Array.isArray(products.body?.data?.records));

  const dashboard = await request("/api/admin/dashboard", { headers: auth });
  check("工作台看板", dashboard.body?.code === "0" && dashboard.body?.data);

  const miniProducts = await request("/api/miniapp/products?storeId=1", { headers: auth });
  check("小程序商品列表", miniProducts.body?.code === "0" && Array.isArray(miniProducts.body?.data?.records));

  const storeDashboard = await request("/api/store/dashboard?storeId=1", { headers: auth });
  check("门店工作台", storeDashboard.body?.code === "0" && storeDashboard.body?.data);

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

  if (MODE === "write") {
    await writeChecks(auth);
  }
}

/**
 * 写入档专属检查：🔴 会产生真实单据与库存变动，禁止对生产执行。
 * 仅当 MODE === "write"（且已显式确认）时才会被调用。
 */
async function writeChecks(auth) {
  console.log("\n[C] 写入档检查（🔴 会产生真实单据/库存变动，禁止对生产执行）");

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

  const adjust = await request("/api/store/inventory/adjust", {
    method: "POST",
    headers: auth,
    body: { storeId: 1, skuId: 1, stockType: "OFFLINE", change: -1, remark: "MySQL冒烟测试" }
  });
  check("门店库存调整", adjust.body?.code === "0");
}

console.log("智享全链管理系统 MySQL 冒烟测试");
console.log(`档位：${MODE_LABEL}${MODE === "write" ? "（🔴 仅限测试库/临时实例）" : "（默认，不含任何写请求）"}`);
console.log(`数据库：${DB.host}:${DB.port}/${DB.database}`);
console.log(`API：${API_BASE}`);

if (MODE === "write" && !WRITE_CONFIRMED) {
  console.error("🔴 写入档会向目标环境创建真实订单/销售单并调整库存，禁止对生产执行。");
  console.error("   确认目标为测试库或临时实例后，用下列方式之一显式确认：");
  console.error("     SMOKE_ALLOW_WRITE=1 npm run test:mysql:write");
  console.error("     npm run test:mysql:write -- --i-know-this-writes");
  process.exit(2);
}

await databaseChecks();
await apiChecks();

console.log(`\n测试结果：✅ ${passed} 通过 / ❌ ${failed} 失败 / 共 ${passed + failed} 项`);
if (failed > 0) {
  console.log(`❌ [冒烟] ${MODE_LABEL}失败：${failed} 项未通过`);
  process.exit(1);
}
console.log(`✅ [冒烟] ${MODE_LABEL}全部通过：${passed} 项`);
