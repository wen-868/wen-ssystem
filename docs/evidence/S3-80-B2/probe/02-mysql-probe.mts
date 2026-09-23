/**
 * S3-80 B-2 核验探针（**真库版**，交由凌舟在本机/服务器执行）
 *
 * 与 01 探针的区别：**不打任何替身**——直接加载仓库真实的
 *   - backend/src/services/sync/delta-sync.service.ts（submitOfflineOrders）
 *   - backend/src/shared/db（真实 mysql2 连接池）
 * 因此这是"POST /api/sync/offline-orders 幂等性"的**生产同构**证据；01 探针只是它的沙箱可跑版本。
 *
 * 复跑（在 backend 目录下，保证读到 backend/.env；或先显式设置 DB_HOST 等变量与 JWT_SECRET）：
 *   cd backend
 *   node --import ../docs/evidence/S3-80-B2/probe/register-real-mysql.mjs ../docs/evidence/S3-80-B2/probe/02-mysql-probe.mts
 *   # 若本机 Node < 22.18（不支持直接跑 .ts），改用： npx tsx ../docs/evidence/S3-80-B2/probe/02-mysql-probe.mts
 *
 * 前置：USE_MOCK_DB 不能为 true（否则探针直接退出，避免"在 mock 上验证真库结论"）。
 * 副作用：只写/删单号前缀为 `B2M-PROBE-` 的行，收尾无论成败都会清理并复验残留=0。
 */
import { writeFileSync } from "node:fs";
import { submitOfflineOrders } from "../../../../backend/src/services/sync/delta-sync.service";
import { pool, query } from "../../../../backend/src/shared/db";
import { env as appEnv } from "../../../../backend/src/config/env";

const TENANT_A = "b2-mysql-a";
const TENANT_B = "b2-mysql-b";
const OPERATOR = 1;
const PREFIX = "B2M-PROBE-";

const checks: Array<{ id: string; desc: string; pass: boolean; detail: string }> = [];
const raw: string[] = [];
const log = (l = "") => { console.log(l); raw.push(l); };
const mark = (id: string, desc: string, pass: boolean, detail: string) => {
  checks.push({ id, desc, pass, detail });
  log(`[${pass ? "PASS" : "FAIL"}] ${id} ${desc} :: ${detail}`);
};

const item = () => ({
  skuId: 1, skuName: "B2 探针商品", boxQty: 1, bottleQty: 6, totalBottleQty: 6,
  unitPrice: 100, priceType: "RETAIL", subtotalAmount: 600,
});
const order = (draftNo: string) => ({ draftNo, items: [item()], totalAmount: 600, createdAt: "2026-09-23T10:00:00Z" });

async function countBill(billNo: string) {
  const rows = await query<{ c: number }>("SELECT COUNT(*) AS c FROM t_sale_bill WHERE bill_no = ?", [billNo]);
  return Number(rows[0]?.c ?? -1);
}
async function billRow(billNo: string) {
  const rows = await query<Record<string, unknown>>(
    "SELECT bill_no, tenant_id, business_status, collection_status FROM t_sale_bill WHERE bill_no = ?", [billNo]);
  return rows[0] ?? null;
}
async function itemRows(billNo: string) {
  return query<Record<string, unknown>>("SELECT bill_no, tenant_id FROM t_sale_bill_item WHERE bill_no = ?", [billNo]);
}

