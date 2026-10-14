/**
 * S3-204 真库端到端装置（本机 MySQL 8.0.46 @127.0.0.1:3408）
 *
 * 做什么：
 *   [0] 重建本单专用库 s3204_main（**只动 s3204_ 前缀库**）
 *   [1] 起真实后端（backend/dist/server.js，启动期跑迁移 + 种子）并等 /health 200
 *   [2] 夹具：把 admin/store_manager 口令哈希对齐 DEMO_PASSWORD（取自 constants.ts，本装置不写字面口令）
 *       ＋ 造两个租户的销售单/明细（含 DRAFT/VOIDED 反例、跨租户反例）
 *   [3] 真 HTTP 调被测接口（登录 → sales-series 各维度 → 后台改价 → AI 改价 → 价格历史）
 *   [4] 交叉核对：接口读数 vs SQL 直查（t_sale_bill_item/t_sale_bill）、vs querySaleBills 端点；租户隔离反例
 *
 * 产物：raw/*.json（接口原始响应）、raw/server.log（后端启动期日志）、raw/99-summary.json（逐项 PASS/FAIL）
 * 运行：node docs/evidence/S3-204/harness.mjs（前置：backend 已 npm run build，MySQL 8 已在 3408 起）
 */
import { spawn } from "node:child_process";
import { createWriteStream, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import path from "node:path";
import mysql from "mysql2/promise";

const REPO = path.resolve("D:/Users/ZXQL/wt-agents/S3-204");
const RAW = path.join(REPO, "docs", "evidence", "S3-204", "raw");
const DB_HOST = process.env.HARNESS_DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.HARNESS_DB_PORT || 3408);
const DB_USER = process.env.HARNESS_DB_USER || "root";
const DB_PASSWORD = process.env.HARNESS_DB_PASSWORD || "";
const DB_NAME = "s3204_main";
const OTHER_TENANT = "s3204t2";
const PORT = Number(process.env.HARNESS_API_PORT || 8204);
const API = `http://127.0.0.1:${PORT}/api`;

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const results = [];
let failures = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  :: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
function saveRaw(file, data) {
  writeFileSync(path.join(RAW, file), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}

// ─────────────────────────── [0] 建库 ───────────────────────────
mkdirSync(RAW, { recursive: true });
if (!/^s3204_/.test(DB_NAME)) throw new Error("装置只允许操作 s3204_ 前缀库");

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
    // 生产模式下 CORS 白名单必填（缺省拒绝启动，见 src/server.ts 的 cors 校验）；本机装置只放行自身
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
const tableCount = await q("SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?", [DB_NAME]);
console.log(`[1] 建表数 = ${tableCount[0].c}（schema 由启动期迁移建立）`);

const migrationLog = readFileSync(path.join(RAW, "server.log"), "utf8");
check("[1] 启动期外部迁移执行到了 200_价格日志来源列.sql",
  migrationLog.includes("执行外部迁移: 200_价格日志来源列.sql"),
  migrationLog.split("\n").filter((l) => l.includes("200_价格日志来源列")).slice(0, 2).join(" | "));
const sourceCol = await q("SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_product_price_log' AND COLUMN_NAME = 'source'", [DB_NAME]);
check("[1] t_product_price_log.source 已由迁移建出（VARCHAR(16) NOT NULL DEFAULT 'admin'）",
  sourceCol.length === 1 && String(sourceCol[0].COLUMN_TYPE) === "varchar(16)" && sourceCol[0].IS_NULLABLE === "NO" && sourceCol[0].COLUMN_DEFAULT === "admin",
  sourceCol);

// ─────────────────────────── [2] 夹具 ───────────────────────────
const constantsSrc = readFileSync(path.join(REPO, "backend", "src", "config", "constants.ts"), "utf8");
const demoPassword = /DEMO_PASSWORD:\s*"([^"]+)"/.exec(constantsSrc)?.[1];
if (!demoPassword) throw new Error("未能从 constants.ts 读取 DEMO_PASSWORD");
const hash = "v2$" + bcrypt.hashSync(demoPassword, 12);
await q("UPDATE t_sys_user SET password_hash = ? WHERE username IN ('admin','store_manager')", [hash]);

