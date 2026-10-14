/**
 * S3-206 真库端到端装置（本机 MySQL 8 @127.0.0.1:3408）
 *
 * 做什么：
 *   [0] 重建本单专用库 s3206_main（**只动 s3206_ 前缀库**）
 *   [1] 起真实后端（backend/dist/server.js，启动期跑迁移 + 种子）并等 /health 200
 *   [2] 夹具：对齐 admin 口令哈希（取自 constants.ts，不写字面口令）；
 *       造 A 租户（default）与 B 租户（s3206t2）**同 SKU/同客户/同门店/同操作员**的销售单，
 *       含 DRAFT/VOIDED 反例 —— 于是"跨租户聚合"必然把 B 的数字并进 A 的分组。
 *   [3] 真 HTTP 调被测接口（登录 → sales-ranking 四维度 → profit 探针）
 *   [4] 交叉核对：接口读数 vs SQL 直查（A 单独 / B 单独 / A+B 合并），并断言"B 不该出现"
 *
 * 产物：raw/*.json、raw/server.log、raw/99-summary.json（逐项 PASS/FAIL）
 * 运行：node docs/evidence/S3-206/harness.mjs（前置：backend 已 npm run build）
 */
import { spawn } from "node:child_process";
import { createWriteStream, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import path from "node:path";
import mysql from "mysql2/promise";

const REPO = path.resolve("D:/Users/ZXQL/wt-agents/S3-206");
const RAW = path.join(REPO, "docs", "evidence", "S3-206", "raw");
const DB_HOST = process.env.HARNESS_DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.HARNESS_DB_PORT || 3408);
const DB_USER = process.env.HARNESS_DB_USER || "root";
const DB_PASSWORD = process.env.HARNESS_DB_PASSWORD || "";
const DB_NAME = "s3206_main";
const A_TENANT = "default";
const B_TENANT = "s3206t2";
const PORT = Number(process.env.HARNESS_API_PORT || 8206);
const API = `http://127.0.0.1:${PORT}/api`;
const DATE_START = "2026-08-01";
const DATE_END = "2026-10-31";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const results = [];
let failures = 0;
function check(name, ok, detail, soft = false) {
  results.push({ name, ok, soft, detail });
  if (!ok && !soft) failures++;
  console.log(`${ok ? "PASS" : soft ? "OBSERVE-FAIL" : "FAIL"}  ${name}${detail === undefined ? "" : `  :: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
function saveRaw(file, data) {
  writeFileSync(path.join(RAW, file), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}

// ─────────────────────────── [0] 建库 ───────────────────────────
mkdirSync(RAW, { recursive: true });
if (!/^s3206_/.test(DB_NAME)) throw new Error("装置只允许操作 s3206_ 前缀库");

const root = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, multipleStatements: true });
await root.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
await root.query(`CREATE DATABASE \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
console.log(`[0] 库已重建：${DB_NAME} @ ${DB_HOST}:${DB_PORT}`);

const db = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
const q = async (sql, params = []) => (await db.query(sql, params))[0];

// ─────────────────────────── [1] 起后端 ───────────────────────────
const logStream = createWriteStream(path.join(RAW, "server.log"), { flags: "w" });
const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: path.join(REPO, "backend"),
  env: {
    ...process.env,
    DB_HOST, DB_PORT: String(DB_PORT), DB_USER, DB_PASSWORD, DB_NAME,
    PORT: String(PORT), HOST: "127.0.0.1", NODE_ENV: "production",
    JWT_SECRET: randomBytes(32).toString("hex"),
    CSRF_SECRET: randomBytes(32).toString("hex"),
    CORS_ORIGINS: `http://127.0.0.1:${PORT},http://localhost:${PORT}`,
    USE_MOCK_DB: "false"
  },
  stdio: ["ignore", "pipe", "pipe"]
});
server.stdout.pipe(logStream);
server.stderr.pipe(logStream);

