import { beforeEach, describe, expect, it } from "vitest";
import { mockQuery, mockExecute, resetMockDb } from "../shared/mock-db.js";
import { makeBizNo } from "../shared/id.js";

async function ensureInventory(
  storeId: number,
  skuId: number,
  stockType: string = "OFFLINE",
  physicalQty: number = 0
) {
  const existing = await mockQuery<any>(
    `SELECT * FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
    [storeId, skuId, stockType]
  );
  if (existing.length === 0) {
    await mockExecute(
      `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, sku_name) VALUES (?,?,?,?,?)`,
      [storeId, skuId, stockType, physicalQty, `SKU-${skuId}`]
    );
  } else if (physicalQty !== 0) {
    await mockExecute(
      `UPDATE inventory_balance SET physical_qty = ?, available_qty = ? WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
      [physicalQty, physicalQty, storeId, skuId, stockType]
    );
  }
}

async function createSaleReturn(input: {
  storeId: number;
  customerId: number;
  customerName: string;
  items: { skuId: number; skuName?: string; qty: number; unitPrice: number }[];
  remark?: string;
}) {
  if (input.items.length === 0) throw new Error("退货单至少需要 1 条明细");
  if (input.items.some((it) => it.qty <= 0 || it.unitPrice < 0)) throw new Error("数量必须为正、单价不可为负");
  const returnNo = makeBizNo("TH");
  const totalAmount = Math.round(input.items.reduce((s, it) => s + it.qty * it.unitPrice, 0) * 100) / 100;
  await mockExecute(
    `INSERT INTO sale_return (return_no, store_id, customer_id, customer_name, total_amount, remark) VALUES (?,?,?,?,?,?)`,
    [returnNo, input.storeId, input.customerId, input.customerName, totalAmount, input.remark ?? null]
  );
  for (const it of input.items) {
    const subtotal = Math.round(it.qty * it.unitPrice * 100) / 100;
    await mockExecute(
      `INSERT INTO sale_return_item (return_no, sku_id, sku_name, qty, unit_price, subtotal_amount) VALUES (?,?,?,?,?,?)`,
      [returnNo, it.skuId, it.skuName ?? `SKU-${it.skuId}`, it.qty, it.unitPrice, subtotal]
    );
  }
  const rows = await mockQuery<any>(
    `SELECT return_no AS returnNo, store_id AS storeId, customer_id AS customerId, customer_name AS customerName, total_amount AS totalAmount, status, stock_rollback_flag AS stockRollbackFlag, auditor_id AS auditorId, audit_time AS auditTime FROM sale_return WHERE return_no = ?`,
    [returnNo]
  );
  return rows[0];
}

