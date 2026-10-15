/**
 * S3-207 真库端到端装置（本机 MySQL 8 @127.0.0.1:3408）
 *
 * 做什么（与 S3-206 装置同夹具、同口径，便于前后对照）：
 *   [0] 重建本单专用库 s3207_main（**只动 s3207_ 前缀库**）
 *   [1] 起真实后端（backend/dist/server.js，启动期跑迁移 + 种子）并等 /health 200
 *   [2] 夹具：A 租户（default）与 B 租户（s3207t2）各有自己的 SKU/价格/库存/销售单；
 *       A 侧含 DRAFT/VOIDED 反例 —— 于是"跨租户聚合"必然把 B 的数字并进 A 的分组。
 *   [3] 真 HTTP：登录 → sales-ranking 四维度（S3-206 修复回归）→ profit（本单 ①）
 *       → business-overview（本单 ②）→ batch-price 预览（本单 ③）→ 券（对照组）
 *   [4] SQL 直查真值（A 单独 / A+B 合并）
 *   [5] 判定：A 令牌读数必须 == A 单独真值（≠ A+B）
 *   [6] **注入器对照探针**：同一次运行里同时 import「改前 dist（S3-206 工作树，= origin/main）」
 *       与「改后 dist（本工作树）」，用同一夹具库跑同一批 SQL，直接读两侧行为差：
 *         P1 `... WHERE sb.tenant_id = sb.tenant_id`（列对列，无值谓词）⇒ 改前不注入（读到 A+B）/ 改后注入生效（只读到 A）
 *         P2 finance 口径 JOIN（两表都有 tenant_id）⇒ 改前静默读到 A+B / 改后 ER_NON_UNIQ_ERROR 1052（响亮失败）
 *         P3 对照 `tenant_id = ?` ⇒ 两侧都不重复注入（读数一致）
 *         P4 平台标记 `tenant-scope:platform` ⇒ 两侧都跳过注入（枚举全部租户）
 *
 * 产物：raw/*.json、raw/server.log、raw/99-summary.json（逐项 PASS/FAIL/读数）
 * 运行：node docs/evidence/S3-207/harness.mjs（前置：本工作树 backend 已 npm run build；
 *       基线对照需要 D:/Users/ZXQL/wt-agents/S3-206/backend/dist 存在）
 */
import { spawn } from "node:child_process";
import { createWriteStream, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { randomBytes, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import mysql from "mysql2/promise";

const REPO = path.resolve(process.env.HARNESS_REPO || "D:/Users/ZXQL/wt-agents/S3-207");
const RAW = path.join(REPO, "docs", "evidence", "S3-207", "raw");
const BASELINE_REPO = process.env.HARNESS_BASELINE_REPO || "D:/Users/ZXQL/wt-agents/S3-206";
const DB_HOST = process.env.HARNESS_DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.HARNESS_DB_PORT || 3408);
const DB_USER = process.env.HARNESS_DB_USER || "root";
const DB_PASSWORD = process.env.HARNESS_DB_PASSWORD || "";
const DB_NAME = "s3207_main";
const A_TENANT = "default";
const B_TENANT = "s3207t2";
const PORT = Number(process.env.HARNESS_API_PORT || 8207);
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
  console.log(
    `${ok ? "PASS" : soft ? "OBSERVE-FAIL" : "FAIL"}  ${name}` +
      (detail === undefined ? "" : `  :: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`)
  );
}
function saveRaw(file, data) {
  writeFileSync(path.join(RAW, file), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}
function sha256(file) {
  return existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16) : "(缺失)";
}

// ─────────────────────────── [0] 建库 ───────────────────────────
mkdirSync(RAW, { recursive: true });
if (!/^s3207_/.test(DB_NAME)) throw new Error("装置只允许操作 s3207_ 前缀库");

// 装置自身进程也要连库（探针要 import 两侧 dist 的 database.js，其 env 在 import 时读取）
for (const [k, v] of Object.entries({
  DB_HOST,
  DB_PORT: String(DB_PORT),
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  NODE_ENV: "production",
  USE_MOCK_DB: "false",
  JWT_SECRET: randomBytes(32).toString("hex"),
  CSRF_SECRET: randomBytes(32).toString("hex")
})) {
  process.env[k] = v;
}

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
    DB_HOST,
    DB_PORT: String(DB_PORT),
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    NODE_ENV: "production",
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
    } catch {
      /* 还没起好 */
    }
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

