/**
 * S3-209 真库端到端装置（本机 MySQL 8 @127.0.0.1:3408，**只动 s3209_ 前缀库**）
 *
 * 做什么（逐条对应派单卡 docs/tasks/inbox/ACTIVE-S3-209.md §三 验收判据）：
 *   [0] 重建本单专用库 s3209_main（DROP + CREATE）
 *   [1] 起真实后端（backend/dist/server.js，启动期跑全部 docs/migrations）并等 /health 200
 *   [2] 夹具：A 租户（default）与 B 租户（s3209t2）各自的销售单 + 出库流水 + 库存余额；
 *       三个权限形态的账号（无码 / 精确持码 / sale:* 通配）与角色
 *   [2b] **立码**：用 `scripts/run-migration.mjs` 真跑 `docs/migrations/203_销售单取消权限点.sql`
 *       （临时 .env 指向本夹具库）并连跑两遍证明幂等
 *   [3] 真 HTTP：登录 → 逐条验收（正常取消 / 幂等 / PAID 拒绝 / 原子性 / 权限 403-200 /
 *       租户隔离 404 / source 落库）
 *   [4] SQL 直查真值（库存改前/改后、流水、单状态、来源列）
 *   [5] 汇总 raw/99-summary.json，逐项 PASS/FAIL，FAIL 则 exit 1
 *
 * 前置：`npm --workspace backend run build` 已产出本工作树的 backend/dist。
 * 运行：`node docs/evidence/S3-209/harness.mjs`
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";

const REPO = path.resolve(process.env.HARNESS_REPO || "D:/Users/ZXQL/wt-agents/S3-209");
const RAW = path.join(REPO, "docs", "evidence", "S3-209", "raw");
const DB_HOST = process.env.HARNESS_DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.HARNESS_DB_PORT || 3408);
const DB_USER = process.env.HARNESS_DB_USER || "root";
const DB_PASSWORD = process.env.HARNESS_DB_PASSWORD || "";
const DB_NAME = "s3209_main";
const A_TENANT = "default";
const B_TENANT = "s3209t2";
const PORT = Number(process.env.HARNESS_API_PORT || 8209);
const API = `http://127.0.0.1:${PORT}/api`;
const SCRATCH_PW = "S3209@harness1";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const results = [];
let failures = 0;
function check(name, ok, detail, soft = false) {
  results.push({ name, ok, soft, detail });
  if (!ok && !soft) failures++;
  console.log(`${ok ? "PASS" : soft ? "OBSERVE-FAIL" : "FAIL"}  ${name}` + (detail === undefined ? "" : `  :: ${JSON.stringify(detail)}`));
}
function saveRaw(file, data) {
  writeFileSync(path.join(RAW, file), typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
}

if (!/^s3209_/.test(DB_NAME)) throw new Error("装置只允许操作 s3209_ 前缀库");
mkdirSync(RAW, { recursive: true });

// ─────────────────────────── [0] 建库 ───────────────────────────
const root = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, multipleStatements: true });
await root.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
await root.query(`CREATE DATABASE \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
await root.end();
console.log(`[0] 库已重建：${DB_NAME} @ ${DB_HOST}:${DB_PORT}`);

const db = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, multipleStatements: true });
const q = async (sql, params = []) => (await db.query(sql, params))[0];

// ─────────────────────────── [1] 起后端 ───────────────────────────
const logStream = createWriteStream(path.join(RAW, "server.log"), { flags: "w" });
const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: path.join(REPO, "backend"),
  env: {
    ...process.env,
    DB_HOST, DB_PORT: String(DB_PORT), DB_USER, DB_PASSWORD, DB_NAME,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    NODE_ENV: "production",
    JWT_SECRET: randomBytes(32).toString("hex"),
    CSRF_SECRET: randomBytes(32).toString("hex"),
    CORS_ORIGINS: `http://127.0.0.1:${PORT},http://localhost:${PORT}`,
    USE_MOCK_DB: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
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
const skuA = (await q("SELECT id, spu_id FROM t_product_sku WHERE tenant_id = ? ORDER BY id LIMIT 1", [A_TENANT]))[0];
if (!skuA) throw new Error("种子未产出 SKU（见 raw/server.log）");
// ⚠️ t_inventory_balance 的唯一键是 (store_id, sku_id, stock_type)，**不含 tenant_id**
// ⇒ 每张销售单必须配**自己的 SKU**，否则多张单共用一行库存，"改前真值"会互相覆盖。
// 建 SKU 辅助函数（租户 + 编号 → sku_id）
async function makeSku(tenant, code, spuId) {
  await q(
    "INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, sku_name, base_unit, box_unit, box_ratio, status) VALUES (?, ?, ?, ?, '瓶', '箱', 12, 1)",
    [tenant, spuId, code, `S3209夹具SKU ${code}`]
  );
  return (await q("SELECT id FROM t_product_sku WHERE sku_code = ? AND tenant_id = ?", [code, tenant]))[0].id;
}
const SKU = await makeSku(A_TENANT, "S3209-SKU-A0", skuA.spu_id);
const SKU_B = await makeSku(B_TENANT, "S3209-SKU-B1", skuA.spu_id);

/** 角色 + 账号（三个权限形态；口令固定，仅本夹具库使用） */
const hash = "v2$" + bcrypt.hashSync(SCRATCH_PW, 12);
const USERS = [
  { username: "s3209_no_code", role: "S3209_STAFF", perms: ["sale:create", "sale:view"] },
  { username: "s3209_cancel_only", role: "S3209_CANCEL_ONLY", perms: ["sale:cancel"] },
  { username: "s3209_manager", role: "S3209_STORE_MANAGER", perms: ["store:*", "sale:*", "customer:*", "inventory:*", "report:*", "dashboard:*"] },
];
for (const u of USERS) {
  await q(
    "INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id) VALUES (?, ?, 'S3-209 夹具角色', 'ALL', ?, 1, ?)",
    [u.role, u.role, JSON.stringify(u.perms), A_TENANT]
  );
  const roleId = (await q("SELECT id FROM t_sys_role WHERE role_code = ? AND tenant_id = ?", [u.role, A_TENANT]))[0].id;
  await q(
    "INSERT INTO t_sys_user (tenant_id, username, password_hash, real_name, mobile, store_id, status, created_at, updated_at) VALUES (?, ?, ?, 'S3-209 夹具账号', ?, 1, 1, NOW(), NOW())",
    [A_TENANT, u.username, hash, "1390000" + String(9000 + USERS.indexOf(u))]
  );
  const uid = (await q("SELECT id FROM t_sys_user WHERE username = ? AND tenant_id = ?", [u.username, A_TENANT]))[0].id;
  await q("INSERT INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)", [uid, roleId, A_TENANT]);
}
// admin（种子账号，SUPER_ADMIN）口令改为已知值，便于本装置登录
await q("UPDATE t_sys_user SET password_hash = ? WHERE username = 'admin' AND tenant_id = ?", [hash, A_TENANT]);