const sku1 = (await q("SELECT id, spu_id FROM t_product_sku WHERE id = 1 AND tenant_id = 'default'"))[0];
const spu1 = (await q("SELECT id, category_id FROM t_product_spu WHERE id = ? AND tenant_id = 'default'", [sku1.spu_id]))[0];
const sku2 = (await q("SELECT id FROM t_product_sku WHERE id = 2 AND tenant_id = 'default'"))[0];

// 同 SPU 下再造一个 SKU（让 product 维度与 sku 维度真的不同：product = 该 SPU 全部 SKU 之和）
await q(
  "INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, sku_name, base_unit, box_unit, box_ratio, status) VALUES ('default', ?, 'S3204-SKU-A2', 'S3204同SPU第二SKU', '瓶', '箱', 12, 1)",
  [spu1.id]
);
const skuNew = (await q("SELECT id FROM t_product_sku WHERE sku_code = 'S3204-SKU-A2' AND tenant_id = 'default'"))[0];

const billRows = [
  ["XS3204A1", "default", "2026-08-10 10:00:00", "CREATED", sku1.id, 2, 129.0, 258.0, 258.0, 1],
  ["XS3204A2", "default", "2026-08-25 11:00:00", "CREATED", sku1.id, 3, 129.0, 387.0, 387.0, 1],
  ["XS3204A3", "default", "2026-09-05 09:30:00", "CREATED", sku2.id, 1, 90.0, 90.0, 90.0, 1],
  ["XS3204A4", "default", "2026-09-18 15:00:00", "CREATED", sku1.id, 5, 129.0, 645.0, 645.0, 1],
  ["XS3204A5", "default", "2026-10-02 10:00:00", "DRAFT", sku1.id, 9, 129.0, 1161.0, 1161.0, 1],
  ["XS3204A6", "default", "2026-10-03 10:00:00", "VOIDED", sku1.id, 7, 129.0, 903.0, 903.0, 1],
  ["XS3204A7", "default", "2026-10-04 16:00:00", "CREATED", sku1.id, 4, 129.0, 516.0, 516.0, 1],
  ["XS3204A8", "default", "2026-09-12 14:00:00", "CREATED", skuNew.id, 2, 100.0, 200.0, 200.0, 1],
  ["XS3204B1", OTHER_TENANT, "2026-09-20 12:00:00", "CREATED", sku1.id, 999, 129.0, 99999.0, 99999.0, 1]
];

for (const [billNo, tenant, createdAt, status, skuId, qty, unitPrice, subtotal, receivable, customerId] of billRows) {
  await q(
    "INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type, sale_type, business_status, collection_status, receivable_amount, received_amount, unreceived_amount, operator_id, created_at, updated_at) VALUES (?, ?, 1, ?, 'S3204夹具客户', '13900000009', 'RETAIL', 'CASH', ?, 'UNPAID', ?, 0, ?, 3, ?, ?)",
    [tenant, billNo, customerId, status, receivable, receivable, createdAt, createdAt]
  );
  await q(
    "INSERT INTO t_sale_bill_item (tenant_id, bill_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty, unit_price, price_type, subtotal_amount, trace_required, created_at) VALUES (?, ?, ?, 'S3204夹具SKU', 0, ?, ?, ?, 'RETAIL', ?, 0, ?)",
    [tenant, billNo, skuId, qty, qty, unitPrice, subtotal, createdAt]
  );
}
console.log(`[2] 夹具写入：${billRows.length} 张销售单（含 DRAFT/VOIDED 反例与跨租户反例）`);