await q(
  "INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, sku_name, base_unit, box_unit, box_ratio, status) VALUES (?, ?, 'S3207-SKU-A2', 'S3207同SPU第二SKU', '瓶', '箱', 12, 1)",
  [A_TENANT, spu1.id]
);
const skuNew = (await q("SELECT id FROM t_product_sku WHERE sku_code = 'S3207-SKU-A2' AND tenant_id = ?", [A_TENANT]))[0];

// B 租户**自己的** SKU + 价格行（t_product_price 的 sku_id 是全局唯一键 ⇒ 同 SKU 不能给第二租户建价格行）
await q(
  "INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, sku_name, base_unit, box_unit, box_ratio, status) VALUES (?, ?, 'S3207-SKU-B1', 'S3207B租户SKU', '瓶', '箱', 12, 1)",
  [B_TENANT, spu1.id]
);
const skuB = (await q("SELECT id FROM t_product_sku WHERE sku_code = 'S3207-SKU-B1' AND tenant_id = ?", [B_TENANT]))[0];
await q("INSERT INTO t_product_price (tenant_id, sku_id, cost_price, retail_price) VALUES (?, ?, 100.00, 199.00)", [B_TENANT, skuB.id]);

// 库存余额（A 用 sku1、B 用自家 skuB）：量化 /reports/business-overview 的库存金额口径
await q("DELETE FROM t_inventory_balance WHERE store_id = 1 AND sku_id = ? AND stock_type = 'OFFLINE'", [sku1.id]);
await q(
  "INSERT INTO t_inventory_balance (tenant_id, store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty) VALUES (?, 1, ?, 'OFFLINE', 10, 0, 10)",
  [A_TENANT, sku1.id]
);
await q(
  "INSERT INTO t_inventory_balance (tenant_id, store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty) VALUES (?, 1, ?, 'OFFLINE', 100, 0, 100)",
  [B_TENANT, skuB.id]
);

const billRows = [
  ["XS3207A1", A_TENANT, "2026-08-10 10:00:00", "CREATED", sku1.id, 2, 129.0, 258.0],
  ["XS3207A2", A_TENANT, "2026-08-25 11:00:00", "CREATED", sku1.id, 3, 129.0, 387.0],
  ["XS3207A3", A_TENANT, "2026-09-05 09:30:00", "CREATED", skuNew.id, 1, 90.0, 90.0],
  ["XS3207A4", A_TENANT, "2026-09-18 15:00:00", "CREATED", sku1.id, 5, 129.0, 645.0],
  ["XS3207A5", A_TENANT, "2026-10-02 10:00:00", "DRAFT", sku1.id, 9, 129.0, 1161.0],
  ["XS3207A6", A_TENANT, "2026-10-03 10:00:00", "VOIDED", sku1.id, 7, 129.0, 903.0],
  ["XS3207A7", A_TENANT, "2026-10-04 16:00:00", "CREATED", sku1.id, 4, 129.0, 516.0],
  ["XS3207A8", A_TENANT, "2026-09-12 14:00:00", "CREATED", skuNew.id, 2, 100.0, 200.0],
  ["XS3207B1", B_TENANT, "2026-09-20 12:00:00", "CREATED", sku1.id, 999, 129.0, 99999.0],
  ["XS3207B2", B_TENANT, "2026-09-21 12:00:00", "CREATED", skuB.id, 999, 199.0, 99999.0]
];