/** 销售单夹具：billNo / 租户 / 收款状态 / 已出库量（SALE_OUT 负流水）/ 取消前库存 */
const SKU_BY_BILL = { XS3209A1: SKU, XS3209B1: SKU_B };
for (const n of [2, 3, 4, 5, 6, 7]) SKU_BY_BILL[`XS3209A${n}`] = await makeSku(A_TENANT, `S3209-SKU-A${n}`, skuA.spu_id);
const BILLS = [
  { billNo: "XS3209A1", tenant: A_TENANT, coll: "UNPAID", out: 10, stock: 90, status: "CREATED" },
  { billNo: "XS3209A2", tenant: A_TENANT, coll: "UNPAID", out: 4, stock: 20, status: "CREATED" },
  { billNo: "XS3209A3", tenant: A_TENANT, coll: "PAID", out: 5, stock: 50, status: "CREATED" },
  { billNo: "XS3209A4", tenant: A_TENANT, coll: "UNPAID", out: 6, stock: 60, status: "CREATED" },
  { billNo: "XS3209A5", tenant: A_TENANT, coll: "UNPAID", out: 0, stock: 0, status: "CREATED" },
  { billNo: "XS3209A6", tenant: A_TENANT, coll: "PARTIAL", out: 3, stock: 30, status: "CREATED" },
  { billNo: "XS3209A7", tenant: A_TENANT, coll: "UNPAID", out: 2, stock: 25, status: "CREATED" },
  { billNo: "XS3209B1", tenant: B_TENANT, coll: "UNPAID", out: 7, stock: 70, status: "CREATED" },
].map((b) => ({ ...b, sku: SKU_BY_BILL[b.billNo] }));
for (const b of BILLS) {
  await q(
    `INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type,
       sale_type, business_status, collection_status, receivable_amount, received_amount, unreceived_amount, operator_id, remark)
     VALUES (?, ?, 1, NULL, 'S3209夹具客户', '13900009009', 'RETAIL', 'CASH', ?, ?, 100.00, ?, ?, 1, 'S3-209 夹具')`,
    [b.tenant, b.billNo, b.status, b.coll, b.coll === "PAID" ? 100 : b.coll === "PARTIAL" ? 40 : 0, b.coll === "PAID" ? 0 : b.coll === "PARTIAL" ? 60 : 100]
  );
  await q(
    `INSERT INTO t_sale_bill_item (tenant_id, bill_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty, unit_price, price_type, subtotal_amount)
     VALUES (?, ?, ?, 'S3209夹具SKU', 0, 1, 1, 100.00, 'RETAIL', 100.00)`,
    [b.tenant, b.billNo, b.sku]
  );
  // 库存行按 (store_id, sku_id, stock_type) 唯一 ⇒ 先删后插，保证夹具值即真值
  await q("DELETE FROM t_inventory_balance WHERE store_id = 1 AND sku_id = ? AND stock_type = 'OFFLINE'", [b.sku]);
  await q(
    `INSERT INTO t_inventory_balance (tenant_id, store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty)
     VALUES (?, 1, ?, 'OFFLINE', ?, 0, ?)`,
    [b.tenant, b.sku, b.stock, b.stock]
  );
  if (b.out > 0) {
    await q(
      `INSERT INTO t_inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no, change_qty,
         before_qty, after_qty, before_locked_qty, after_locked_qty, operator_id, idempotency_key, remark, tenant_id)
       VALUES (?, 1, ?, 'OFFLINE', 'SALE_OUT', ?, ?, ?, ?, 0, 0, 1, ?, 'S3-209 夹具出库', ?)`,
      [`IL3209${b.billNo}`, b.sku, b.billNo, -b.out, b.stock + b.out, b.stock, `SALE_OUT:${b.billNo}:${b.sku}`, b.tenant]
    );
  }
}
// 原子性用例前置：给 A4 预置一条"同幂等键"的 SALE_CANCEL 流水 ⇒ 取消时 INSERT 撞唯一键，事务必须整体回滚
await q(
  `INSERT INTO t_inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no, change_qty,
     before_qty, after_qty, before_locked_qty, after_locked_qty, operator_id, idempotency_key, remark, tenant_id)
     VALUES ('IL3209CONFLICT', 1, ?, 'OFFLINE', 'SALE_CANCEL', 'XS3209A4', 6, 66, 72, 0, 0, 1, ?, 'S3-209 冲突键（原子性反测）', ?)`,
  [SKU_BY_BILL.XS3209A4, `SALE_CANCEL:XS3209A4:${SKU_BY_BILL.XS3209A4}`, A_TENANT]
);
console.log(`[2] 夹具：SKU A=${SKU} / B=${SKU_B}；销售单 ${BILLS.length} 张（A 7 张含 PAID/无出库/冲突键各 1，B 1 张）；账号 4 个`);

