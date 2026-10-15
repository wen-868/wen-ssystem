/**
 * S3-210 逐语句真库对照探针（P0 租户隔离）
 *
 * 目的：对 S3-207 补了显式租户谓词的那些语句，逐条给出**真库读数**，
 *       证明「A 令牌只读到 A」（而不是只靠门禁静态判定）。
 *
 * 做法（每条语句两个变体，同一次运行、同一份数据）：
 *   V1「如已交付」：从源码里**原样抽取**的模板字面量（含 S3-207 补的 `xxx.tenant_id = ?`），
 *                  用 **A 租户** 作为调用者租户，并故意用一个 **B 租户的键**（客户/门店/SKU/会员/审批人）；
 *   V2「等价改前」：把该 `tenant_id = ?` 谓词**摘掉**（= 旧判据短路不注入时的效果），其余不变。
 * 判据：
 *   键类语句 ⇒ V1 命中 0（阻断跨租户），V2 命中 ≥1（证明这条谓词是**承重**的，去掉就跨租户）；
 *   聚合类语句 ⇒ V2 读数 > V1 读数（V2 把 B 的金额也算进来）。
 *
 * 前置：先跑一次 `node docs/evidence/S3-210/harness/harness.mjs`（它建库 s3207_main 并灌夹具）。
 * 本探针**只**操作 `s3207_` 前缀库，且只 INSERT 自己前缀的夹具行（可重复执行，幂等）。
 *
 * 用法：node docs/evidence/S3-210/harness/cross-tenant-probe.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const REPO = path.resolve(process.env.HARNESS_REPO || "D:/Users/ZXQL/wt-agents/S3-210");
const DB = {
  host: process.env.HARNESS_DB_HOST || "127.0.0.1",
  port: Number(process.env.HARNESS_DB_PORT || 3408),
  user: process.env.HARNESS_DB_USER || "root",
  password: process.env.HARNESS_DB_PASSWORD || "",
  database: "s3207_main"
};
if (!/^s3207_/.test(DB.database)) throw new Error("探针只允许操作 s3207_ 前缀库");

const A = "default";   // A 租户 = 调用者
const B = "s3207t2";   // B 租户 = 被尝试越界读取的一方

// ---------- SQL 抽取：从源码 needle 处向两侧找反引号，原样取模板字面量 ----------
const cache = new Map();
function extractSql(file, needle, subst = {}) {
  const p = path.join(REPO, "backend/src", file);
  if (!cache.has(p)) cache.set(p, readFileSync(p, "utf8").replace(/\r\n/g, "\n"));
  const src = cache.get(p);
  const hit = src.indexOf(needle);
  if (hit < 0) throw new Error(`抽取失败（needle 未找到）：${file} :: ${needle}`);
  const start = src.lastIndexOf("`", hit);
  const end = src.indexOf("`", hit);
  if (start < 0 || end < 0) throw new Error(`抽取失败（反引号）：${file}`);
  let sql = src.slice(start + 1, end);
  for (const [k, v] of Object.entries(subst)) {
    if (!sql.includes(k)) throw new Error(`替换失败（${k} 不在 SQL 里）：${file}`);
    sql = sql.split(k).join(v);
  }
  if (sql.includes("${")) throw new Error(`SQL 里仍有未替换的插值：${file}`);
  return sql.replace(/\s+/g, " ").trim();
}

/** 摘掉「绑定到 tenant_id 的值谓词」= 等价改前（旧判据短路 ⇒ 不注入 ⇒ 无租户过滤） */
function stripTenantPredicate(sql) {
  if (/AND\s+[\w.]*tenant_id\s*=\s*\?/.test(sql)) return sql.replace(/AND\s+[\w.]*tenant_id\s*=\s*\?/, "");
  if (/WHERE\s+[\w.]*tenant_id\s*=\s*\?/.test(sql)) return sql.replace(/WHERE\s+[\w.]*tenant_id\s*=\s*\?(?:\s+AND\s+)?/, "WHERE ");
  throw new Error(`无法摘除租户谓词：${sql.slice(0, 120)}`);
}