// ─────────────────────────── [3] 真 HTTP 调用 ───────────────────────────
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
saveRaw("01-login.json", { status: login.status, code: login.body?.code, msg: login.body?.msg, user: login.body?.data?.user, hasToken: !!login.body?.data?.token, hasCsrf: !!login.body?.data?.csrfToken });
check("[3a] admin 登录成功（code=0 且下发 token/csrfToken）", login.status === 200 && login.body?.code === "0" && !!login.body?.data?.token);
const token = login.body.data.token;
const csrf = login.body.data.csrfToken;
const authHeaders = { token };

const EXPECT_SKU = [
  { period: "2026-08", qty: 5, amount: 645, orderCount: 2 },
  { period: "2026-09", qty: 5, amount: 645, orderCount: 1 },
  { period: "2026-10", qty: 4, amount: 516, orderCount: 1 }
];
// product 维度 = 该 SPU 下全部 SKU（sku1 + 同为 spu1 的 skuNew）
const EXPECT_PRODUCT = [
  { period: "2026-08", qty: 5, amount: 645, orderCount: 2 },
  { period: "2026-09", qty: 7, amount: 845, orderCount: 2 },
  { period: "2026-10", qty: 4, amount: 516, orderCount: 1 }
];
// category / customer 维度还包含同租户另一 SKU（sku2 与 spu1 同分类；A3 属客户 1）
const EXPECT_WIDE = [
  { period: "2026-08", qty: 5, amount: 645, orderCount: 2 },
  { period: "2026-09", qty: 8, amount: 935, orderCount: 3 },
  { period: "2026-10", qty: 4, amount: 516, orderCount: 1 }
];

const seriesSku = await api("GET", `/admin/reports/sales-series?dimension=sku&targetId=${sku1.id}&granularity=month`, authHeaders);
saveRaw("02-sales-series-sku-month.json", seriesSku);
check("[3b] sales-series（sku，近 12 期）code=0", seriesSku.body?.code === "0", seriesSku.body?.msg);
const series = seriesSku.body?.data || [];
check("[3b] sku 序列=08/09/10 三期，数值正确（DRAFT/VOIDED 已剔除，跨租户未混入）",
  JSON.stringify(series) === JSON.stringify(EXPECT_SKU), series);

const seriesProduct = await api("GET", `/admin/reports/sales-series?dimension=product&targetId=${spu1.id}&granularity=month`, authHeaders);
saveRaw("03-sales-series-product-month.json", seriesProduct);
check("[3c] sales-series（product=SPU）按 SPU 汇总（含同 SPU 的另一 SKU ⇒ 大于 sku 维度）",
  JSON.stringify(seriesProduct.body?.data) === JSON.stringify(EXPECT_PRODUCT), seriesProduct.body?.data);

const seriesCategory = await api("GET", `/admin/reports/sales-series?dimension=category&targetId=${spu1.category_id}&granularity=month`, authHeaders);
saveRaw("04-sales-series-category-month.json", seriesCategory);
check("[3c] sales-series（category）含同分类全部 SKU（sku1+skuNew+sku2）",
  JSON.stringify(seriesCategory.body?.data) === JSON.stringify(EXPECT_WIDE), seriesCategory.body?.data);

const seriesCustomer = await api("GET", "/admin/reports/sales-series?dimension=customer&targetId=1&granularity=month", authHeaders);
saveRaw("05-sales-series-customer-month.json", seriesCustomer);
check("[3c] sales-series（customer=1）含该客户全部 SKU 明细",
  JSON.stringify(seriesCustomer.body?.data) === JSON.stringify(EXPECT_WIDE), seriesCustomer.body?.data);