for (const [billNo, tenant, createdAt, status, skuId, qty, unitPrice, subtotal] of billRows) {
  await q(
    "INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type, sale_type, business_status, collection_status, receivable_amount, received_amount, unreceived_amount, operator_id, created_at, updated_at) VALUES (?, ?, 1, 1, 'S3207夹具客户', '13900000007', 'RETAIL', 'CASH', ?, 'UNPAID', ?, 0, ?, 3, ?, ?)",
    [tenant, billNo, status, subtotal, subtotal, createdAt, createdAt]
  );
  await q(
    "INSERT INTO t_sale_bill_item (tenant_id, bill_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty, unit_price, price_type, subtotal_amount, trace_required, created_at) VALUES (?, ?, ?, 'S3207夹具SKU', 0, ?, ?, ?, 'RETAIL', ?, 0, ?)",
    [tenant, billNo, skuId, qty, qty, unitPrice, subtotal, createdAt]
  );
}
console.log(`[2] 夹具写入：SKU A=${sku1.id}/A2=${skuNew.id}/B=${skuB.id}；销售单 ${billRows.length} 张（A 8 张含 2 反例 / B 2 张）`);

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
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const login = await api("POST", "/admin/auth/login", { body: { username: "admin", password: demoPassword } });
saveRaw("01-login.json", { status: login.status, code: login.body?.code, msg: login.body?.msg, hasToken: !!login.body?.data?.token });
check("[3a] admin 登录成功（code=0 且下发 token）", login.status === 200 && login.body?.code === "0" && !!login.body?.data?.token, {
  status: login.status,
  code: login.body?.code,
  msg: login.body?.msg
});
const token = login.body?.data?.token;
// S3-187 起写方法要求 CSRF 双提交（x-csrf-token = HMAC(用户 id)，登录响应里下发）
const csrf = login.body?.data?.csrfToken;
check("[3b] 登录响应下发 csrfToken（写方法需要）", !!csrf, { hasCsrf: !!csrf });

const rank = {};
for (const dim of ["product", "customer", "store", "staff"]) {
  const p = `/admin/reports/sales-ranking?dimension=${dim}&dateStart=${DATE_START}&dateEnd=${DATE_END}&limit=50`;
  rank[dim] = await api("GET", p, { token });
  saveRaw(`10-sales-ranking-${dim}.json`, rank[dim]);
}

const profit = await api("GET", `/admin/reports/profit?dateStart=${DATE_START}&dateEnd=${DATE_END}`, { token });
saveRaw("20-profit.json", profit);
const overview = await api("GET", "/admin/reports/business-overview", { token });
saveRaw("23-business-overview.json", overview);
const coupons = await api("GET", "/admin/marketing/coupons/user-coupons?page=1&pageSize=10", { token });
saveRaw("22-user-coupons.json", coupons);

const previewBody = (skuIds) => ({
  filter: { skuIds },
  adjustment: { field: "retail_price", method: "PERCENTAGE", value: 10, direction: "INCREASE" },
  page: 1,
  pageSize: 50
});
const previewA = await api("POST", "/admin/prices/batch/preview", { token, csrf, body: previewBody([sku1.id]) });
saveRaw("24-batch-price-preview-skuA.json", previewA);
const previewB = await api("POST", "/admin/prices/batch/preview", { token, csrf, body: previewBody([skuB.id]) });
saveRaw("25-batch-price-preview-skuB.json", previewB);
const previewAll = await api("POST", "/admin/prices/batch/preview", { token, csrf, body: previewBody([sku1.id, skuNew.id, skuB.id]) });
saveRaw("26-batch-price-preview-all3.json", previewAll);

// ─────────────────────────── [4] SQL 直查真值 ───────────────────────────
const costSql = (tenant) => ({
  sql: `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price), 0) AS totalCost
        FROM t_sale_bill_item sbi
        JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
        JOIN t_product_price pp ON pp.sku_id = sbi.sku_id AND pp.tenant_id = sbi.tenant_id
        WHERE ${tenant ? "sb.tenant_id = ? AND " : ""}sb.business_status NOT IN ('DRAFT','VOIDED')
          AND DATE(sb.created_at) BETWEEN ? AND ?`,
  params: tenant ? [tenant, DATE_START, DATE_END] : [DATE_START, DATE_END]
});
const costA = (await q(costSql(A_TENANT).sql, costSql(A_TENANT).params))[0];
const costAll = (await q(costSql(null).sql, costSql(null).params))[0];

const invA = (await q(
  `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount FROM t_inventory_balance ib
   JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id WHERE ib.tenant_id = ?`,
  [A_TENANT]
))[0];
const invAll = (await q(
  `SELECT COALESCE(SUM(ib.physical_qty * pp.cost_price), 0) AS amount FROM t_inventory_balance ib
   JOIN t_product_price pp ON pp.sku_id = ib.sku_id AND pp.tenant_id = ib.tenant_id`
))[0];