// ---------- 语句台账（needle 全部取自当前源码，可核对） ----------
const CASES = [
  {
    id: "cart.admin.getCartList", file: "services/admin/cart.service.ts",
    needle: "SELECT c.id, c.sku_id AS skuId", kind: "key",
    // 参数顺序（源码 getCartList 的 [tenantId, customerId]）
    paramsFixed: ["@tenantA", "@memberB"], tenantIdx: 0,
    paramsOwn: ["@tenantA", "@memberA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "cart.admin.addToCart(skuLookup)", file: "services/admin/cart.service.ts",
    needle: "SELECT s.id, s.sku_name FROM t_product_sku s", kind: "key",
    paramsFixed: ["@tenantA", "@skuB"], tenantIdx: 0,
    paramsOwn: ["@tenantA", "@skuA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "cart.admin.checkoutPreview(withSkuIds)", file: "services/admin/cart.service.ts",
    needle: "AND c.sku_id IN (", kind: "key",
    subst: { "${placeholders}": "?" },
    paramsFixed: ["@storeA", "@tenantA", "@memberB", "@skuB"], tenantIdx: 1,
    paramsOwn: ["@storeA", "@tenantA", "@memberA", "@skuA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "cart.admin.checkoutPreview(noSkuIds)", file: "services/admin/cart.service.ts",
    needle: "c.customer_id = ?`", kind: "key",
    paramsFixed: ["@storeA", "@tenantA", "@memberB"], tenantIdx: 1,
    paramsOwn: ["@storeA", "@tenantA", "@memberA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "cart.miniapp.getCartList", file: "services/miniapp/cart.service.ts",
    needle: "SELECT c.id, c.sku_id AS skuId", kind: "key",
    paramsFixed: ["@tenantA", "@memberB"], tenantIdx: 0,
    paramsOwn: ["@tenantA", "@memberA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "cart.miniapp.addToCart(skuLookup)", file: "services/miniapp/cart.service.ts",
    needle: "SELECT s.id, s.sku_name FROM t_product_sku s", kind: "key",
    paramsFixed: ["@tenantA", "@skuB"], tenantIdx: 0,
    paramsOwn: ["@tenantA", "@skuA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "store.member.getMemberDetail", file: "services/store/member.service.ts",
    needle: "FROM t_member m", kind: "key",
    paramsFixed: ["@tenantA", "@memberB"], tenantIdx: 0,
    paramsOwn: ["@tenantA", "@memberA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "transfer.getInTransitOrders", file: "services/transfer-execution.service.ts",
    needle: "to_.status IN ('APPROVED', 'TRANSIT')", kind: "key",
    paramsFixed: ["@tenantA", "@storeB"], tenantIdx: 0,
    paramsOwn: ["@tenantA", "@storeA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "transfer.getMyShipments", file: "services/transfer-execution.service.ts",
    needle: "to_.status IN ('TRANSIT', 'RECEIVED')", kind: "key",
    paramsFixed: ["@tenantA", "@storeB"], tenantIdx: 0,
    paramsOwn: ["@tenantA", "@storeA"],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "approval.listTasks", file: "services/admin/approval-records.service.ts",
    needle: "t.task_status AS taskStatus", kind: "key",
    // 越界键 = B 租户的审批人 7778（A 侧自己的审批人是 7777，作为 V0 正向对照）
    paramsFixed: ["@tenantA", 7778, "PENDING", 20, 0], tenantIdx: 0,
    paramsOwn: ["@tenantA", 7777, "PENDING", 20, 0],
    expectFixed: 0, expectPre: 1
  },
  {
    id: "report.getInventoryTurnover(SUM totalSalesAmount)", file: "services/admin/report/product-report.service.ts",
    needle: "SUM(sbi.total_bottle_qty) AS totalSoldQty", kind: "sum",
    sumAlias: "totalSalesAmount",
    paramsFixed: ["@tenantA", "2020-01-01"], tenantIdx: 0,
    paramsOwn: ["@tenantA", "2020-01-01"],
    expectFixed: null, expectPre: null
  }
];

// ---------- 夹具（幂等；全部带 s210 / B 租户标记，便于识别） ----------
async function seed(conn) {
  const ids = { tenantA: A, tenantB: B };
  const q = async (sql, p = []) => (await conn.query(sql, p))[0];

  const [storeRows] = await conn.query("SELECT id FROM t_store WHERE tenant_id = ? AND store_code = 'S210B'", [B]);
  if (storeRows.length) ids.storeB = storeRows[0].id;
  else ids.storeB = (await q("INSERT INTO t_store (tenant_id, store_code, name, address) VALUES (?, 'S210B', 'S210B店', 'S210B地址')", [B])).insertId;
  const [storeA] = await conn.query("SELECT id FROM t_store WHERE tenant_id = ? ORDER BY id LIMIT 1", [A]);
  ids.storeA = storeA[0].id;

  const [levelB] = await conn.query("SELECT id FROM t_member_level WHERE tenant_id = ? AND level_code = 'S210LV'", [B]);
  if (!levelB.length) await q("INSERT INTO t_member_level (level_code, level_name, tenant_id) VALUES ('S210LV', 'S210等级', ?)", [B]);
  const [mb] = await conn.query("SELECT id FROM t_member WHERE tenant_id = ? AND mobile = '13900009999'", [B]);
  if (mb.length) ids.memberB = mb[0].id;
  else ids.memberB = (await q("INSERT INTO t_member (tenant_id, mobile, level_code, name) VALUES (?, '13900009999', 'S210LV', 'S210B会员')", [B])).insertId;
  const [ma] = await conn.query("SELECT id FROM t_member WHERE tenant_id = ? ORDER BY id LIMIT 1", [A]);
  ids.memberA = ma[0].id;

  const [skuA] = await conn.query("SELECT id FROM t_product_sku WHERE tenant_id = ? ORDER BY id LIMIT 1", [A]);
  ids.skuA = skuA[0].id;

  // B 侧必须自成一条**完整链路**（spu / sku / 价格 / 库存 同属 B 租户）——
  // 否则源句里的 `p.tenant_id = s.tenant_id`、`pp.tenant_id = s.tenant_id` 这类列对列 JOIN 会失败，
  // 造成"越界读不到"的**假绿**（真泄露会被 JOIN 条件掩盖）。
  const [spuB] = await conn.query("SELECT id FROM t_product_spu WHERE tenant_id = ? AND spu_code = 'S210-SPU-B'", [B]);
  const spuIdB = spuB.length
    ? spuB[0].id
    : (await q("INSERT INTO t_product_spu (tenant_id, spu_code, name, category_id, sale_channels, status) VALUES (?, 'S210-SPU-B', 'S210B商品', 1, JSON_ARRAY('ONLINE'), 'ON_SALE')", [B])).insertId;
  // 幂等兜底：早期失败运行建的 spu 可能落在 DRAFT ⇒ 显式断言成 ON_SALE（源句要求 p.status = 'ON_SALE'）
  await q("UPDATE t_product_spu SET status = 'ON_SALE' WHERE id = ? AND tenant_id = ?", [spuIdB, B]);
  const [skuBrow] = await conn.query("SELECT id FROM t_product_sku WHERE tenant_id = ? AND sku_code = 'S210-SKU-B'", [B]);
  ids.skuB = skuBrow.length
    ? skuBrow[0].id
    : (await q("INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, sku_name, base_unit, box_unit, box_ratio, status) VALUES (?, ?, 'S210-SKU-B', 'S210B单品', '瓶', '箱', 6, 1)", [B, spuIdB])).insertId;
  const [priceB] = await conn.query("SELECT id FROM t_product_price WHERE tenant_id = ? AND sku_id = ?", [B, ids.skuB]);
  if (!priceB.length) await q("INSERT INTO t_product_price (tenant_id, sku_id, cost_price, retail_price) VALUES (?, ?, 50.00, 99.00)", [B, ids.skuB]);
  const [invB] = await conn.query("SELECT id FROM t_inventory_balance WHERE tenant_id = ? AND store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'", [B, ids.storeB, ids.skuB]);
  if (!invB.length) await q("INSERT INTO t_inventory_balance (tenant_id, store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty) VALUES (?, ?, ?, 'ONLINE', 10, 0, 10)", [B, ids.storeB, ids.skuB]);

  await conn.query("DELETE FROM t_cart_item WHERE tenant_id IN (?, ?) AND customer_id IN (?, ?) AND sku_id IN (?, ?)", [A, B, ids.memberA, ids.memberB, ids.skuA, ids.skuB]);
  await q("INSERT INTO t_cart_item (tenant_id, customer_id, sku_id, quantity) VALUES (?, ?, ?, 2)", [A, ids.memberA, ids.skuA]);
  await q("INSERT INTO t_cart_item (tenant_id, customer_id, sku_id, quantity) VALUES (?, ?, ?, 3)", [B, ids.memberB, ids.skuB]);

  await conn.query("DELETE FROM t_transfer_order WHERE tenant_id IN (?, ?) AND transfer_no IN ('S210-A','S210-B')", [A, B]);
  await q("INSERT INTO t_transfer_order (tenant_id, transfer_no, from_store_id, to_store_id, status) VALUES (?, 'S210-A', ?, ?, 'TRANSIT')", [A, ids.storeA, ids.storeA]);
  await q("INSERT INTO t_transfer_order (tenant_id, transfer_no, from_store_id, to_store_id, status) VALUES (?, 'S210-B', ?, ?, 'TRANSIT')", [B, ids.storeB, ids.storeB]);

  await conn.query("DELETE FROM t_approval_task WHERE tenant_id IN (?, ?) AND approver_id IN (7777, 7778)", [A, B]);
  await conn.query("DELETE FROM t_approval_instance WHERE tenant_id IN (?, ?) AND instance_no IN ('90001', '90002')", [A, B]);
  await q("INSERT INTO t_approval_instance (tenant_id, instance_no, rule_id, business_type, business_no, business_title, applicant_id, applicant_name) VALUES (?, '90001', 1, 'S210', 'S210-B', 'S210 夹具审批单', 1, 'S210申请人')", [B]);
  await q("INSERT INTO t_approval_task (tenant_id, instance_id, approval_level, approver_id, approver_name, sla_deadline, task_status) VALUES (?, 90001, 1, 7778, 'S210B审批人', '2026-12-31 00:00:00', 'PENDING')", [B]);
  await q("INSERT INTO t_approval_instance (tenant_id, instance_no, rule_id, business_type, business_no, business_title, applicant_id, applicant_name) VALUES (?, '90002', 1, 'S210', 'S210-A', 'S210 夹具审批单(A)', 1, 'S210申请人A')", [A]);
  await q("INSERT INTO t_approval_task (tenant_id, instance_id, approval_level, approver_id, approver_name, sla_deadline, task_status) VALUES (?, 90002, 1, 7777, 'S210A审批人', '2026-12-31 00:00:00', 'PENDING')", [A]);

  return ids;
}

// ---------- 主流程 ----------
const conn = await mysql.createConnection(DB);
const ids = await seed(conn);
const resolve = (v) => (typeof v === "string" && v.startsWith("@") ? ids[v.slice(1)] : v);

const results = [];
let fail = 0;
for (const c of CASES) {
  const sqlFixed = extractSql(c.file, c.needle, c.subst || {});
  const sqlPre = stripTenantPredicate(sqlFixed);
  const paramsFixed = c.paramsFixed.map(resolve);
  const paramsPre = paramsFixed.filter((_, i) => i !== c.tenantIdx);
  // V0 正向对照：同一条语句 + **调用者自己的 A 键** ⇒ 必须命中（证明"0 行"来自租户谓词本身，
  // 而不是 JOIN 根本连不上/表里没数据造成的假绿）。
  const paramsOwn = c.paramsOwn ? c.paramsOwn.map(resolve) : null;

  let v1, v2, err = null;
  let v0 = null;
  try {
    // 计数包装：把内层 SELECT 列表换成 `SELECT 1`（避免 `to_.*` 与别名列重名导致
    // ER_DUP_FIELDNAME —— 派生表不允许重名列）
    const countOf = (sql) => `SELECT COUNT(*) AS c FROM (${sql.replace(/^SELECT\s[\s\S]*?\sFROM\s/i, "SELECT 1 FROM ")}) AS t`;
    if (c.kind === "sum") {
      const sumOf = (sql) => `SELECT COALESCE(SUM(t.${c.sumAlias}), 0) AS v FROM (${sql}) AS t`;
      const [a] = await conn.query(sumOf(sqlFixed), paramsFixed);
      v1 = Number(a[0].v ?? 0);
      const [b2] = await conn.query(sumOf(sqlPre), paramsPre);
      v2 = Number(b2[0].v ?? 0);
    } else {
      if (paramsOwn) {
        const [o] = await conn.query(countOf(sqlFixed), paramsOwn);
        v0 = o[0].c;
      }
      const [a] = await conn.query(countOf(sqlFixed), paramsFixed);
      v1 = a[0].c;
      const [b2] = await conn.query(countOf(sqlPre), paramsPre);
      v2 = b2[0].c;
    }
  } catch (e) {
    err = `${e.code || ""} ${e.message}`.trim();
  }

  const ph = (sqlFixed.match(/\?/g) || []).length;
  const paramOk = ph === paramsFixed.length;
  let verdict;
  if (err) verdict = `⚠️ 执行错误：${err}`;
  else if (!paramOk) verdict = `⚠️ 占位符数(${ph}) ≠ 参数数(${paramsFixed.length})`;
  else if (c.kind === "sum") verdict = v1 > 0 && v2 > v1 ? "PASS（A 键真值>0；摘掉谓词读数变大 ⇒ 谓词承重）" : "⚠️ 读数不符预期";
  else verdict = (v0 === null || v0 >= 1) && v1 === c.expectFixed && v2 >= c.expectPre
    ? "PASS（V0≥1 可达；V1=0 阻断；V2≥1 承重）"
    : "⚠️ 读数不符预期";
  if (!verdict.startsWith("PASS")) fail++;

  results.push({ id: c.id, v0, v1, v2, ph, params: paramsFixed.length, verdict });
}

// 额外：A 侧自身数据的可用性（避免"表里没数据导致全 0 假绿"）
const sanity = [];
const [sa] = await conn.query("SELECT COUNT(*) c FROM t_cart_item WHERE tenant_id = ?", [A]);
const [sb] = await conn.query("SELECT COUNT(*) c FROM t_cart_item WHERE tenant_id = ?", [B]);
sanity.push(`夹具自检：t_cart_item A=${sa[0].c} 行 / B=${sb[0].c} 行`);
const paramRefs = Object.entries(ids).map(([k, v]) => `${k}=${v}`).join(" ");

console.log("== S3-210 逐语句真库对照（A 令牌 vs 越界 B 键；V1=已交付 SQL / V2=摘掉租户谓词）==");
console.log(sanity.join("\n"));
console.log(`夹具 id：${paramRefs}`);
for (const r of results) {
  console.log(`  ${r.verdict.padEnd(34)} ${r.id.padEnd(42)} V0=${r.v0}  V1=${r.v1}  V2=${r.v2}  (占位符 ${r.ph}/参数 ${r.params})`);
}
console.log(`\n==== 探针结束：PASS ${results.length - fail} / FAIL ${fail} ====`);
await conn.end();
process.exitCode = fail ? 1 : 0;