const seriesDay = await api("GET", `/admin/reports/sales-series?dimension=sku&targetId=${sku1.id}&granularity=day&dateStart=2026-08-01&dateEnd=2026-10-31`, authHeaders);
saveRaw("06-sales-series-sku-day-ranged.json", seriesDay);
check("[3d] day 粒度 + 显式区间 ⇒ 按期返回（08-10/08-25/09-18/10-04 共 4 期）",
  JSON.stringify((seriesDay.body?.data || []).map((r) => r.period)) === JSON.stringify(["2026-08-10", "2026-08-25", "2026-09-18", "2026-10-04"]), seriesDay.body?.data);

const seriesAlias = await api("GET", `/admin/reports/sales-series?dimension=sku&targetId=${sku1.id}&granularity=month&start=2026-09-01&end=2026-09-30`, authHeaders);
saveRaw("07-sales-series-start-end-alias.json", seriesAlias);
check("[3d] start/end 别名：只返回 2026-09", JSON.stringify(seriesAlias.body?.data) === JSON.stringify([EXPECT_SKU[1]]), seriesAlias.body?.data);

const seriesEmpty = await api("GET", "/admin/reports/sales-series?dimension=sku&targetId=999999&granularity=month", authHeaders);
saveRaw("08-sales-series-empty.json", seriesEmpty);
check("[3d] 无数据目标 ⇒ data=[] 且 code=0（空数组不报错）", seriesEmpty.body?.code === "0" && Array.isArray(seriesEmpty.body?.data) && seriesEmpty.body.data.length === 0, seriesEmpty.body);

const seriesBad = await api("GET", "/admin/reports/sales-series?dimension=nope&targetId=1", authHeaders);
saveRaw("09-sales-series-bad-param.json", seriesBad);
check("[3d] 非法 dimension ⇒ code=400", seriesBad.body?.code === "400", seriesBad.body?.msg);

const retailBefore = Number((await q("SELECT retail_price FROM t_product_price WHERE sku_id = ? AND tenant_id = 'default'", [sku1.id]))[0].retail_price);
const putAdmin = await api("PUT", `/admin/products/${sku1.id}/price`, { token, csrf, body: { retailPrice: retailBefore + 11 } });
saveRaw("10-put-price-admin.json", putAdmin);
check("[3e] 后台改价成功（未带 source ⇒ 应落 admin）", putAdmin.body?.code === "0", putAdmin.body?.msg);

const wholesaleBefore = Number((await q("SELECT wholesale_price FROM t_product_price WHERE sku_id = ? AND tenant_id = 'default'", [sku1.id]))[0].wholesale_price);
const putAi = await api("PUT", `/admin/products/${sku1.id}/price`, {
  token,
  csrf,
  body: { wholesalePrice: wholesaleBefore + 7, source: "ai" },
  headers: { "X-Tenant-Id": "default", "X-Request-Id": "s3204-ai-form-1" }
});
saveRaw("11-put-price-ai-form.json", putAi);
check("[3f] AI 形态改价成功（X-Tenant-Id + x-csrf-token + Authorization，带 source=ai）", putAi.body?.code === "0", putAi.body?.msg);

const logsSql = await q("SELECT id, sku_id AS skuId, price_type AS priceType, old_price AS oldPrice, new_price AS newPrice, source, operator_id AS operatorId, action_type AS actionType, created_at AS createdAt FROM t_product_price_log WHERE sku_id = ? AND tenant_id = 'default' ORDER BY id ASC", [sku1.id]);
saveRaw("12-price-log-rows.json", logsSql);
check("[3f] 两条改价路径各落一条历史，source 分别 admin / ai",
  logsSql.length === 2 && logsSql[0].source === "admin" && logsSql[1].source === "ai", logsSql);

const hist = await api("GET", `/admin/products/${sku1.id}/price-history`, authHeaders);
saveRaw("13-price-history.json", hist);
const recs = hist.body?.data?.records || [];
check("[3g] price-history 返回 2 条（id 倒序）且含归一化 date/priceLevel/price",
  recs.length === 2 && !!recs[0].date && recs[0].priceLevel === "WHOLESALE" && typeof recs[0].price === "number", recs);