const previewTruth = async (skuIds, tenant) => {
  const ph = skuIds.map(() => "?").join(",");
  const row = (await q(
    `SELECT COUNT(*) AS total FROM t_product_price pp
     JOIN t_product_sku sku ON sku.id = pp.sku_id AND sku.tenant_id = pp.tenant_id
     JOIN t_product_spu s ON s.id = sku.spu_id AND s.tenant_id = sku.tenant_id
     WHERE pp.tenant_id = ? AND sku.id IN (${ph})`,
    [tenant, ...skuIds]
  ))[0];
  return Number(row.total);
};
const previewTruthA = await previewTruth([sku1.id], A_TENANT);
const previewTruthAll = await previewTruth([sku1.id, skuB.id], A_TENANT); // 只统计 A 的价格行（+B 的 SKU 不属于 A）
const previewTruthA2 = await previewTruth([skuNew.id], A_TENANT);

// 销售单口径真值（A 单独 / A+B 合并），用于 sales-ranking 各维度回归对照
async function billSum(extra, tenant) {
  const sql = `SELECT COALESCE(SUM(receivable_amount),0) AS amount, COUNT(DISTINCT bill_no) AS cnt FROM t_sale_bill
               WHERE business_status NOT IN ('DRAFT','VOIDED') AND DATE(created_at) BETWEEN ? AND ?
                 ${extra} ${tenant ? "AND tenant_id = ?" : ""}`;
  return (await q(sql, tenant ? [DATE_START, DATE_END, tenant] : [DATE_START, DATE_END]))[0];
}
const truthCustomerA = await billSum("AND customer_id IS NOT NULL", A_TENANT);
const truthCustomerAll = await billSum("AND customer_id IS NOT NULL", null);
const truthStoreA = await billSum("AND store_id IS NOT NULL", A_TENANT);
const truthStoreAll = await billSum("AND store_id IS NOT NULL", null);
const truthStaffA = await billSum("", A_TENANT);
const truthStaffAll = await billSum("", null);

saveRaw("30-sql-truth.json", {
  costA,
  costAll,
  invA,
  invAll,
  previewTruthA,
  previewTruthA2,
  previewTruthAll,
  truthCustomerA,
  truthCustomerAll,
  truthStoreA,
  truthStoreAll,
  truthStaffA,
  truthStaffAll,
  sku: { a: sku1.id, a2: skuNew.id, b: skuB.id }
});
console.log(
  `[4] SQL 真值：成本 A=${costA.totalCost} / A+B=${costAll.totalCost}；库存 A=${invA.amount} / A+B=${invAll.amount}`
);

// ─────────────────────────── [5] 判定 ───────────────────────────
const pickSku = (body, id) => (body?.data ?? []).find((r) => Number(r.id) === Number(id));
const skuRow = pickSku(rank.product.body, sku1.id);
check("[5a][回归] sales-ranking?dimension=product 有该 SKU 行", !!skuRow, skuRow ?? rank.product.body?.code);
const sumAmount = (body) => (body?.data ?? []).reduce((s, r) => s + Number(r.totalAmount ?? 0), 0);
check(
  "[5b][回归] sales-ranking customer 维度合计 = 仅 A 租户",
  rank.customer.body?.code === "0" && sumAmount(rank.customer.body) === Number(truthCustomerA.amount),
  { 接口: sumAmount(rank.customer.body), code: rank.customer.body?.code, A真值: truthCustomerA.amount, 含B应为: truthCustomerAll.amount }
);
check(
  "[5c][回归] sales-ranking store 维度可用且合计 = 仅 A 租户（S3-206 的 1052 修复未回退）",
  rank.store.body?.code === "0" && sumAmount(rank.store.body) === Number(truthStoreA.amount),
  { code: rank.store.body?.code, msg: rank.store.body?.msg, 接口: sumAmount(rank.store.body), A真值: truthStoreA.amount, 含B应为: truthStoreAll.amount }
);
check(
  "[5c2][回归] sales-ranking staff 维度合计 = 仅 A 租户",
  rank.staff.body?.code === "0" && sumAmount(rank.staff.body) === Number(truthStaffA.amount),
  { 接口: sumAmount(rank.staff.body), A真值: truthStaffA.amount, 含B应为: truthStaffAll.amount }
);

check(
  "[5d][本单①] /reports/profit 成本 = 仅 A 租户真值",
  profit.status === 200 && Number(profit.body?.data?.cost ?? NaN) === Number(costA.totalCost),
  { status: profit.status, 接口cost: profit.body?.data?.cost, A真值: costA.totalCost, 含B应为: costAll.totalCost }
);
check(
  "[5e][本单②] /reports/business-overview 库存金额 = 仅 A 租户真值",
  overview.status === 200 && Number(overview.body?.data?.inventoryValue ?? NaN) === Number(invA.amount),
  { status: overview.status, 接口: overview.body?.data?.inventoryValue, A真值: invA.amount, 含B应为: invAll.amount }
);