async function waitHealth(timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (r.status === 200) return true;
    } catch { /* 还没起好 */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

const healthy = await waitHealth();
check("[1] 后端 /health 200（启动期迁移 + 种子已完成）", healthy);
if (!healthy) {
  server.kill();
  throw new Error("后端未就绪，装置中止（见 raw/server.log）");
}

// ─────────────────────────── [2] 夹具 ───────────────────────────
const constantsSrc = readFileSync(path.join(REPO, "backend", "src", "config", "constants.ts"), "utf8");
const demoPassword = /DEMO_PASSWORD:\s*"([^"]+)"/.exec(constantsSrc)?.[1];
if (!demoPassword) throw new Error("未能从 constants.ts 读取 DEMO_PASSWORD");
const hash = "v2$" + bcrypt.hashSync(demoPassword, 12);
await q("UPDATE t_sys_user SET password_hash = ? WHERE username IN ('admin','store_manager')", [hash]);

const sku1 = (await q("SELECT id, spu_id FROM t_product_sku WHERE id = 1 AND tenant_id = ?", [A_TENANT]))[0];
if (!sku1) throw new Error("种子未产出 SKU id=1（见 raw/server.log）");
const spu1 = (await q("SELECT id FROM t_product_spu WHERE id = ? AND tenant_id = ?", [sku1.spu_id, A_TENANT]))[0];

// 同 SPU 下再造一个 SKU，让 product 维度与 SPU 口径可区分
await q(
  "INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, sku_name, base_unit, box_unit, box_ratio, status) VALUES (?, ?, 'S3206-SKU-A2', 'S3206同SPU第二SKU', '瓶', '箱', 12, 1)",
  [A_TENANT, spu1.id]
);
const skuNew = (await q("SELECT id FROM t_product_sku WHERE sku_code = 'S3206-SKU-A2' AND tenant_id = ?", [A_TENANT]))[0];

// B 租户**自己的** SKU + 价格行 + 大额明细：用于证明 finance-report 同根因缺陷（成本口径跨租户）
// 注：t_product_price 有 `uk_product_price_sku_id (sku_id)` 全局唯一键 ⇒ 同一 SKU 不能给第二个租户建价格行
// （本单复现期间实测 ER_DUP_ENTRY 1062；已在回执「范围外发现」登记，本卡不改）
await q(
  "INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, sku_name, base_unit, box_unit, box_ratio, status) VALUES (?, ?, 'S3206-SKU-B1', 'S3206B租户SKU', '瓶', '箱', 12, 1)",
  [B_TENANT, spu1.id]
);
const skuB = (await q("SELECT id FROM t_product_sku WHERE sku_code = 'S3206-SKU-B1' AND tenant_id = ?", [B_TENANT]))[0];
await q("INSERT INTO t_product_price (tenant_id, sku_id, cost_price, retail_price) VALUES (?, ?, 100.00, 199.00)", [B_TENANT, skuB.id]);

// 库存余额（A 用 sku1、B 用自家 skuB）：用于量化 /reports/business-overview 的库存金额跨租户（同根因，卡外）
// 注：种子已给 (store 1, sku 1, OFFLINE) 建过行，且 uk 是 (store_id, sku_id, stock_type) ⇒ A 侧先删后插
await q("DELETE FROM t_inventory_balance WHERE store_id = 1 AND sku_id = ? AND stock_type = 'OFFLINE'", [sku1.id]);
await q(
  "INSERT INTO t_inventory_balance (tenant_id, store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty) VALUES (?, 1, ?, 'OFFLINE', 10, 0, 10)",
  [A_TENANT, sku1.id]
);
await q(
  "INSERT INTO t_inventory_balance (tenant_id, store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty) VALUES (?, 1, ?, 'OFFLINE', 100, 0, 100)",
  [B_TENANT, skuB.id]
);

const priceRow = (await q("SELECT cost_price, retail_price FROM t_product_price WHERE sku_id = ?", [sku1.id]))[0];
console.log(`[2] 该 SKU 价格行：cost=${priceRow?.cost_price ?? "(无)"} retail=${priceRow?.retail_price ?? "(无)"}`);