check("[3g] price-history 带 operatorName（联表）与 source", recs[0]?.operatorName === "系统管理员" && recs[0]?.source === "ai" && recs[1]?.source === "admin", [recs[0], recs[1]]);

const histFiltered = await api("GET", `/admin/products/${sku1.id}/price-history?priceLevel=retail&limit=10`, authHeaders);
saveRaw("14-price-history-filtered.json", histFiltered);
const frecs = histFiltered.body?.data?.records || [];
check("[3g] priceLevel=retail（小写入参统一转大写）只返回 RETAIL 一条", frecs.length === 1 && frecs[0].priceLevel === "RETAIL" && frecs[0].source === "admin", frecs);

const histRanged = await api("GET", `/admin/products/${sku1.id}/price-history?dateStart=2020-01-01&dateEnd=2020-12-31`, authHeaders);
saveRaw("15-price-history-ranged-empty.json", histRanged);
check("[3g] 日期区间无命中 ⇒ records=[] 且 code=0", Array.isArray(histRanged.body?.data?.records) && histRanged.body.data.records.length === 0, histRanged.body?.data);

const histBad = await api("GET", `/admin/products/${sku1.id}/price-history?limit=0`, authHeaders);
saveRaw("16-price-history-bad-limit.json", histBad);
check("[3g] limit=0 ⇒ code=400（参数校验）", histBad.body?.code === "400", histBad.body?.msg);

const bills = await api("GET", "/admin/sale-bills?page=1&pageSize=200", authHeaders);
saveRaw("17-query-sale-bills.json", { code: bills.body?.code, total: bills.body?.data?.total, records: (bills.body?.data?.records || []).filter((b) => String(b.billNo).startsWith("XS3204")) });
const byPeriod = {};
for (const b of bills.body?.data?.records || []) {
  if (!String(b.billNo).startsWith("XS3204A")) continue;
  if (b.businessStatus === "DRAFT" || b.businessStatus === "VOIDED") continue;
  if (Number(b.itemCount) !== 1) continue;
  const period = String(b.createdAt).slice(0, 7);
  byPeriod[period] = byPeriod[period] || { amount: 0, orderCount: 0 };
  byPeriod[period].amount += Number(b.receivableAmount);
  byPeriod[period].orderCount += 1;
}
const apiCross = Object.keys(byPeriod).sort().map((p) => ({ period: p, amount: byPeriod[p].amount, orderCount: byPeriod[p].orderCount }));
saveRaw("18-cross-check-querySaleBills.json", { querySaleBills端点读数: apiCross, salesSeries_customer维度读数: seriesCustomer.body?.data });
check("[3h] 交叉核对：sales-series（customer 维度）金额/单数与 querySaleBills 端点（单据应收）逐期一致",
  JSON.stringify(apiCross) === JSON.stringify((seriesCustomer.body?.data || []).map(({ period, amount, orderCount }) => ({ period, amount, orderCount }))), { apiCross });

// ─────────────────────────── [4] SQL 交叉核对 + 租户隔离 ───────────────────────────
const sqlCross = await q("SELECT DATE_FORMAT(sb.created_at, '%Y-%m') AS period, SUM(sbi.total_bottle_qty) AS qty, SUM(sbi.subtotal_amount) AS amount, COUNT(DISTINCT sb.bill_no) AS orderCount FROM t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id WHERE sb.tenant_id = 'default' AND sb.business_status NOT IN ('DRAFT','VOIDED') AND sbi.sku_id = ? GROUP BY period ORDER BY period", [sku1.id]);
saveRaw("19-sql-cross-check-sku.json", sqlCross);
check("[4a] SQL 直查（明细口径）与接口逐期一致",
  JSON.stringify(sqlCross.map((r) => ({ period: r.period, qty: Number(r.qty), amount: Number(r.amount), orderCount: Number(r.orderCount) }))) === JSON.stringify(series),
  { sqlCross });