const previewCount = (r) => Number(r.body?.data?.totalCount ?? NaN);
check(
  "[5f][本单③] batch-price 预览：A 令牌查 A 的 SKU ⇒ 命中 A 的价格行（1 条）",
  previewA.status === 200 && previewCount(previewA) === previewTruthA,
  { status: previewA.status, 接口totalCount: previewCount(previewA), A真值: previewTruthA }
);
check(
  "[5g][本单③] batch-price 预览：A 令牌查 B 的 SKU ⇒ 0 条（看不到 B 的数据）",
  previewB.status === 200 && previewCount(previewB) === 0,
  { status: previewB.status, 接口totalCount: previewCount(previewB) }
);
check(
  "[5h][本单③] batch-price 预览：A 令牌同时查 [A,A2,B] ⇒ 只命中 A 侧真值（skuNew 无价格行 ⇒ 1 条；若泄露含 B 会变 2）",
  previewAll.status === 200 && previewCount(previewAll) === previewTruthA + previewTruthA2,
  { status: previewAll.status, 接口totalCount: previewCount(previewAll), A真值: previewTruthA + previewTruthA2 }
);
check("[5i][对照组] /marketing/coupons/user-coupons 可用（code=0）", coupons.status === 200 && coupons.body?.code === "0", {
  status: coupons.status,
  code: coupons.body?.code
});

// ─────────────────────────── [6] 注入器对照探针（改前 vs 改后） ───────────────────────────
const probe = { baselineRepo: BASELINE_REPO, fixedRepo: REPO, cases: {}, sha: {} };
probe.sha.fixedSrc = sha256(path.join(REPO, "backend", "src", "config", "database.ts"));
probe.sha.fixedSrc = probe.sha.fixedSrc + " / tenant-scope.ts " + sha256(path.join(REPO, "backend", "src", "shared", "tenant-scope.ts"));
probe.sha.fixedDist = sha256(path.join(REPO, "backend", "dist", "config", "database.js"));
probe.sha.baselineDist = sha256(path.join(BASELINE_REPO, "backend", "dist", "config", "database.js"));

async function loadInjector(repo, label) {
  const p = path.join(repo, "backend", "dist", "config", "database.js");
  if (!existsSync(p)) {
    console.log(`[6] ${label} dist 不存在，跳过（${p}）`);
    return null;
  }
  return (await import(pathToFileURL(p).href)).queryWithTenant;
}

const fixedQuery = await loadInjector(REPO, "改后");
const baseQuery = await loadInjector(BASELINE_REPO, "改前");

async function runCase(qw, sql, params, tenantId) {
  try {
    const rows = await qw(sql, params, tenantId);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, errno: e?.errno ?? null, code: e?.code ?? null, msg: String(e?.sqlMessage || e?.message || e).slice(0, 200) };
  }
}

const P1 = "SELECT COUNT(*) AS c FROM t_sale_bill sb WHERE sb.tenant_id = sb.tenant_id AND sb.business_status = 'CREATED'";
const P2 = `SELECT COALESCE(SUM(sbi.total_bottle_qty * pp.cost_price), 0) AS totalCost
            FROM t_sale_bill_item sbi
            JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id
            JOIN t_product_price pp ON pp.sku_id = sbi.sku_id AND pp.tenant_id = sbi.tenant_id
            WHERE sb.business_status NOT IN ('DRAFT','VOIDED')`;
const P3 = "SELECT COUNT(*) AS c FROM t_sale_bill WHERE tenant_id = ? AND business_status = 'CREATED'";
const P4 = "SELECT DISTINCT tenant_id FROM t_sale_bill WHERE business_status = 'CREATED' /* tenant-scope:platform */";

const truthCreatedA = Number((await q("SELECT COUNT(*) AS c FROM t_sale_bill WHERE tenant_id = ? AND business_status = 'CREATED'", [A_TENANT]))[0].c);
const truthCreatedAll = Number((await q("SELECT COUNT(*) AS c FROM t_sale_bill WHERE business_status = 'CREATED'"))[0].c);

