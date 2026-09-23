/**
 * B-2b 反测探针 02：回填迁移 docs/migrations/172_sale_bill_item_tenant_backfill.sql
 *  ① 语句必须真的会被 runner 执行（复刻 backend/src/shared/migration.ts 第 8 步切块/过滤）；
 *  ② 只动"应动的行"（子表 tenant_id='default' 且父记录 tenant_id<>'default'），
 *     构造"父记录也是 default"的行作为**不该动**的反例，跑前后逐行对比；
 *  ③ 幂等：第二次执行影响 0 行。
 *
 * 复跑：
 *   node --import ./docs/evidence/B-2b/probe/tenant-id-fix/register.mjs docs/evidence/B-2b/probe/b2b-02-backfill.mts
 *   （或 pwsh -File docs/evidence/B-2b/probe/b2b-run.ps1）
 * 说明：harness 唯一入口＝docs/evidence/B-2b/probe/tenant-id-fix/register.mjs；
 *   probe/ 根目录下的同名副本（register/hooks/db-adapter/schema-sqlite/stub-mock-db.mjs）
 *   已于 2026-09-23 清理，现在不存在。
 *
 * 证据边界：SQL 文本、列默认值、UNIQUE 约束与生产一致；引擎是 SQLite 而非 MySQL(InnoDB)，
 *   故本探针证明的是"SQL 语义只命中应动的行"，不替代生产库执行前备份与跑后核对。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { probeQuery, probeRun } from "./tenant-id-fix/db-adapter.mjs";

const MIGRATION = "../../../migrations/172_sale_bill_item_tenant_backfill.sql";
const REAL_1 = "tenant-real-1";
const REAL_2 = "tenant-real-2";
const REAL_3 = "tenant-real-3";

const checks: Array<{ id: string; desc: string; pass: boolean; detail: string }> = [];
const raw: string[] = [];
function log(line = "") {
  console.log(line);
  raw.push(line);
}
function mark(id: string, desc: string, pass: boolean, detail: string) {
  checks.push({ id, desc, pass, detail });
  log(`[${pass ? "PASS" : "FAIL"}] ${id} ${desc} :: ${detail}`);
}

// ---------- ① 复刻 runner 切块，取出真正会执行的语句 ----------
const sqlText = readFileSync(new URL(MIGRATION, import.meta.url), "utf8");
const statements = sqlText
  .split("\n")
  .filter((line) => {
    const t = line.trim().toUpperCase();
    return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
  })
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

log("==== ① 被测迁移语句（与 runner 实际执行的一致） ====");
log(`迁移文件: docs/migrations/172_sale_bill_item_tenant_backfill.sql`);
log(`runner 切块后保留语句数 = ${statements.length}`);
statements.forEach((s, i) => log(`语句 ${i + 1}: ${s.replace(/\s+/g, " ").trim()}`));
const backfillSql = statements[0];
const verifySql = statements[1];
mark("B0-1", "语句 1 是回填 UPDATE", /^UPDATE\s+t_sale_bill_item\s+SET\s+tenant_id/i.test(backfillSql), backfillSql.slice(0, 60));
mark("B0-2", "保留语句中无 ALTER / CREATE / DROP",
  !/\b(ALTER|CREATE|DROP)\b/i.test(statements.join(" ; ")), `语句数=${statements.length}`);

// ---------- 铺夹具 ----------
probeRun("INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, operator_id) VALUES (?, ?, 0, 7)", [REAL_1, "PB-REAL-1"]);
probeRun("INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, operator_id) VALUES (?, ?, 0, 7)", [REAL_2, "PB-REAL-2"]);
probeRun("INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, operator_id) VALUES (?, ?, 0, 7)", ["default", "PB-DEF-1"]);

const insertItem = (billNo: string, tenantId: string, skuId: number) =>
  probeRun("INSERT INTO t_sale_bill_item (tenant_id, bill_no, sku_id, sku_name, total_bottle_qty, unit_price, price_type, subtotal_amount) VALUES (?, ?, ?, ?, 6, 100, 'RETAIL', 600)",
    [tenantId, billNo, skuId, `SKU-${skuId}`]);

insertItem("PB-REAL-1", "default", 101);   // 应动：父真实租户
insertItem("PB-REAL-1", REAL_1, 102);      // 不该动：已是正确租户
insertItem("PB-REAL-2", "default", 103);   // 应动：父真实租户
insertItem("PB-DEF-1", "default", 104);    // 不该动：父记录也是 default
insertItem("PB-ORPHAN-DEF", "default", 105); // 不该动：没有父记录
insertItem("PB-ORPHAN-REAL", REAL_3, 106);   // 不该动：没有父记录

const snapshot = () =>
  probeQuery("SELECT id, bill_no, tenant_id FROM t_sale_bill_item ORDER BY id") as any[];
const before = snapshot();
log("");
log("==== ② 跑前逐行快照 ====");
for (const r of before) log(`  id=${r.id} bill_no=${r.bill_no} tenant_id=${r.tenant_id}`);

// ---------- ② 执行回填，逐行对比 ----------
const runResult = probeRun(backfillSql);
const after = snapshot();
log("");
log("==== ② 执行回填后逐行快照（含前后对比） ====");
const changed: Array<{ id: number; billNo: string; from: string; to: string }> = [];
for (let i = 0; i < before.length; i++) {
  const b = before[i];
  const a = after[i];
  const same = b.tenant_id === a.tenant_id;
  if (!same) changed.push({ id: b.id, billNo: b.bill_no, from: b.tenant_id, to: a.tenant_id });
  log(`  id=${b.id} bill_no=${b.bill_no} ${b.tenant_id} -> ${a.tenant_id} ${same ? "(未变)" : "(已改)"}`);
}
log(`SQLite 报告受影响行数 = ${runResult.changes}`);

const expectedChanged = [
  { billNo: "PB-REAL-1", skuId: 101, to: REAL_1 },
  { billNo: "PB-REAL-2", skuId: 103, to: REAL_2 },
];
const changedBySku = (billNo: string, skuId: number) => {
  const row = probeQuery("SELECT id, tenant_id FROM t_sale_bill_item WHERE bill_no = ? AND sku_id = ?", [billNo, skuId]) as any[];
  return row[0];
};
const untouched = [
  { desc: "父记录也是 default 的行（反例）", billNo: "PB-DEF-1", skuId: 104, expect: "default" },
  { desc: "已有正确租户的行", billNo: "PB-REAL-1", skuId: 102, expect: REAL_1 },
  { desc: "无父记录且 default 的行", billNo: "PB-ORPHAN-DEF", skuId: 105, expect: "default" },
  { desc: "无父记录且真实租户的行", billNo: "PB-ORPHAN-REAL", skuId: 106, expect: REAL_3 },
];

mark("B1-1", "只有 2 行被改（应动的行）", changed.length === 2,
  `改动行=${JSON.stringify(changed)}`);
mark("B1-2", "父真实租户 + 明细 default 的行已回填为父租户",
  expectedChanged.every((e) => changedBySku(e.billNo, e.skuId)?.tenant_id === e.to),
  expectedChanged.map((e) => `${e.billNo}#${e.skuId}=${changedBySku(e.billNo, e.skuId)?.tenant_id}`).join(", "));
for (const u of untouched) {
  const row = changedBySku(u.billNo, u.skuId);
  mark(`B1-3`, `不该动：${u.desc}`, row?.tenant_id === u.expect,
    `${u.billNo}#${u.skuId} tenant_id=${row?.tenant_id}（期望 ${u.expect}）`);
}

// ---------- 跑后核对 SQL（迁移文件第 2 条语句） ----------
const mismatchRows = probeQuery(verifySql) as any[];
log("");
log(`跑后核对 SELECT（迁移文件语句 2）: ${JSON.stringify(mismatchRows)}`);
mark("B2-1", "跑后核对：明细 default 而父非 default 的残差 = 0",
  Number(mismatchRows[0]?.mismatch_remaining) === 0, `mismatch_remaining=${mismatchRows[0]?.mismatch_remaining}`);

// ---------- ③ 幂等：再跑一次影响 0 行 ----------
const secondRun = probeRun(backfillSql);
const after2 = snapshot();
const changed2 = after2.filter((r, i) => r.tenant_id !== after[i].tenant_id);
log("");
log("==== ③ 第二次执行同一回填 SQL（幂等） ====");
log(`第二次受影响行数 = ${secondRun.changes}；与第一次结果逐行对比：变化行数 = ${changed2.length}`);
mark("B3-1", "第二次执行影响 0 行", Number(secondRun.changes) === 0, `changes=${secondRun.changes}`);
mark("B3-2", "第二次执行后逐行结果与第一次完全一致", changed2.length === 0, `变化行=${changed2.length}`);

// ---------- 汇总 ----------
const failed = checks.filter((c) => !c.pass);
log("");
log(`==== 汇总：${checks.length - failed.length}/${checks.length} 通过 ====`);
for (const f of failed) log(`FAIL ${f.id} ${f.desc} :: ${f.detail}`);

const jsonPath = new URL("../b2b-output-backfill-probe.json", import.meta.url);
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      migrationFile: "docs/migrations/172_sale_bill_item_tenant_backfill.sql",
      executedStatements: statements,
      fixtureBefore: before,
      fixtureAfter: after,
      changed,
      secondRunChanges: Number(secondRun.changes),
      boundary: "SQLite 语义级复现（列默认值/UNIQUE/单语句语义同构）；锁粒度与隔离级别同 InnoDB 不同",
      totals: { checks: checks.length, failed: failed.length },
      checks,
      raw,
    },
    null,
    2
  )
);
log(`JSON 证据已写入 ${jsonPath.pathname}`);

process.exitCode = failed.length === 0 ? 0 : 1;