const otherTenant = await q("SELECT COUNT(*) AS billCount, COALESCE(SUM(sbi.subtotal_amount),0) AS amount FROM t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id WHERE sbi.tenant_id = ? AND sbi.sku_id = ?", [OTHER_TENANT, sku1.id]);
saveRaw("20-other-tenant-fixture.json", otherTenant);
const leaked = series.some((r) => Number(r.qty) >= 999 || Number(r.amount) >= 99999);
check("[4b] 租户隔离反例：另一租户同 SKU 的 999 瓶/99999 元未进入本租户序列", !leaked, { otherTenant, series });

const rankingProduct = await api("GET", "/admin/reports/sales-ranking?dimension=product&limit=100", authHeaders);
const rankWindow = await q("SELECT AVG(created_at) AS x, MIN(created_at) AS mn, MAX(created_at) AS mx FROM t_sale_bill WHERE tenant_id = 'default'");
const sqlWindowA = await q("SELECT COALESCE(SUM(sbi.total_bottle_qty),0) AS qty, COALESCE(SUM(sbi.subtotal_amount),0) AS amount FROM t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id WHERE sb.tenant_id = 'default' AND sb.business_status NOT IN ('DRAFT','VOIDED') AND DATE(sb.created_at) BETWEEN ? AND ?", [new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)]);
const sqlWindowAB = await q("SELECT COALESCE(SUM(sbi.total_bottle_qty),0) AS qty, COALESCE(SUM(sbi.subtotal_amount),0) AS amount FROM t_sale_bill_item sbi JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id WHERE sb.business_status NOT IN ('DRAFT','VOIDED') AND DATE(sb.created_at) BETWEEN ? AND ?", [new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)]);
const rankedSku1 = (rankingProduct.body?.data || []).find((r) => Number(r.id) === sku1.id);
saveRaw("21-sales-ranking-product-probe.json", {
  endpoint: rankingProduct.body,
  近30天仅A租户SQL: sqlWindowA[0],
  近30天A加B租户SQL: sqlWindowAB[0],
  期间参考: rankWindow[0]
});
check("[4c] 范围外发现复现：既有 sales-ranking(product) 的 sku 行读数 = A+B 两租户之和（跨租户聚合缺陷，只报不改）",
  !!rankedSku1 && Number(rankedSku1.totalQty) === Number(sqlWindowAB[0].qty) && Number(sqlWindowAB[0].qty) > Number(sqlWindowA[0].qty),
  { 端点: rankedSku1, 仅A: sqlWindowA[0], A加B: sqlWindowAB[0] });

// 4d. 迁移 200 幂等：把文件原样再跑两遍，断言零报错且列唯一
const migSql = readFileSync(path.join(REPO, "docs", "migrations", "200_价格日志来源列.sql"), "utf8");
const migConn = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, multipleStatements: true });
let migReplayError = null;
for (let i = 0; i < 2; i++) {
  try { await migConn.query(migSql); } catch (e) { migReplayError = `${i + 1} 遍：${e.code || ""} ${e.message}`; break; }
}
await migConn.end();
const sourceColAfter = await q("SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_product_price_log' AND COLUMN_NAME = 'source'", [DB_NAME]);
saveRaw("22-migration-200-idempotency.json", { migReplayError, sourceColumnCount: sourceColAfter[0].c });
check("[4d] 迁移 200 幂等：连跑三遍（启动 1 + 手工 2）零报错、source 列仍唯一",
  migReplayError === null && sourceColAfter[0].c === 1, { migReplayError, sourceColumnCount: sourceColAfter[0].c });

// ─────────────────────────── 汇总 ───────────────────────────
server.kill();
await db.end();
await root.end();
saveRaw("99-summary.json", results);
console.log(`\n===== 汇总：PASS ${results.length - failures} / FAIL ${failures} =====`);
process.exit(failures === 0 ? 0 : 1);