// ─────────────────────────── [2b] 立码：真跑 203 迁移（两遍证幂等） ───────────────────────────
// 前置：模拟生产**既有**菜单树（079 的菜单种子在写闸门引入之前就已入库）。
// 空库上 203 会因父行 `sale:record` 缺失而整条跳过（有意设计：不插孤儿按钮行）。
await q(
  `INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id)
   SELECT NULL, 'sale', '销售管理', 'CATALOG', '/sale', NULL, 3, ?
   WHERE NOT EXISTS (SELECT 1 FROM t_sys_menu d WHERE d.menu_code = 'sale' AND d.tenant_id = ?)`,
  [A_TENANT, A_TENANT]
);
const saleMenuId = (await q("SELECT id FROM t_sys_menu WHERE menu_code = 'sale' AND tenant_id = ?", [A_TENANT]))[0].id;
await q(
  `INSERT INTO t_sys_menu (parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id)
   SELECT ?, 'sale:record', '销售记录', 'MENU', '/sale/record', NULL, 2, ?
   WHERE NOT EXISTS (SELECT 1 FROM t_sys_menu d WHERE d.menu_code = 'sale:record' AND d.tenant_id = ?)`,
  [saleMenuId, A_TENANT, A_TENANT]
);
const tmpEnv = mkdtempSync(path.join(tmpdir(), "s3209-env-"));
writeFileSync(
  path.join(tmpEnv, ".env"),
  `# S3-209 装置临时 .env（仅指向本夹具库，用完即删）\nDB_HOST=${DB_HOST}\nDB_PORT=${DB_PORT}\nDB_USER=${DB_USER}\nDB_PASSWORD=${DB_PASSWORD}\nDB_NAME=${DB_NAME}\n`,
  "utf8"
);
function runMigration(relSql) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(REPO, "scripts", "run-migration.mjs"), path.join(REPO, relSql)], {
      cwd: tmpEnv,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (out += d.toString()));
    p.on("close", (code) => resolve({ code, out: out.trim() }));
  });
}
const mig203First = await runMigration("docs/migrations/203_销售单取消权限点.sql");
const codeRowCount1 = (await q("SELECT COUNT(*) AS n FROM t_sys_menu WHERE menu_code = 'sale:cancel'"))[0].n;
const mig203Second = await runMigration("docs/migrations/203_销售单取消权限点.sql");
const codeRowCount2 = (await q("SELECT COUNT(*) AS n FROM t_sys_menu WHERE menu_code = 'sale:cancel'"))[0].n;
saveRaw("20-migration-203.txt", `第一次：\n${mig203First.out}\n\n第二次：\n${mig203Second.out}\n`);
check("[2b] 立码迁移 203 真跑成功（exit 0，两遍）", mig203First.code === 0 && mig203Second.code === 0, {
  first: mig203First.code, second: mig203Second.code, tail: mig203Second.out.split("\n").slice(-2),
});
check("[2b] 立码后 `sale:cancel` 菜单行存在且幂等（两遍行数相同且 =1）", codeRowCount1 === 1 && codeRowCount2 === 1, {
  afterFirst: codeRowCount1, afterSecond: codeRowCount2,
});
rmSync(tmpEnv, { recursive: true, force: true });