// 夹具单：A 租户 6 张有效单（同客户/同门店/同操作员）+ DRAFT/VOIDED 反例；B 租户 1 张大额单
const billRows = [
  ["XS3206A1", A_TENANT, "2026-08-10 10:00:00", "CREATED", sku1.id, 2, 129.0, 258.0],
  ["XS3206A2", A_TENANT, "2026-08-25 11:00:00", "CREATED", sku1.id, 3, 129.0, 387.0],
  ["XS3206A3", A_TENANT, "2026-09-05 09:30:00", "CREATED", skuNew.id, 1, 90.0, 90.0],
  ["XS3206A4", A_TENANT, "2026-09-18 15:00:00", "CREATED", sku1.id, 5, 129.0, 645.0],
  ["XS3206A5", A_TENANT, "2026-10-02 10:00:00", "DRAFT", sku1.id, 9, 129.0, 1161.0],
  ["XS3206A6", A_TENANT, "2026-10-03 10:00:00", "VOIDED", sku1.id, 7, 129.0, 903.0],
  ["XS3206A7", A_TENANT, "2026-10-04 16:00:00", "CREATED", sku1.id, 4, 129.0, 516.0],
  ["XS3206A8", A_TENANT, "2026-09-12 14:00:00", "CREATED", skuNew.id, 2, 100.0, 200.0],
  ["XS3206B1", B_TENANT, "2026-09-20 12:00:00", "CREATED", sku1.id, 999, 129.0, 99999.0],
  ["XS3206B2", B_TENANT, "2026-09-21 12:00:00", "CREATED", skuB.id, 999, 199.0, 99999.0]
];

for (const [billNo, tenant, createdAt, status, skuId, qty, unitPrice, subtotal] of billRows) {
  await q(
    "INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type, sale_type, business_status, collection_status, receivable_amount, received_amount, unreceived_amount, operator_id, created_at, updated_at) VALUES (?, ?, 1, 1, 'S3206夹具客户', '13900000006', 'RETAIL', 'CASH', ?, 'UNPAID', ?, 0, ?, 3, ?, ?)",
    [tenant, billNo, status, subtotal, subtotal, createdAt, createdAt]
  );
  await q(
    "INSERT INTO t_sale_bill_item (tenant_id, bill_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty, unit_price, price_type, subtotal_amount, trace_required, created_at) VALUES (?, ?, ?, 'S3206夹具SKU', 0, ?, ?, ?, 'RETAIL', ?, 0, ?)",
    [tenant, billNo, skuId, qty, qty, unitPrice, subtotal, createdAt]
  );
}
console.log(`[2] 夹具写入：${billRows.length} 张销售单（A 租户 7 张含 2 张反例 / B 租户 1 张）`);

