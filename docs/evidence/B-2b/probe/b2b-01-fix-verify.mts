/**
 * B-2b 反测探针 01：明细类写入补 tenant_id 的修复验证 + 离线重复提交幂等成功
 *
 * 被测代码：仓库真实业务代码，零改动
 *   - backend/src/services/store/sale-bill.service.ts  （主干道开单 createSaleBill）
 *   - backend/src/services/sync/delta-sync.service.ts  （离线同步 submitOfflineOrders）
 * 数据访问层：backend/src/shared/db 被替换为 SQLite 替身
 *   （harness 唯一入口 probe/tenant-id-fix/register.mjs，替身模块 probe/tenant-id-fix/db-adapter.mjs），
 *   真实 SQL 引擎 + 真实 UNIQUE 约束 + 真实事务 + 真实列默认值。
 *
 * 复跑：
 *   node --import ./docs/evidence/B-2b/probe/tenant-id-fix/register.mjs docs/evidence/B-2b/probe/b2b-01-fix-verify.mts
 *   （或 pwsh -File docs/evidence/B-2b/probe/b2b-run.ps1）
 * 说明：harness 唯一入口＝docs/evidence/B-2b/probe/tenant-id-fix/register.mjs；
 *   probe/ 根目录下的同名副本（register/hooks/db-adapter/schema-sqlite/stub-mock-db.mjs）
 *   已于 2026-09-23 清理，现在不存在。
 *
 * 证据边界（必须随结论一起引用）：引擎由 MySQL(InnoDB) 换成 SQLite，
 *   列默认值 / UNIQUE 约束 / 事务语义同构，但锁粒度、隔离级别、DECIMAL 精度不同。
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { submitOfflineOrders } from "../../../../backend/src/services/sync/delta-sync.service";
import { createSaleBill } from "../../../../backend/src/services/store/sale-bill.service";
import { probeQuery, probeRun, resetLogs, sqlLog } from "./tenant-id-fix/db-adapter.mjs";

const TENANT_A = "ten-real-A-0001";
const OPERATOR = 7;
const SERVICE_SALE_BILL = "../../../../backend/src/services/store/sale-bill.service.ts";
const SERVICE_DELTA_SYNC = "../../../../backend/src/services/sync/delta-sync.service.ts";

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

function offlineItem(skuId: number, name: string) {
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

function order(draftNo: string) {
  return { draftNo, items: [offlineItem(1, "示例白酒")], totalAmount: 600, createdAt: "2026-09-23T10:00:00Z" };
}

const itemRowsOf = (billNo: string) =>
  probeQuery("SELECT id, bill_no, tenant_id, sku_id FROM t_sale_bill_item WHERE bill_no = ? ORDER BY id", [billNo]) as any[];
const billRowsOf = (billNo: string) =>
  probeQuery("SELECT id, bill_no, tenant_id FROM t_sale_bill WHERE bill_no = ?", [billNo]) as any[];

// ==================== S0 被测对象身份（防止探针跑的不是当前代码） ====================
log("==== S0 被测对象身份 ====");
for (const rel of [SERVICE_SALE_BILL, SERVICE_DELTA_SYNC]) {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  log(`${rel} 字节=${Buffer.byteLength(src, "utf8")} 行数=${src.split(/\r?\n/).length} sha256=${createHash("sha256").update(src).digest("hex")}`);
}
const saleBillSrc = readFileSync(new URL(SERVICE_SALE_BILL, import.meta.url), "utf8");
const deltaSrc = readFileSync(new URL(SERVICE_DELTA_SYNC, import.meta.url), "utf8");
log(`sale-bill 明细 INSERT 列清单含 tenant_id = ${/item_discount, trace_codes, tenant_id\)/.test(saleBillSrc)}`);
log(`delta-sync 明细 INSERT 列清单含 tenant_id = ${/subtotal_amount, tenant_id/.test(deltaSrc)}`);

// ==================== S1 反测：修复前的 INSERT 必须能看出缺陷 ====================
log("");
log("==== S1 反测：用修复前的明细 INSERT 落库（应当写出 default） ====");
probeRun(
  "INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, operator_id, customer_type, sale_type, business_status, collection_status, goods_amount, receivable_amount) VALUES (?, ?, 0, ?, 'RETAIL', 'CASH', 'CREATED', 'UNPAID', 600, 600)",
  [TENANT_A, "B2B-LEGACY-001", OPERATOR]
);
const LEGACY_ITEM_INSERT = `INSERT INTO t_sale_bill_item (bill_no, sku_id, sku_name, sku_spec, unit, barcode,
                box_qty, bottle_qty, total_bottle_qty, unit_price, price_type, subtotal_amount,
                item_remark, item_discount, trace_codes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
probeRun(LEGACY_ITEM_INSERT, [
  "B2B-LEGACY-001", 1, "示例白酒", null, "瓶", null, 1, 6, 6, 100, "RETAIL", 600, null, 0, null,
]);
const legacyItem = itemRowsOf("B2B-LEGACY-001")[0];
log(`修复前 INSERT 落库结果: ${JSON.stringify(legacyItem)}`);
mark("S1-1", "反测有效：修复前的明细 INSERT 静默落 tenant_id=default",
  legacyItem?.tenant_id === "default", `tenant_id=${legacyItem?.tenant_id}`);

// ==================== S2 主干道 createSaleBill：新写入明细必须带本租户 ====================
log("");
log("==== S2 主干道 createSaleBill（sale-bill.service.ts） ====");
probeRun("INSERT INTO t_member (tenant_id, name, mobile, customer_type) VALUES (?, ?, ?, ?)", [TENANT_A, "张三", "13800000001", "RETAIL"]);
const memberId = (probeQuery("SELECT id FROM t_member WHERE tenant_id = ? AND mobile = ?", [TENANT_A, "13800000001"])[0] as any).id;
probeRun("INSERT INTO t_product_sku (tenant_id, sku_name, volume, packaging, base_unit, barcode) VALUES (?, ?, ?, ?, ?, ?)",
  [TENANT_A, "示例白酒", "500ml", "瓶装", "瓶", "6900000000001"]);
const skuId = (probeQuery("SELECT id FROM t_product_sku WHERE tenant_id = ?", [TENANT_A])[0] as any).id;
probeRun("INSERT INTO t_product_price (tenant_id, sku_id, retail_price, wholesale_price, store_price) VALUES (?, ?, ?, ?, ?)",
  [TENANT_A, skuId, 100, 80, 90]);

const created = await createSaleBill({
  storeId: 1,
  customerId: memberId,
  customerName: "张三",
  customerMobile: "13800000001",
  discountAmount: 0,
  roundingAmount: 0,
  saleType: "CASH",
  items: [{ skuId, boxQty: 1, bottleQty: 6, totalBottleQty: 6 }],
  userId: OPERATOR,
  tenantId: TENANT_A,
});
log(`createSaleBill 返回 billNo = ${created.billNo}`);
const mainBill = billRowsOf(created.billNo)[0];
const mainItems = itemRowsOf(created.billNo);
log(`主表: ${JSON.stringify(mainBill)}`);
log(`明细: ${JSON.stringify(mainItems)}`);
mark("S2-1", "主干道主表带本租户", mainBill?.tenant_id === TENANT_A, `header tenant_id=${mainBill?.tenant_id}`);
mark("S2-2", "主干道明细带本租户（修复点 1）",
  mainItems.length > 0 && mainItems.every((r) => r.tenant_id === TENANT_A),
  `明细 tenant_id=${JSON.stringify(mainItems.map((r) => r.tenant_id))}`);
mark("S2-3", "主干道明细不再落 default",
  mainItems.every((r) => r.tenant_id !== "default"), `明细行数=${mainItems.length}`);

// ==================== S3 离线同步 submitOfflineOrders：明细必须带本租户 ====================
log("");
log("==== S3 离线同步 submitOfflineOrders（delta-sync.service.ts） ====");
resetLogs();
const K1 = "B2B-OFFLINE-001";
const r1 = await submitOfflineOrders([order(K1)], TENANT_A, OPERATOR);
log(`第 1 次提交返回：${JSON.stringify(r1)}`);
const offBill1 = billRowsOf(K1)[0];
const offItems1 = itemRowsOf(K1);
log(`主表: ${JSON.stringify(offBill1)}  明细: ${JSON.stringify(offItems1)}`);
mark("S3-1", "离线同步主表带本租户", offBill1?.tenant_id === TENANT_A, `header tenant_id=${offBill1?.tenant_id}`);
mark("S3-2", "离线同步明细带本租户（修复点 2）",
  offItems1.length > 0 && offItems1.every((r) => r.tenant_id === TENANT_A),
  `明细 tenant_id=${JSON.stringify(offItems1.map((r) => r.tenant_id))}`);
const itemInserts = sqlLog.filter((e) => e.op === "insert" && e.table === "t_sale_bill_item");
log(`本次提交的明细 INSERT 列清单: ${JSON.stringify(itemInserts.map((e) => e.columns))}`);
mark("S3-3", "离线同步明细 INSERT 列清单已含 tenant_id",
  itemInserts.length > 0 && itemInserts.every((e) => e.columns.map((c) => c.toLowerCase()).includes("tenant_id")),
  `列清单=${JSON.stringify(itemInserts.map((e) => e.columns))}`);

// ==================== S4 重复提交同一幂等键，必须幂等成功（裁定 3） ====================
log("");
log("==== S4 同一幂等键重复提交（第 2 次必须 success=true 且 billNo 一致） ====");
const r2 = await submitOfflineOrders([order(K1)], TENANT_A, OPERATOR);
log(`第 2 次提交返回：${JSON.stringify(r2)}`);
log(`库内主表行数=${billRowsOf(K1).length}，明细行数=${itemRowsOf(K1).length}`);
mark("S4-1", "第 2 次提交 success=true", r2.results[0]?.success === true, `success=${r2.results[0]?.success}`);
mark("S4-2", "第 2 次提交无 errorMsg", r2.results[0]?.errorMsg === undefined, `errorMsg=${r2.results[0]?.errorMsg}`);
mark("S4-3", "两次返回的 billNo 一致（等于既有单号）",
  r1.results[0]?.billNo === r2.results[0]?.billNo && r2.results[0]?.billNo === K1,
  `第1次=${r1.results[0]?.billNo}, 第2次=${r2.results[0]?.billNo}`);
mark("S4-4", "第 2 次提交 successCount=1 / failureCount=0", r2.successCount === 1 && r2.failureCount === 0,
  `successCount=${r2.successCount}, failureCount=${r2.failureCount}`);
mark("S4-5", "重复提交未新增行（主表 1 行 / 明细 1 行）",
  billRowsOf(K1).length === 1 && itemRowsOf(K1).length === 1,
  `主表=${billRowsOf(K1).length}, 明细=${itemRowsOf(K1).length}`);

// ==================== S5 反测：不同幂等键仍各自落单 ====================
log("");
log("==== S5 反测：不同幂等键各落一单（证明不是所有请求都被吞掉） ====");
const r3a = await submitOfflineOrders([order("B2B-DIFF-001")], TENANT_A, OPERATOR);
const r3b = await submitOfflineOrders([order("B2B-DIFF-002")], TENANT_A, OPERATOR);
mark("S5-1", "不同幂等键各自落单",
  billRowsOf("B2B-DIFF-001").length === 1 && billRowsOf("B2B-DIFF-002").length === 1,
  `A=${billRowsOf("B2B-DIFF-001").length}, B=${billRowsOf("B2B-DIFF-002").length}`);
mark("S5-2", "两次请求均 successCount=1", r3a.successCount === 1 && r3b.successCount === 1,
  `${r3a.successCount}/${r3b.successCount}`);

// ==================== S6 反测：跨租户读隔离 ====================
log("");
log("==== S6 反测：跨租户读隔离 ====");
const otherTenantItems = probeQuery("SELECT id FROM t_sale_bill_item WHERE bill_no = ? AND tenant_id = ?", [created.billNo, "ten-real-B-0002"]);
const ownTenantItems = probeQuery("SELECT id FROM t_sale_bill_item WHERE bill_no = ? AND tenant_id = ?", [created.billNo, TENANT_A]);
log(`他租户可见行数=${otherTenantItems.length}，本租户可见行数=${ownTenantItems.length}`);
mark("S6-1", "按租户过滤读明细：本租户可见、他租户不可见",
  otherTenantItems.length === 0 && ownTenantItems.length > 0,
  `他租户=${otherTenantItems.length}, 本租户=${ownTenantItems.length}`);

// ==================== 汇总 ====================
const failed = checks.filter((c) => !c.pass);
log("");
log(`==== 汇总：${checks.length - failed.length}/${checks.length} 通过 ====`);
for (const f of failed) log(`FAIL ${f.id} ${f.desc} :: ${f.detail}`);

const jsonPath = new URL("../b2b-output-fix-verify.json", import.meta.url);
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      engine: "SQLite (node:sqlite) 替身替换 backend/src/shared/db",
      boundary: "MySQL(InnoDB) 换成 SQLite：列默认值/UNIQUE/事务语义同构；锁粒度、隔离级别、DECIMAL 精度不同",
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
