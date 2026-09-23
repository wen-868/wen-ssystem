/**
 * S3-80 B-2 核验探针：POST /api/sync/offline-orders（服务层 submitOfflineOrders）幂等性 + 反测
 *
 * 被测代码：**仓库现状、零改动的** backend/src/services/sync/delta-sync.service.ts:660-779
 * 数据访问层：backend/src/shared/db 被替换为 SQLite 替身（probe/db-adapter.mjs），
 *             即"真实 SQL 引擎 + 真实 UNIQUE 约束 + 真实事务"，引擎差异见 README.md 的证据边界。
 *
 * 复跑：node --import ./docs/evidence/S3-80-B2/probe/register.mjs docs/evidence/S3-80-B2/probe/01-idempotency-probe.mts
 * （需先设 JWT_SECRET/NODE_ENV/LOG_LEVEL，见同目录 run.ps1）
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { submitOfflineOrders } from "../../../../backend/src/services/sync/delta-sync.service";
import { probeQuery, probeRun, resetLogs, sqlLog, tenantInjectionLog } from "./db-adapter.mjs";

const TENANT_A = "b2-tenant-a";
const TENANT_B = "b2-tenant-b";
const OPERATOR = 7;

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

function item(skuId: number, name: string) {
  return {
    skuId,
    skuName: name,
    boxQty: 1,
    bottleQty: 6,
    totalBottleQty: 6,
    unitPrice: 100,
    priceType: "RETAIL",
    subtotalAmount: 600,
  };
}

function order(draftNo: string, items = [item(1, "示例白酒")]) {
  return {
    draftNo,
    items,
    totalAmount: 600,
    createdAt: "2026-09-23T10:00:00Z",
  };
}

const countBills = (billNo: string) =>
  probeQuery("SELECT COUNT(*) AS c FROM t_sale_bill WHERE bill_no = ?", [billNo])[0].c as number;
const countItems = (billNo: string) =>
  probeQuery("SELECT COUNT(*) AS c FROM t_sale_bill_item WHERE bill_no = ?", [billNo])[0].c as number;
const billRows = (billNo: string) =>
  probeQuery("SELECT bill_no, tenant_id, business_status, collection_status, operator_id FROM t_sale_bill WHERE bill_no = ?", [billNo]);
const itemRows = (billNo: string) =>
  probeQuery("SELECT bill_no, tenant_id, sku_id FROM t_sale_bill_item WHERE bill_no = ?", [billNo]);

// ==================== S0 被测对象身份（防止"探针跑的不是仓库当前代码"） ====================
const SERVICE_PATH = "../../../../backend/src/services/sync/delta-sync.service.ts";
const serviceSource = readFileSync(new URL(SERVICE_PATH, import.meta.url), "utf8");
log("==== S0 被测对象身份 ====");
log(`service 文件字节数 = ${Buffer.byteLength(serviceSource, "utf8")}`);
log(`service sha256 = ${createHash("sha256").update(serviceSource).digest("hex")}`);
log(`service 行数 = ${serviceSource.split(/\r?\n/).length}`);

// ==================== S1 反测A：同一幂等键提交两次（必须只落一单） ====================
log("");
log("==== S1 反测A：同一幂等键提交两次 ====");
const K1 = "B2-IDEM-001";
const first = await submitOfflineOrders([order(K1)], TENANT_A, OPERATOR);
const second = await submitOfflineOrders([order(K1)], TENANT_A, OPERATOR);
log(`第 1 次请求返回：${JSON.stringify(first)}`);
log(`第 2 次请求返回：${JSON.stringify(second)}`);
log(`库内 t_sale_bill 行数 = ${countBills(K1)}，t_sale_bill_item 行数 = ${countItems(K1)}`);
mark("S1-1", "同幂等键第 1 次落单成功", first.successCount === 1, `successCount=${first.successCount}`);
mark("S1-2", "同幂等键第 2 次被拒（未新增行）", second.successCount === 0 && second.failureCount === 1,
  `successCount=${second.successCount}, errorMsg=${second.results[0]?.errorMsg}`);
mark("S1-3", "库内该单号只有 1 行主表", countBills(K1) === 1, `行数=${countBills(K1)}`);
mark("S1-4", "库内该单号明细未翻倍（1 条明细）", countItems(K1) === 1, `明细行数=${countItems(K1)}`);

// ==================== S2 反测B：不同幂等键（必须落两单，证明不是所有请求都被吞掉） ====================
log("");
log("==== S2 反测B：不同幂等键提交两次 ====");
const K2A = "B2-DIFF-001";
const K2B = "B2-DIFF-002";
const r2a = await submitOfflineOrders([order(K2A)], TENANT_A, OPERATOR);
const r2b = await submitOfflineOrders([order(K2B)], TENANT_A, OPERATOR);
log(`A 单号返回：${JSON.stringify(r2a)}`);
log(`B 单号返回：${JSON.stringify(r2b)}`);
log(`库内 K2A = ${countBills(K2A)} 行，K2B = ${countBills(K2B)} 行`);
mark("S2-1", "不同幂等键各自落单", countBills(K2A) === 1 && countBills(K2B) === 1,
  `K2A=${countBills(K2A)}, K2B=${countBills(K2B)}`);
mark("S2-2", "两次请求均返回 success", r2a.successCount === 1 && r2b.successCount === 1,
  `successCount=${r2a.successCount}/${r2b.successCount}`);

// ==================== S3 同一请求内同幂等键重复（错误隔离 + 幂等） ====================
log("");
log("==== S3 同一批次内同幂等键重复 ====");
const K3 = "B2-BATCH-001";
const r3 = await submitOfflineOrders([order(K3), order(K3)], TENANT_A, OPERATOR);
log(`批次返回：${JSON.stringify(r3)}`);
log(`库内行数 = ${countBills(K3)}`);
mark("S3-1", "批内重复键：1 成功 1 失败", r3.successCount === 1 && r3.failureCount === 1,
  `success=${r3.successCount}, failure=${r3.failureCount}`);
mark("S3-2", "批内重复键仍只落 1 行", countBills(K3) === 1, `行数=${countBills(K3)}`);

// ==================== S4 并发同键（先查后插窗口 + 唯一键兜底） ====================
log("");
log("==== S4 并发提交同一幂等键（同时发起 2 个请求） ====");
const K4 = "B2-RACE-001";
const [r4a, r4b] = await Promise.all([
  submitOfflineOrders([order(K4)], TENANT_A, OPERATOR),
  submitOfflineOrders([order(K4)], TENANT_A, OPERATOR),
]);
log(`并发请求 1 返回：${JSON.stringify(r4a)}`);
log(`并发请求 2 返回：${JSON.stringify(r4b)}`);
log(`库内行数 = ${countBills(K4)}`);
mark("S4-1", "并发同键仍只落 1 行", countBills(K4) === 1, `行数=${countBills(K4)}`);
mark("S4-2", "并发同键至少一方失败（另一方成功）",
  r4a.successCount + r4b.successCount === 1,
  `successCount 合计=${r4a.successCount + r4b.successCount}`);
log("※ 证据边界：SQLite 单连接无法完全等价 InnoDB 双连接可见性，本场景只证明『交错提交仍只落 1 行』；");
log("  『唯一键是独立防线』的直接证据在 S5（租户内预检按设计放行后，仍被 uk_sale_bill_no 挡下）。");

// ==================== S5 租户隔离①：同 draftNo 跨租户 ====================
log("");
log("==== S5 租户隔离①：租户 A 先占用该单号，租户 B 提交同单号 ====");
const K5 = "B2-CROSSTENANT-001";
const r5a = await submitOfflineOrders([order(K5)], TENANT_A, OPERATOR);
const r5b = await submitOfflineOrders([order(K5)], TENANT_B, OPERATOR);
log(`租户 A 返回：${JSON.stringify(r5a)}`);
log(`租户 B 返回：${JSON.stringify(r5b)}`);
log(`库内该单号行：${JSON.stringify(billRows(K5))}`);
mark("S5-1", "租户 B 未写入 A 的单（无跨租户写入）", countBills(K5) === 1, `总行数=${countBills(K5)}`);
mark("S5-2", "库内该单号仍属租户 A", billRows(K5)[0]?.tenant_id === TENANT_A,
  `tenant_id=${billRows(K5)[0]?.tenant_id}`);
log(`※ 观察：租户 B 的提交结果是 ${r5b.successCount === 1 ? "成功" : "失败"}，errorMsg=${JSON.stringify(r5b.results[0]?.errorMsg)}`);

// ==================== S6 租户隔离②：不同单号，A/B 各一单；核对主表与明细的 tenant_id ====================
log("");
log("==== S6 租户隔离②：A、B 各自提交不同单号 ====");
const K6A = "B2-ISO-A-001";
const K6B = "B2-ISO-B-001";
await submitOfflineOrders([order(K6A)], TENANT_A, OPERATOR);
await submitOfflineOrders([order(K6B)], TENANT_B, OPERATOR);
log(`主表 A：${JSON.stringify(billRows(K6A))}`);
log(`主表 B：${JSON.stringify(billRows(K6B))}`);
log(`明细 A：${JSON.stringify(itemRows(K6A))}`);
log(`明细 B：${JSON.stringify(itemRows(K6B))}`);
mark("S6-1", "主表 tenant_id 正确（A/B 各归其位）",
  billRows(K6A)[0]?.tenant_id === TENANT_A && billRows(K6B)[0]?.tenant_id === TENANT_B,
  `A=${billRows(K6A)[0]?.tenant_id}, B=${billRows(K6B)[0]?.tenant_id}`);
mark("S6-2", "明细行 tenant_id 与所属租户一致（A 的明细不应落在其它租户名下）",
  itemRows(K6A)[0]?.tenant_id === TENANT_A && itemRows(K6B)[0]?.tenant_id === TENANT_B,
  `明细A.tenant_id=${itemRows(K6A)[0]?.tenant_id}, 明细B.tenant_id=${itemRows(K6B)[0]?.tenant_id}`);

// ==================== S7 写入域清单（只读性/越权写） ====================
// ==================== S8 租户隔离③：customerId 跨租户读取 ====================
log("");
log("==== S8 租户隔离③：带 customerId 提交（租户 A 试图引用租户 B 的客户 id） ====");
probeRun("INSERT INTO t_member (id, tenant_id, name, mobile, customer_type) VALUES (101, ?, '甲租户客户', '13900000001', 'RETAIL')", [TENANT_A]);
probeRun("INSERT INTO t_member (id, tenant_id, name, mobile, customer_type) VALUES (102, ?, '乙租户客户', '13900000002', 'WHOLESALE')", [TENANT_B]);
const K8A = "B2-MEMBER-A-001";
const K8X = "B2-MEMBER-X-001"; // 租户 A 引用租户 B 的客户 102
await submitOfflineOrders([{ ...order(K8A), customerId: 101, customerName: "客户端兜底名" }], TENANT_A, OPERATOR);
await submitOfflineOrders([{ ...order(K8X), customerId: 102, customerName: "客户端兜底名" }], TENANT_A, OPERATOR);
const memberSnapA = probeQuery("SELECT customer_name, customer_mobile, customer_type FROM t_sale_bill WHERE bill_no = ?", [K8A])[0];
const memberSnapX = probeQuery("SELECT customer_name, customer_mobile, customer_type FROM t_sale_bill WHERE bill_no = ?", [K8X])[0];
log(`租户 A 引用自己客户 101 的快照：${JSON.stringify(memberSnapA)}`);
log(`租户 A 引用租户 B 客户 102 的快照：${JSON.stringify(memberSnapX)}`);
mark("S8-1", "租户 A 能取到自己的客户快照", memberSnapA?.customer_name === "甲租户客户",
  `customer_name=${memberSnapA?.customer_name}`);
mark("S8-2", "租户 A 取不到租户 B 的客户（跨租户读取被隔离，回落为客户端兜底值）",
  memberSnapX?.customer_name === "客户端兜底名" && memberSnapX?.customer_mobile === null,
  `customer_name=${memberSnapX?.customer_name}, customer_mobile=${memberSnapX?.customer_mobile}`);

// ==================== S9 写入域清单（只读性/越权写） ====================
log("");
log("==== S9 写入域清单（来自本次全部请求的 SQL 日志） ====");
const writes = sqlLog.filter((s) => s.op === "insert" || s.op === "update" || s.op === "delete");
const writeTargets = [...new Set(writes.map((s) => `${s.op} ${s.table}`))];
log(`本次请求触发的写语句目标：${JSON.stringify(writeTargets)}`);
log(`写语句总条数 = ${writes.length}（其中 update/delete = ${writes.filter((s) => s.op !== "insert").length}）`);
log(`insert 列清单：`);
for (const t of [...new Set(writes.map((s) => s.table))]) {
  const cols = [...new Set(writes.filter((s) => s.table === t).flatMap((s) => s.columns))];
  log(`  - ${t}: ${JSON.stringify(cols)}`);
}
const readTargets = [...new Set(sqlLog.filter((s) => s.op === "select").map((s) => s.table))];
log(`本次请求触发的读语句目标：${JSON.stringify(readTargets)}`);
mark("S9-1", "写操作只涉及 t_sale_bill / t_sale_bill_item",
  writeTargets.every((t) => t === "insert t_sale_bill" || t === "insert t_sale_bill_item"),
  JSON.stringify(writeTargets));
mark("S9-2", "该端点无 UPDATE / DELETE 语句",
  writes.every((s) => s.op === "insert"), `非 insert 写语句数=${writes.filter((s) => s.op !== "insert").length}`);
mark("S9-3", "未写库存/台账等其它业务域",
  !writes.some((s) => /ledger|inventory|stock|balance|payment|member/i.test(String(s.table))),
  JSON.stringify([...new Set(writes.map((s) => s.table))]));
mark("S9-4", "租户条件注入未被触发（SQL 自带 tenant_id）", tenantInjectionLog.length === 0,
  `注入次数=${tenantInjectionLog.length}`);

// ==================== 汇总 ====================
const failed = checks.filter((c) => !c.pass);
log("");
log("==== 汇总 ====");
log(`断言合计 ${checks.length} 条，通过 ${checks.length - failed.length} 条，失败 ${failed.length} 条`);
for (const c of failed) log(`  FAIL ${c.id} ${c.desc} :: ${c.detail}`);

const evidence = {
  generatedAt: new Date().toISOString(),
  engine: "sqlite (node:sqlite DatabaseSync) —— MySQL 的等价替身，差异见 README.md",
  serviceSha256: createHash("sha256").update(serviceSource).digest("hex"),
  checks,
  writeTargets,
  readTargets,
  sql: sqlLog,
};
writeFileSync(new URL("../output-sqlite-probe.json", import.meta.url), JSON.stringify(evidence, null, 2), "utf8");
log("证据 JSON 已写入 docs/evidence/S3-80-B2/output-sqlite-probe.json");

process.exitCode = failed.length === 0 ? 0 : 1;