async function auditSaleReturn(returnNo: string, auditorId: number = 1) {
  const rows = await mockQuery<any>(`SELECT status, store_id AS storeId FROM sale_return WHERE return_no = ?`, [returnNo]);
  if (rows.length === 0) throw new Error("退货单不存在");
  if (rows[0].status === "AUDITED") throw new Error("退货单已审核");
  const storeId = Number(rows[0].storeId);
  await mockExecute(
    `UPDATE sale_return SET status = ?, auditor_id = ?, audit_time = ?, stock_rollback_flag = ? WHERE return_no = ?`,
    ["AUDITED", auditorId, new Date().toISOString(), 1, returnNo]
  );
  const items = await mockQuery<any>(
    `SELECT sku_id AS skuId, qty AS qty, sku_name AS skuName FROM sale_return_item WHERE return_no = ?`,
    [returnNo]
  );
  for (const it of items) {
    await ensureInventory(storeId, Number(it.skuId), "OFFLINE", 0);
    await mockExecute(
      `UPDATE inventory_balance SET physical_qty = ?, available_qty = ? WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
      [Number(it.qty), Number(it.qty), storeId, Number(it.skuId), "OFFLINE"]
    );
  }
  const after = await mockQuery<any>(
    `SELECT status, auditor_id AS auditorId, stock_rollback_flag AS stockRollbackFlag FROM sale_return WHERE return_no = ?`,
    [returnNo]
  );
  return after[0];
}

function getPhysicalQty(storeId: number, skuId: number, stockType: string = "OFFLINE") {
  return mockQuery<any>(
    `SELECT * FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
    [storeId, skuId, stockType]
  ).then((rows) => (rows.length > 0 ? Number(rows[0].physicalQty) : 0));
}

describe("销售退货", () => {
  beforeEach(() => resetMockDb());

  it("创建退货单 - 正常：单号、金额正确累加", async () => {
    const ret = await createSaleReturn({
      storeId: 1, customerId: 100, customerName: "客户A",
      items: [
        { skuId: 40, qty: 2, unitPrice: 100 },
        { skuId: 41, qty: 3, unitPrice: 50 }
      ]
    });
    expect(String(ret.returnNo)).toMatch(/^TH\d{14}[A-F0-9]{6}$/);
    expect(Number(ret.totalAmount)).toBeCloseTo(2 * 100 + 3 * 50, 2);
    expect(ret.status).toBe("DRAFT");
    expect(Number(ret.stockRollbackFlag)).toBe(0);
  });

  it("创建退货单 - 边界：qty=1 最小数量单位", async () => {
    const ret = await createSaleReturn({
      storeId: 1, customerId: 100, customerName: "客户A",
      items: [{ skuId: 42, qty: 1, unitPrice: 9.99 }]
    });
    expect(Number(ret.totalAmount)).toBeCloseTo(9.99, 2);
  });

  it("创建退货单 - 异常：空明细拒绝", async () => {
    await expect(
      createSaleReturn({ storeId: 1, customerId: 1, customerName: "X", items: [] })
    ).rejects.toThrow();
  });

  it("创建退货单 - 异常：数量为 0/负拒绝", async () => {
    await expect(
      createSaleReturn({ storeId: 1, customerId: 1, customerName: "X", items: [{ skuId: 43, qty: 0, unitPrice: 10 }] })
    ).rejects.toThrow();
    await expect(
      createSaleReturn({ storeId: 1, customerId: 1, customerName: "X", items: [{ skuId: 43, qty: -1, unitPrice: 10 }] })
    ).rejects.toThrow();
  });

  it("创建退货单 - 异常：单价为负拒绝", async () => {
    await expect(
      createSaleReturn({ storeId: 1, customerId: 1, customerName: "X", items: [{ skuId: 44, qty: 1, unitPrice: -10 }] })
    ).rejects.toThrow();
  });

  it("审核退货单 - 正常：库存 physicalQty 增加 + 状态变为 AUDITED + 回滚标志 1", async () => {
    const storeId = 1;
    const skuId = 45;
    await ensureInventory(storeId, skuId, "OFFLINE", 5);
    const beforeQty = await getPhysicalQty(storeId, skuId);
    const ret = await createSaleReturn({
      storeId, customerId: 1, customerName: "X",
      items: [{ skuId, qty: 3, unitPrice: 200 }]
    });
    await auditSaleReturn(ret.returnNo, 1);
    const afterQty = await getPhysicalQty(storeId, skuId);
    expect(afterQty).toBe(beforeQty + 3);

    const status = await mockQuery<any>(
      `SELECT status, auditor_id AS auditorId, stock_rollback_flag AS stockRollbackFlag FROM sale_return WHERE return_no = ?`,
      [ret.returnNo]
    );
    expect(status[0].status).toBe("AUDITED");
    expect(Number(status[0].auditorId)).toBe(1);
    expect(Number(status[0].stockRollbackFlag)).toBe(1);
  });

  it("审核退货单 - 异常：重复审核拒绝", async () => {
    const ret = await createSaleReturn({
      storeId: 1, customerId: 1, customerName: "X",
      items: [{ skuId: 46, qty: 1, unitPrice: 10 }]
    });
    await auditSaleReturn(ret.returnNo);
    await expect(auditSaleReturn(ret.returnNo)).rejects.toThrow();
  });

  it("多条明细审核 - 每条分别正确累加入库", async () => {
    const storeId = 1;
    const skuA = 47;
    const skuB = 48;
    await ensureInventory(storeId, skuA, "OFFLINE", 10);
    await ensureInventory(storeId, skuB, "OFFLINE", 20);
    const beforeA = await getPhysicalQty(storeId, skuA);
    const beforeB = await getPhysicalQty(storeId, skuB);
    const ret = await createSaleReturn({
      storeId, customerId: 1, customerName: "X",
      items: [
        { skuId: skuA, qty: 2, unitPrice: 10 },
        { skuId: skuB, qty: 4, unitPrice: 20 }
      ]
    });
    await auditSaleReturn(ret.returnNo, 1);
    expect(await getPhysicalQty(storeId, skuA)).toBe(beforeA + 2);
    expect(await getPhysicalQty(storeId, skuB)).toBe(beforeB + 4);
  });

  it("金额精度 - 分的四舍五入：qty=2 unitPrice=9.995 = 19.99", async () => {
    const ret = await createSaleReturn({
      storeId: 1, customerId: 1, customerName: "X",
      items: [{ skuId: 49, qty: 2, unitPrice: 9.995 }]
    });
    expect(Number(ret.totalAmount)).toBeCloseTo(19.99, 2);
  });
});