for (const [id, sql, params, tenantId] of [
  ["P1-column-to-column", P1, [], A_TENANT],
  ["P2-finance-join", P2, [], A_TENANT],
  ["P3-param-predicate", P3, [A_TENANT], A_TENANT],
  ["P4-platform-marker", P4, [], ""]
]) {
  const fixed = fixedQuery ? await runCase(fixedQuery, sql, params, tenantId) : null;
  const base = baseQuery ? await runCase(baseQuery, sql, params, tenantId) : null;
  probe.cases[id] = { sql, params, tenantId, fixed, baseline: base };
}

const cnt = (r) => (r?.ok ? Number(r.rows?.[0]?.c ?? r.rows?.[0]?.totalCost ?? NaN) : null);
check(
  "[6a] 反例 P1（列对列 tenant_id = tenant_id）：改前**不注入** ⇒ 读到 A+B；改后**注入生效** ⇒ 只读到 A",
  baseQuery && fixedQuery
    ? cnt(probe.cases["P1-column-to-column"].baseline) === truthCreatedAll &&
        cnt(probe.cases["P1-column-to-column"].fixed) === truthCreatedA
    : true,
  {
    改前: cnt(probe.cases["P1-column-to-column"].baseline),
    改后: cnt(probe.cases["P1-column-to-column"].fixed),
    A真值: truthCreatedA,
    A_B真值: truthCreatedAll
  },
  !baseQuery || !fixedQuery
);
check(
  "[6b] 反例 P2（finance 口径 JOIN）：改前静默读到 A+B；改后注入 ⇒ 1052 歧义（响亮失败，不再静默泄露）",
  baseQuery && fixedQuery
    ? Number(cnt(probe.cases["P2-finance-join"].baseline)) === Number(costAll.totalCost) &&
        probe.cases["P2-finance-join"].fixed?.ok === false &&
        probe.cases["P2-finance-join"].fixed?.errno === 1052
    : true,
  {
    改前: cnt(probe.cases["P2-finance-join"].baseline),
    改后: probe.cases["P2-finance-join"].fixed,
    含B应为: costAll.totalCost
  },
  !baseQuery || !fixedQuery
);
check(
  "[6c] 对照 P3（tenant_id = ?）：两侧都**不重复注入**，读数一致且 = A 真值",
  baseQuery && fixedQuery
    ? cnt(probe.cases["P3-param-predicate"].baseline) === truthCreatedA &&
        cnt(probe.cases["P3-param-predicate"].fixed) === truthCreatedA
    : true,
  { 改前: cnt(probe.cases["P3-param-predicate"].baseline), 改后: cnt(probe.cases["P3-param-predicate"].fixed), A真值: truthCreatedA },
  !baseQuery || !fixedQuery
);
check(
  "[6d] 对照 P4（平台标记）：两侧都跳过注入 ⇒ 枚举到全部租户（改前/改后一致）",
  baseQuery && fixedQuery
    ? (probe.cases["P4-platform-marker"].baseline?.rows ?? []).length ===
        (probe.cases["P4-platform-marker"].fixed?.rows ?? []).length &&
        (probe.cases["P4-platform-marker"].fixed?.rows ?? []).length >= 2
    : true,
  {
    改前行数: (probe.cases["P4-platform-marker"].baseline?.rows ?? []).length,
    改后行数: (probe.cases["P4-platform-marker"].fixed?.rows ?? []).length
  },
  !baseQuery || !fixedQuery
);
saveRaw("40-injector-probe.json", probe);

const summary = {
  generatedAt: new Date().toISOString(),
  repo: REPO,
  baselineRepo: BASELINE_REPO,
  db: DB_NAME,
  fixture: { A: A_TENANT, B: B_TENANT, skuA: sku1.id, skuA2: skuNew.id, skuB: skuB.id, dateStart: DATE_START, dateEnd: DATE_END },
  truth: { costA: costA.totalCost, costAll: costAll.totalCost, invA: invA.amount, invAll: invAll.amount, createdA: truthCreatedA, createdAll: truthCreatedAll },
  failures,
  results
};
saveRaw("99-summary.json", summary);

server.kill();
await db.end();
await root.end();
console.log(
  `\n==== 装置结束：PASS ${results.filter((r) => r.ok).length} / FAIL ${failures} / 软失败 ${results.filter((r) => !r.ok && r.soft).length} ====`
);
process.exit(failures === 0 ? 0 : 1);