async function main() {
  log("==== P0 环境与前置 ====");
  log(`DB_HOST=${appEnv.DB_HOST} DB_NAME=${appEnv.DB_NAME} USE_MOCK_DB=${appEnv.USE_MOCK_DB}`);
  if (appEnv.USE_MOCK_DB) {
    log("!! USE_MOCK_DB=true：mock 库不支持写语句，本探针结论无效，直接退出。");
    process.exitCode = 2;
    return;
  }
  const ident = await query<Record<string, unknown>>("SELECT DATABASE() AS db, VERSION() AS ver, @@transaction_isolation AS iso");
  log(`库身份：${JSON.stringify(ident[0])}`);

  log("");
  log("==== P1 约束/默认值现状（只读 information_schema） ====");
  const idx = await query<Record<string, unknown>>(
    `SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_sale_bill'
      GROUP BY INDEX_NAME, NON_UNIQUE`,
    [appEnv.DB_NAME]
  );
  log(`t_sale_bill 索引：${JSON.stringify(idx)}`);
  const uniqOnBillNo = idx.some((r) => Number(r.NON_UNIQUE) === 0 && String(r.cols) === "bill_no");
  mark("P1-1", "t_sale_bill 存在唯一键且列就是 bill_no（不含 tenant_id）", uniqOnBillNo, JSON.stringify(idx.filter((r) => Number(r.NON_UNIQUE) === 0)));

  const colDefault = await query<Record<string, unknown>>(
    `SELECT COLUMN_DEFAULT, IS_NULLABLE, COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_sale_bill_item' AND COLUMN_NAME = 'tenant_id'`,
    [appEnv.DB_NAME]
  );
  log(`t_sale_bill_item.tenant_id 列定义：${JSON.stringify(colDefault[0])}`);
  mark("P1-2", "t_sale_bill_item.tenant_id 默认值为 'default'", String(colDefault[0]?.COLUMN_DEFAULT) === "default",
    `COLUMN_DEFAULT=${colDefault[0]?.COLUMN_DEFAULT}`);

  log("");
  log("==== P2 反测A：同一幂等键提交两次 ====");
  const K1 = `${PREFIX}IDEM-001`;
  const first = await submitOfflineOrders([order(K1)], TENANT_A, OPERATOR);
  const second = await submitOfflineOrders([order(K1)], TENANT_A, OPERATOR);
  log(`第 1 次返回：${JSON.stringify(first)}`);
  log(`第 2 次返回：${JSON.stringify(second)}`);
  log(`库内主表行数 = ${await countBill(K1)}，明细行数 = ${(await itemRows(K1)).length}`);
  mark("P2-1", "同幂等键只落一单（主表 1 行）", (await countBill(K1)) === 1, `行数=${await countBill(K1)}`);
  mark("P2-2", "第二次被拒且给出 errorMsg", second.successCount === 0, `errorMsg=${second.results[0]?.errorMsg}`);

  log("");
  log("==== P3 反测B：不同幂等键 ====");
  const K2A = `${PREFIX}DIFF-001`;
  const K2B = `${PREFIX}DIFF-002`;
  await submitOfflineOrders([order(K2A)], TENANT_A, OPERATOR);
  await submitOfflineOrders([order(K2B)], TENANT_A, OPERATOR);
  mark("P3-1", "不同幂等键各落一单", (await countBill(K2A)) === 1 && (await countBill(K2B)) === 1,
    `K2A=${await countBill(K2A)}, K2B=${await countBill(K2B)}`);

  log("");
  log("==== P4 租户隔离①：同单号跨租户 ====");
  const K4 = `${PREFIX}CROSS-001`;
  const r4a = await submitOfflineOrders([order(K4)], TENANT_A, OPERATOR);
  const r4b = await submitOfflineOrders([order(K4)], TENANT_B, OPERATOR);
  log(`租户 A 返回：${JSON.stringify(r4a)}`);
  log(`租户 B 返回：${JSON.stringify(r4b)}`);
  log(`库内该单号行：${JSON.stringify(await billRow(K4))}`);
  mark("P4-1", "租户 B 未写入（仍只有 1 行）", (await countBill(K4)) === 1, `行数=${await countBill(K4)}`);
  mark("P4-2", "该单仍属租户 A", (await billRow(K4))?.tenant_id === TENANT_A, `tenant_id=${(await billRow(K4))?.tenant_id}`);
  if (r4b.successCount === 0) {
    log(`※ 观察：租户 B 因 uk_sale_bill_no（全局唯一）被拒，errorMsg=${JSON.stringify(r4b.results[0]?.errorMsg)}`);
  }

  log("");
  log("==== P5 租户隔离②：明细行 tenant_id（本次核验发现的红点） ====");
  const K5A = `${PREFIX}ISO-A-001`;
  const K5B = `${PREFIX}ISO-B-001`;
  await submitOfflineOrders([order(K5A)], TENANT_A, OPERATOR);
  await submitOfflineOrders([order(K5B)], TENANT_B, OPERATOR);
  const itA = await itemRows(K5A);
  const itB = await itemRows(K5B);
  log(`明细 A：${JSON.stringify(itA)}`);
  log(`明细 B：${JSON.stringify(itB)}`);
  mark("P5-1", "明细行 tenant_id 与所属租户一致", itA[0]?.tenant_id === TENANT_A && itB[0]?.tenant_id === TENANT_B,
    `明细A=${itA[0]?.tenant_id}, 明细B=${itB[0]?.tenant_id}`);

  log("");
  log("==== P6 清理（只删本探针前缀行） ====");
  const delItems = await query<Record<string, unknown>>("DELETE FROM t_sale_bill_item WHERE bill_no LIKE ?", [`${PREFIX}%`]);
  const delBills = await query<Record<string, unknown>>("DELETE FROM t_sale_bill WHERE bill_no LIKE ?", [`${PREFIX}%`]);
  log(`删除明细 affected=${JSON.stringify((delItems as any)[0]?.affectedRows)}，主表 affected=${JSON.stringify((delBills as any)[0]?.affectedRows)}`);
  const leftover = await query<{ c: number }>("SELECT COUNT(*) AS c FROM t_sale_bill WHERE bill_no LIKE ?", [`${PREFIX}%`]);
  mark("P6-1", "探针数据已清理干净", Number(leftover[0]?.c ?? -1) === 0, `残留=${leftover[0]?.c}`);
}

try {
  await main();
} catch (err) {
  log("");
  log(`!! 探针中止：${String((err as Error)?.message ?? err)}`);
  log(`   常见原因：本机/容器无可用 MySQL（ECONNREFUSED 127.0.0.1:3306）→ 请在有 .env 指向真库的机器上重跑。`);
  process.exitCode = 3;
} finally {
  const failed = checks.filter((c) => !c.pass);
  log("");
  log("==== 汇总 ====");
  log(`断言合计 ${checks.length} 条，通过 ${checks.length - failed.length} 条，失败 ${failed.length} 条`);
  for (const c of failed) log(`  FAIL ${c.id} ${c.desc} :: ${c.detail}`);
  if (checks.length > 0) {
    try {
      writeFileSync(new URL("../output-mysql-probe.json", import.meta.url),
        JSON.stringify({ generatedAt: new Date().toISOString(), engine: "mysql (real)", checks }, null, 2), "utf8");
      log("证据 JSON 已写入 docs/evidence/S3-80-B2/output-mysql-probe.json");
    } catch (e) {
      log(`证据 JSON 写入失败：${String(e)}`);
    }
  }
  if (process.exitCode === undefined || process.exitCode === 0) {
    process.exitCode = failed.length === 0 ? 0 : 1;
  }
  // 收起连接池并显式退出：避免 mysql2 池的空闲句柄把进程挂住（真库/无库场景都会走到这里）
  try {
    await (pool as unknown as { end: () => Promise<void> }).end();
  } catch {
    /* 无库时 end() 也可能抛错，忽略 */
  }
  process.exit(process.exitCode ?? 1);
}