// ─────────────────────────── [3] 真 HTTP ───────────────────────────
async function api(method, urlPath, { token, csrf, body } = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function login(username) {
  const res = await api("POST", "/admin/auth/login", { body: { username, password: SCRATCH_PW } });
  return { token: res.body?.data?.token, csrf: res.body?.data?.csrfToken, status: res.status, code: res.body?.code };
}

const sessions = {};
for (const name of ["admin", ...USERS.map((u) => u.username)]) {
  sessions[name] = await login(name);
}
saveRaw("30-login.json", Object.fromEntries(Object.entries(sessions).map(([k, v]) => [k, { status: v.status, code: v.code, hasToken: !!v.token, hasCsrf: !!v.csrf }])));
check("[3a] 四个账号均登录成功并下发 token + csrfToken", Object.values(sessions).every((s) => s.status === 200 && !!s.token && !!s.csrf), Object.fromEntries(Object.entries(sessions).map(([k, v]) => [k, v.status])));

const cancel = (billNo, who, body = {}) =>
  api("POST", `/admin/sale-bills/${billNo}/cancel`, { token: sessions[who].token, csrf: sessions[who].csrf, body });
const stockOf = async (billNo, tenant = A_TENANT) => {
  const row = (await q(
    `SELECT ib.available_qty AS qty FROM t_inventory_balance ib
     JOIN t_sale_bill sb ON sb.bill_no = ? AND sb.tenant_id = ? WHERE ib.tenant_id = sb.tenant_id AND ib.store_id = sb.store_id AND ib.sku_id = ? AND ib.stock_type = 'OFFLINE'`,
    [billNo, tenant, SKU_BY_BILL[billNo]]
  ))[0];
  return row ? Number(row.qty) : null;
};
const billOf = async (billNo, tenant = A_TENANT) =>
  (await q("SELECT bill_no, business_status, collection_status, void_reason, void_source, received_amount FROM t_sale_bill WHERE bill_no = ? AND tenant_id = ?", [billNo, tenant]))[0];
const ledgerOf = async (billNo, bizType, tenant = A_TENANT) =>
  (await q("SELECT COUNT(*) AS n, COALESCE(SUM(change_qty),0) AS qty FROM t_inventory_ledger WHERE biz_type = ? AND biz_no = ? AND tenant_id = ?", [bizType, billNo, tenant]))[0];
const opLogOf = async (billNo) =>
  (await q("SELECT action, after_data FROM t_operation_log WHERE module = 'SALE_BILL' AND action = 'CANCEL' AND biz_no = ? ORDER BY id DESC LIMIT 1", [billNo]))[0];
/** JSON 列在 mysql2 下已被解析为对象、在部分驱动下仍是字符串 ⇒ 统一成对象再断言 */
const asJson = (v) => (typeof v === "string" ? JSON.parse(v) : v);

// ① 正常取消（admin 角色）
const stockBeforeA1 = await stockOf("XS3209A1");
const r1 = await cancel("XS3209A1", "s3209_manager", { reason: "客户不要了" });
const stockAfterA1 = await stockOf("XS3209A1");
const billA1 = await billOf("XS3209A1");
saveRaw("40-cancel-normal.json", { res: r1, stockBeforeA1, stockAfterA1, billA1 });
check("[3①] 正常取消 UNPAID ⇒ 200 + status=CANCELLED + businessStatus=VOIDED", r1.status === 200 && r1.body?.code === "0" && r1.body?.data?.status === "CANCELLED" && r1.body?.data?.businessStatus === "VOIDED", { status: r1.status, data: r1.body?.data });
check("[3①] 库存回滚真值：90 → 100（+10，与 SALE_OUT 出库量一致）", stockBeforeA1 === 90 && stockAfterA1 === 100 && r1.body?.data?.reversedStock === true, { stockBeforeA1, stockAfterA1, reversedStock: r1.body?.data?.reversedStock });
check("[3①] 落库：business_status=VOIDED + collection_status=CLOSED + void_reason 留痕", billA1?.business_status === "VOIDED" && billA1?.collection_status === "CLOSED" && billA1?.void_reason === "客户不要了", billA1);
check("[3①] 回滚流水：新增 SALE_CANCEL +10 一条（SALE_OUT 仍为原值）", (await ledgerOf("XS3209A1", "SALE_CANCEL")).n === 1 && Number((await ledgerOf("XS3209A1", "SALE_CANCEL")).qty) === 10, { cancel: await ledgerOf("XS3209A1", "SALE_CANCEL"), out: await ledgerOf("XS3209A1", "SALE_OUT") });

// ② 幂等（source='ai' 的取消 + 重复调用）
const stockBeforeA2 = await stockOf("XS3209A2");
const r2a = await cancel("XS3209A2", "s3209_cancel_only", { reason: "AI 代取消", source: "ai" });
const stockMidA2 = await stockOf("XS3209A2");
const r2b = await cancel("XS3209A2", "s3209_cancel_only", { reason: "AI 重复取消", source: "ai" });
const stockAfterA2 = await stockOf("XS3209A2");
saveRaw("41-cancel-idempotent.json", { first: r2a, second: r2b, stockBeforeA2, stockMidA2, stockAfterA2 });
check("[3②] 幂等：第二次取消返回既有结果（idempotent=true，状态仍 CANCELLED）", r2a.status === 200 && r2b.status === 200 && r2b.body?.data?.idempotent === true && r2b.body?.data?.status === "CANCELLED", { first: r2a.body?.data, second: r2b.body?.data });
check("[3②] 幂等：库存只回滚一次（20 → 24 → 24）", stockBeforeA2 === 20 && stockMidA2 === 24 && stockAfterA2 === 24, { stockBeforeA2, stockMidA2, stockAfterA2 });
check("[3②] 幂等：SALE_CANCEL 流水仍只有 1 条（未二次回滚）", (await ledgerOf("XS3209A2", "SALE_CANCEL")).n === 1, await ledgerOf("XS3209A2", "SALE_CANCEL"));

// ③ PAID ⇒ 400
const stockBeforeA3 = await stockOf("XS3209A3");
const r3 = await cancel("XS3209A3", "s3209_manager", { reason: "想取消" });
const stockAfterA3 = await stockOf("XS3209A3");
const billA3 = await billOf("XS3209A3");
saveRaw("42-cancel-paid-reject.json", { res: r3, stockBeforeA3, stockAfterA3, billA3 });
check("[3③] PAID ⇒ 400 + 可读文案（含「冲销」）", r3.status === 400 && String(r3.body?.msg).includes("冲销"), { status: r3.status, msg: r3.body?.msg });
check("[3③] PAID 被拒后零改动（状态仍 CREATED/PAID，库存 50 不变）", billA3?.business_status === "CREATED" && billA3?.collection_status === "PAID" && stockBeforeA3 === 50 && stockAfterA3 === 50, { billA3, stockBeforeA3, stockAfterA3 });

// ④ 原子性（预置冲突幂等键 ⇒ 中途失败 ⇒ 整体回滚）
const stockBeforeA4 = await stockOf("XS3209A4");
const r4 = await cancel("XS3209A4", "s3209_manager", { reason: "原子性反测" });
const stockAfterA4 = await stockOf("XS3209A4");
const billA4 = await billOf("XS3209A4");
saveRaw("43-cancel-atomicity.json", { res: r4, stockBeforeA4, stockAfterA4, billA4 });
check("[3④] 中途失败 ⇒ 报错（4xx/5xx，非 200）", r4.status >= 400, { status: r4.status, msg: r4.body?.msg });
check("[3④] 中途失败 ⇒ 整体回滚：单未作废 + 库存未动（60 → 60）", billA4?.business_status === "CREATED" && stockBeforeA4 === 60 && stockAfterA4 === 60, { billA4, stockBeforeA4, stockAfterA4 });
check("[3④] 中途失败 ⇒ 未新增 SALE_CANCEL 流水（仍只有预置的 1 条冲突行）", (await ledgerOf("XS3209A4", "SALE_CANCEL")).n === 1, await ledgerOf("XS3209A4", "SALE_CANCEL"));

// ⑤ 权限（无码 403 / 有码 200）
const r5a = await cancel("XS3209A7", "s3209_no_code", { reason: "无码尝试" });
const billA7AfterDeny = await billOf("XS3209A7");
const r5b = await cancel("XS3209A7", "s3209_manager", { reason: "有码取消" });
const billA7AfterAllow = await billOf("XS3209A7");
saveRaw("44-cancel-permission.json", { noCode: r5a, noCodeBillAfter: billA7AfterDeny, withCode: r5b, withCodeBillAfter: billA7AfterAllow });
check("[3⑤] 无 sale:cancel 的角色 ⇒ 403 + 提示需要 sale:cancel + 未落任何改动", r5a.status === 403 && String(r5a.body?.msg).includes("sale:cancel") && billA7AfterDeny?.business_status === "CREATED", { status: r5a.status, msg: r5a.body?.msg, bill: billA7AfterDeny });
check("[3⑤] 持 sale:*（域通配）⇒ 200 且该单确实被取消（对照证明非「整单不可取消」）", r5b.status === 200 && billA7AfterAllow?.business_status === "VOIDED", { status: r5b.status, businessStatus: billA7AfterAllow?.business_status });
check("[3⑤] PARTIAL（部分收款）⇒ 200 可取消", (await cancel("XS3209A6", "s3209_manager", { reason: "部分收款单取消" })).status === 200);
const rUnauth = await api("POST", "/admin/sale-bills/XS3209A5/cancel", { body: { reason: "未登录" } });
check("[3⑤] 未登录 ⇒ 401（认证先于授权）", rUnauth.status === 401, { status: rUnauth.status });

// ⑥ 租户隔离
const stockBBefore = await stockOf("XS3209B1", B_TENANT);
const r6 = await cancel("XS3209B1", "s3209_manager", { reason: "跨租户尝试" });
const stockBAfter = await stockOf("XS3209B1", B_TENANT);
const billB = await billOf("XS3209B1", B_TENANT);
saveRaw("45-cancel-tenant-isolation.json", { res: r6, stockBBefore, stockBAfter, billB });
check("[3⑥] A 租户令牌取消 B 租户的单 ⇒ 404（不泄露存在性）", r6.status === 404, { status: r6.status, msg: r6.body?.msg });
check("[3⑥] B 租户的单与库存零改动", billB?.business_status === "CREATED" && stockBBefore === 70 && stockBAfter === 70, { billB, stockBBefore, stockBAfter });

// ⑦ source 落库
const billA2 = await billOf("XS3209A2");
const logA2 = await opLogOf("XS3209A2");
const logA1 = await opLogOf("XS3209A1");
saveRaw("46-cancel-source.json", { billA1, logA1, billA2, logA2 });
check("[3⑦] source='ai' 落库（void_source=ai）+ 操作日志可见来源 ai", billA2?.void_source === "ai" && asJson(logA2?.after_data)?.source === "ai", { void_source: billA2?.void_source, after_data: logA2?.after_data });
check("[3⑦] 缺省 source=admin 落库（void_source=admin）", billA1?.void_source === "admin" && asJson(logA1?.after_data)?.source === "admin", { void_source: billA1?.void_source, after_data: logA1?.after_data });

// 附加：未出库的单 ⇒ 200 但 reversedStock=false（不给未出库单凭空加库存）
const r7 = await cancel("XS3209A5", "s3209_manager", { reason: "未出库单取消" });
saveRaw("47-cancel-no-stock-out.json", r7);
check("[3附] 未出库的单 ⇒ 200 + reversedStock=false（不存在凭空回滚）", r7.status === 200 && r7.body?.data?.reversedStock === false && (await billOf("XS3209A5"))?.business_status === "VOIDED", r7.body?.data);

// ─────────────────────────── [4] 汇总 ───────────────────────────
saveRaw("99-summary.json", { total: results.length, failed: failures, results });
console.log(`\n[5] 汇总：${results.length - failures} PASS / ${failures} FAIL（明细 raw/99-summary.json）`);
server.kill();
await db.end();
process.exit(failures === 0 ? 0 : 1);