// ─────────────────────────── [3] 真 HTTP ───────────────────────────
async function api(method, urlPath, { token, csrf, body, headers = {} } = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      ...headers
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

const login = await api("POST", "/admin/auth/login", { body: { username: "admin", password: demoPassword } });
saveRaw("01-login.json", { status: login.status, code: login.body?.code, msg: login.body?.msg, hasToken: !!login.body?.data?.token });
check("[3a] admin 登录成功（code=0 且下发 token）", login.status === 200 && login.body?.code === "0" && !!login.body?.data?.token);
const token = login.body?.data?.token;

const rankPath = (dim) => `/admin/reports/sales-ranking?dimension=${dim}&dateStart=${DATE_START}&dateEnd=${DATE_END}&limit=50`;
const rank = {};
for (const dim of ["product", "customer", "store", "staff"]) {
  rank[dim] = await api("GET", rankPath(dim), { token });
  saveRaw(`10-sales-ranking-${dim}.json`, rank[dim]);
}

const profit = await api("GET", `/admin/reports/profit?dateStart=${DATE_START}&dateEnd=${DATE_END}`, { token });
saveRaw("20-profit.json", profit);
const coupons = await api("GET", `/admin/marketing/coupons/user-coupons?page=1&pageSize=10`, { token });
saveRaw("22-user-coupons.json", coupons);
const overview = await api("GET", `/admin/reports/business-overview`, { token });
saveRaw("23-business-overview.json", overview);
const series = await api("GET", `/admin/reports/sales-series?dimension=sku&targetId=${sku1.id}&granularity=month&dateStart=${DATE_START}&dateEnd=${DATE_END}`, { token });
saveRaw("21-sales-series-sku.json", series);

// ─────────────────────────── [4] SQL 直查真值 ───────────────────────────
const sqlA = `SELECT COALESCE(SUM(sbi.total_bottle_qty),0) AS qty, COALESCE(SUM(sbi.subtotal_amount),0) AS amount
              FROM t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no
              WHERE sb.tenant_id = ? AND sbi.sku_id = ? AND sb.business_status NOT IN ('DRAFT','VOIDED')
                AND DATE(sb.created_at) BETWEEN ? AND ?`;
const truthA = (await q(sqlA, [A_TENANT, sku1.id, DATE_START, DATE_END]))[0];
const truthB = (await q(sqlA, [B_TENANT, sku1.id, DATE_START, DATE_END]))[0];
const truthAll = (await q(
  `SELECT COALESCE(SUM(sbi.total_bottle_qty),0) AS qty, COALESCE(SUM(sbi.subtotal_amount),0) AS amount
   FROM t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no
   WHERE sbi.sku_id = ? AND sb.business_status NOT IN ('DRAFT','VOIDED') AND DATE(sb.created_at) BETWEEN ? AND ?`,
  [sku1.id, DATE_START, DATE_END]
))[0];
// 各维度口径的"仅 A / A+B"真值（business_status 排除 DRAFT/VOIDED 与 SQL 一致）
async function billSum(extraCondition, tenant) {
  const sql = `SELECT COALESCE(SUM(receivable_amount),0) AS amount, COUNT(DISTINCT bill_no) AS cnt FROM t_sale_bill
               WHERE business_status NOT IN ('DRAFT','VOIDED') AND DATE(created_at) BETWEEN ? AND ? ${extraCondition} ${tenant ? "AND tenant_id = ?" : ""}`;
  const params = tenant ? [DATE_START, DATE_END, tenant] : [DATE_START, DATE_END];
  return (await q(sql, params))[0];
}
const truthCustomer = await billSum("AND customer_id IS NOT NULL", A_TENANT);
const truthCustomerAll = await billSum("AND customer_id IS NOT NULL", null);
const truthStore = await billSum("AND store_id IS NOT NULL", A_TENANT);
const truthStoreAll = await billSum("AND store_id IS NOT NULL", null);
const truthAllBills = await billSum("", A_TENANT);
const truthAllBillsAll = await billSum("", null);
const costA = (await q(
  `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price),0) AS totalCost
   FROM t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no
   JOIN t_product_price pp ON pp.sku_id = sbi.sku_id AND pp.tenant_id = sbi.tenant_id
   WHERE sb.tenant_id = ? AND sb.business_status NOT IN ('DRAFT','VOIDED') AND DATE(sb.created_at) BETWEEN ? AND ?`,
  [A_TENANT, DATE_START, DATE_END]
))[0];
const costAll = (await q(
  `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price),0) AS totalCost
   FROM t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no
   JOIN t_product_price pp ON pp.sku_id = sbi.sku_id AND pp.tenant_id = sbi.tenant_id
   WHERE sb.business_status NOT IN ('DRAFT','VOIDED') AND DATE(sb.created_at) BETWEEN ? AND ?`,
  [DATE_START, DATE_END]
))[0];
saveRaw("30-sql-truth.json", {
  skuId: sku1.id, A: truthA, B: truthB, A_plus_B: truthAll,
  customerA: truthCustomer, customerA_plus_B: truthCustomerAll,
  storeA: truthStore, storeA_plus_B: truthStoreAll,
  allBillsA: truthAllBills, allBillsA_plus_B: truthAllBillsAll,
  costA, costA_plus_B: costAll
});
console.log(`[4] SQL 真值：A sku${sku1.id} = ${truthA.qty} 瓶 / ${truthA.amount} 元；B = ${truthB.qty} 瓶 / ${truthB.amount} 元；合并 = ${truthAll.qty} 瓶 / ${truthAll.amount} 元`);

// ─────────────────────────── [5] 判定 ───────────────────────────
const pickSku = (body) => (body?.data ?? []).find((r) => Number(r.id) === Number(sku1.id));
const skuRow = pickSku(rank.product.body);
check("[5a] sales-ranking?dimension=product 有该 SKU 行", !!skuRow, skuRow);
if (skuRow) {
  const qtyOk = Number(skuRow.totalQty) === Number(truthA.qty);
  const amountOk = Number(skuRow.totalAmount) === Number(truthA.amount);
  check("[5b] product 维度 totalQty = 仅 A 租户真值", qtyOk, `接口=${skuRow.totalQty} A真值=${truthA.qty}（若含B则为 ${truthAll.qty}）`);
  check("[5c] product 维度 totalAmount = 仅 A 租户真值", amountOk, `接口=${skuRow.totalAmount} A真值=${truthA.amount}（若含B则为 ${truthAll.amount}）`);
}

const sumAmount = (body) => (body?.data ?? []).reduce((sum, r) => sum + Number(r.totalAmount ?? 0), 0);
const custSum = sumAmount(rank.customer.body);
check("[5d] customer 维度合计金额 = 仅 A 租户真值", custSum === Number(truthCustomer.amount),
  `接口=${custSum} A真值=${truthCustomer.amount}（若含B则为 ${truthCustomerAll.amount}）`);

const storeRes = rank.store.body;
const storeSum = sumAmount(storeRes);
check("[5e] store 维度可用且合计金额 = 仅 A 租户真值",
  storeRes?.code === "0" && storeSum === Number(truthStore.amount),
  storeRes?.code === "0" ? `接口=${storeSum} A真值=${truthStore.amount}（若含B则为 ${truthStoreAll.amount}）` : `接口异常 code=${storeRes?.code} msg=${storeRes?.msg}`);

const staffSum = sumAmount(rank.staff.body);
check("[5f] staff 维度合计金额 = 仅 A 租户真值", staffSum === Number(truthAllBills.amount),
  `接口=${staffSum} A真值=${truthAllBills.amount}（若含B则为 ${truthAllBillsAll.amount}）`);

// 对照：sales-series（S3-204 已修，显式租户条件）应当本来就正确
const seriesQty = (series.body?.data ?? []).reduce((sum, r) => sum + Number(r.qty ?? 0), 0);
check("[5g] 对照组 sales-series 仅 A 租户（该接口已显式租户条件）", seriesQty === Number(truthA.qty), `接口=${seriesQty} A真值=${truthA.qty}`);

// 范围外探针（软判定，只记录读数，不影响本卡结论）
check("[5h][范围外] /reports/profit 的成本口径 = 仅 A 租户（finance-report 同根因，本卡未修）",
  profit.status === 200 && Number(profit.body?.data?.cost ?? NaN) === Number(costA.totalCost),
  { status: profit.status, 接口cost: profit.body?.data?.cost, A真值: costA.totalCost, 含B应为: costAll.totalCost }, true);

check("[5i][范围外] /marketing/coupons/user-coupons 可用（marketing-coupon 同根因，本卡未修）",
  coupons.status === 200 && coupons.body?.code === "0",
  { status: coupons.status, code: coupons.body?.code, msg: coupons.body?.msg }, true);

// 库存金额真值：A 单独 vs A+B（同一 SKU 价格行按 tenant 归属，故 B 的库存用 B 的成本价）
const invA = (await q(
  `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount FROM t_inventory_balance ib
   JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id WHERE ib.tenant_id = ?`,
  [A_TENANT]
))[0];
const invAll = (await q(
  `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount FROM t_inventory_balance ib
   JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id`
))[0];
check("[5j][范围外] /reports/business-overview 的库存金额 = 仅 A 租户（同文件 :497 同根因，本卡未修）",
  overview.status === 200 && Number(overview.body?.data?.inventoryValue ?? NaN) === Number(invA.amount),
  { status: overview.status, 接口inventoryValue: overview.body?.data?.inventoryValue, A真值: invA.amount, 含B应为: invAll.amount }, true);

const summary = {
  generatedAt: new Date().toISOString(),
  repo: REPO,
  db: DB_NAME,
  fixture: { A: A_TENANT, B: B_TENANT, skuId: sku1.id, dateStart: DATE_START, dateEnd: DATE_END },
  truth: { A: truthA, B: truthB, A_plus_B: truthAll },
  failures,
  results
};
saveRaw("99-summary.json", summary);

server.kill();
await db.end();
await root.end();
console.log(`\n==== 装置结束：PASS ${results.filter((r) => r.ok).length} / FAIL ${failures} / 软失败 ${results.filter((r) => !r.ok && r.soft).length} ====`);
process.exit(failures === 0 ? 0 : 1);
