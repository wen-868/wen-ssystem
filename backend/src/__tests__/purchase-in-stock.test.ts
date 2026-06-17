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

async function createInStock(input: {
  storeId: number;
  supplierId: number;
  purchaseOrderNo?: string;
  items: { skuId: number; skuName?: string; planQty: number; actualQty: number; unitPrice: number }[];
}) {
  if (input.items.length === 0) throw new Error("入库单至少需要 1 条明细");
  if (input.items.some((it) => it.actualQty < 0 || it.unitPrice < 0)) throw new Error("数量与单价不能为负");
  const inStockNo = makeBizNo("RK");
  const totalQty = input.items.reduce((s, it) => s + Number(it.actualQty), 0);
  const totalAmount = Math.round(input.items.reduce((s, it) => s + it.actualQty * it.unitPrice, 0) * 100) / 100;
  await mockExecute(
    `INSERT INTO purchase_in_stock_order (in_stock_no, purchase_order_no, store_id, supplier_id, total_qty, total_amount) VALUES (?,?,?,?,?,?)`,
    [inStockNo, input.purchaseOrderNo ?? null, input.storeId, input.supplierId, totalQty, totalAmount]
  );
  for (const it of input.items) {
    const subtotal = Math.round(it.actualQty * it.unitPrice * 100) / 100;
    await mockExecute(
      `INSERT INTO purchase_in_stock_item (in_stock_no, sku_id, sku_name, plan_qty, actual_qty, unit_price, subtotal_amount) VALUES (?,?,?,?,?,?,?)`,
      [inStockNo, it.skuId, it.skuName ?? `SKU-${it.skuId}`, it.planQty, it.actualQty, it.unitPrice, subtotal]
    );
  }
  const rows = await mockQuery<any>(
    `SELECT id, in_stock_no AS inStockNo, purchase_order_no AS purchaseOrderNo, store_id AS storeId, supplier_id AS supplierId, total_qty AS totalQty, total_amount AS totalAmount, status, auditor_id AS auditorId, audit_time AS auditTime FROM purchase_in_stock_order WHERE in_stock_no = ?`,
    [inStockNo]
  );
  return rows[0];
}

async function auditInStock(inStockNo: string, auditorId: number = 1) {
  const rows = await mockQuery<any>(`SELECT status FROM purchase_in_stock_order WHERE in_stock_no = ?`, [inStockNo]);
  if (rows.length === 0) throw new Error("入库单不存在");
  if (rows[0].status === "AUDITED") throw new Error("入库单已审核");
  await mockExecute(
    `UPDATE purchase_in_stock_order SET status = ?, auditor_id = ?, audit_time = ? WHERE in_stock_no = ?`,
    ["AUDITED", auditorId, new Date().toISOString(), inStockNo]
  );
  const orderRows = await mockQuery<any>(`SELECT store_id AS storeId FROM purchase_in_stock_order WHERE in_stock_no = ?`, [inStockNo]);
  const storeId = Number(orderRows[0].storeId);
  const items = await mockQuery<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, actual_qty AS actualQty, unit_price AS unitPrice FROM purchase_in_stock_item WHERE in_stock_no = ?`,
    [inStockNo]
  );
  for (const it of items) {
    await ensureInventory(storeId, Number(it.skuId), "OFFLINE", 0);
    await mockExecute(
      `UPDATE inventory_balance SET physical_qty = ?, available_qty = ? WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
      [Number(it.actualQty), Number(it.actualQty), storeId, Number(it.skuId), "OFFLINE"]
    );
  }
  const after = await mockQuery<any>(
    `SELECT status, auditor_id AS auditorId, audit_time AS auditTime FROM purchase_in_stock_order WHERE in_stock_no = ?`,
    [inStockNo]
  );
  return { order: after[0], items };
}

async function cancelInStock(inStockNo: string, operatorId: number = 1) {
  const rows = await mockQuery<any>(
    `SELECT status, store_id AS storeId FROM purchase_in_stock_order WHERE in_stock_no = ?`,
    [inStockNo]
  );
  if (rows.length === 0) throw new Error("入库单不存在");
  if (rows[0].status !== "AUDITED") throw new Error("只能作废已审核的入库单");
  const storeId = Number(rows[0].storeId);
  const items = await mockQuery<any>(
    `SELECT sku_id AS skuId, actual_qty AS actualQty, sku_name AS skuName FROM purchase_in_stock_item WHERE in_stock_no = ?`,
    [inStockNo]
  );
  for (const it of items) {
    await mockExecute(
      `UPDATE inventory_balance SET physical_qty = ?, available_qty = ? WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
      [-Number(it.actualQty), -Number(it.actualQty), storeId, Number(it.skuId), "OFFLINE"]
    );
  }
  await mockExecute(
    `UPDATE purchase_in_stock_order SET status = ?, auditor_id = ?, audit_time = ? WHERE in_stock_no = ?`,
    ["CANCELLED", operatorId, new Date().toISOString(), inStockNo]
  );
  const after = await mockQuery<any>(
    `SELECT status FROM purchase_in_stock_order WHERE in_stock_no = ?`,
    [inStockNo]
  );
  return after[0];
}

function getPhysicalQty(storeId: number, skuId: number, stockType: string = "OFFLINE") {
  return mockQuery<any>(
    `SELECT * FROM inventory_balance WHERE store_id = ? AND sku_id = ? AND stock_type = ?`,
    [storeId, skuId, stockType]
  ).then((rows) => (rows.length > 0 ? Number(rows[0].physicalQty) : 0));
}

describe("采购入库", () => {
  beforeEach(() => resetMockDb());

  it("创建入库单 - 正常：生成唯一编号 + 正确汇总数量与金额", async () => {
    const order = await createInStock({
      storeId: 1, supplierId: 1,
      items: [
        { skuId: 3, planQty: 10, actualQty: 10, unitPrice: 50 },
        { skuId: 4, planQty: 20, actualQty: 18, unitPrice: 80 }
      ]
    });
    expect(String(order.inStockNo)).toMatch(/^RK\d{14}[A-F0-9]{6}$/);
    expect(Number(order.totalQty)).toBe(28);
    expect(Number(order.totalAmount)).toBeCloseTo(10 * 50 + 18 * 80, 2);
    expect(order.status).toBe("DRAFT");
  });

  it("创建入库单 - 边界：actualQty=0 允许（计划与实际不一致）", async () => {
    const order = await createInStock({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 5, planQty: 5, actualQty: 0, unitPrice: 100 }]
    });
    expect(Number(order.totalQty)).toBe(0);
    expect(Number(order.totalAmount)).toBe(0);
  });

  it("创建入库单 - 异常：空明细拒绝", async () => {
    await expect(
      createInStock({ storeId: 1, supplierId: 1, items: [] })
    ).rejects.toThrow();
  });

  it("创建入库单 - 异常：actualQty 或 unitPrice 为负应拒绝", async () => {
    await expect(
      createInStock({ storeId: 1, supplierId: 1, items: [{ skuId: 6, planQty: 1, actualQty: -5, unitPrice: 10 }] })
    ).rejects.toThrow();
    await expect(
      createInStock({ storeId: 1, supplierId: 1, items: [{ skuId: 7, planQty: 1, actualQty: 1, unitPrice: -10 }] })
    ).rejects.toThrow();
  });

  it("审核入库单 - 正常：库存 physicalQty 增加 + 状态变为 AUDITED", async () => {
    const testStoreId = 1;
    const testSkuId = 8;
    await ensureInventory(testStoreId, testSkuId, "OFFLINE", 10);
    const beforeQty = await getPhysicalQty(testStoreId, testSkuId);
    const order = await createInStock({
      storeId: testStoreId, supplierId: 1,
      items: [{ skuId: testSkuId, planQty: 5, actualQty: 5, unitPrice: 129 }]
    });
    await auditInStock(order.inStockNo, 1);
    const afterQty = await getPhysicalQty(testStoreId, testSkuId);
    expect(afterQty).toBe(beforeQty + 5);

    const orderRows = await mockQuery<any>(
      `SELECT status, auditor_id AS auditorId FROM purchase_in_stock_order WHERE in_stock_no = ?`,
      [order.inStockNo]
    );
    expect(orderRows[0].status).toBe("AUDITED");
    expect(Number(orderRows[0].auditorId)).toBe(1);
  });

  it("审核入库单 - 异常：重复审核拒绝", async () => {
    const order = await createInStock({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 9, planQty: 2, actualQty: 2, unitPrice: 99 }]
    });
    await auditInStock(order.inStockNo);
    await expect(auditInStock(order.inStockNo)).rejects.toThrow();
  });

  it("作废入库单 - 正常：库存 physicalQty 回滚 + 状态变为 CANCELLED", async () => {
    const testStoreId = 1;
    const testSkuId = 10;
    await ensureInventory(testStoreId, testSkuId, "OFFLINE", 20);
    const beforeQty = await getPhysicalQty(testStoreId, testSkuId);
    const order = await createInStock({
      storeId: testStoreId, supplierId: 1,
      items: [{ skuId: testSkuId, planQty: 3, actualQty: 3, unitPrice: 100 }]
    });
    await auditInStock(order.inStockNo);
    expect(await getPhysicalQty(testStoreId, testSkuId)).toBe(beforeQty + 3);

    const cancelled = await cancelInStock(order.inStockNo);
    expect(cancelled.status).toBe("CANCELLED");
    expect(await getPhysicalQty(testStoreId, testSkuId)).toBe(beforeQty);
  });

  it("作废入库单 - 异常：DRAFT 不能直接作废", async () => {
    const order = await createInStock({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 11, planQty: 1, actualQty: 1, unitPrice: 10 }]
    });
    await expect(cancelInStock(order.inStockNo)).rejects.toThrow();
  });

  it("入库金额精度 - 分的四舍五入：3 × 9.995 = 29.99", async () => {
    const order = await createInStock({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 12, planQty: 3, actualQty: 3, unitPrice: 9.995 }]
    });
    expect(Number(order.totalAmount)).toBeCloseTo(29.99, 2);
  });

  it("多条明细入库审核 - 每条分别正确累加", async () => {
    const testStoreId = 1;
    const skuA = 30;
    const skuB = 31;
    await ensureInventory(testStoreId, skuA, "OFFLINE", 5);
    await ensureInventory(testStoreId, skuB, "OFFLINE", 7);
    const beforeA = await getPhysicalQty(testStoreId, skuA);
    const beforeB = await getPhysicalQty(testStoreId, skuB);
    const order = await createInStock({
      storeId: testStoreId, supplierId: 1,
      items: [
        { skuId: skuA, planQty: 5, actualQty: 5, unitPrice: 100 },
        { skuId: skuB, planQty: 7, actualQty: 7, unitPrice: 200 }
      ]
    });
    await auditInStock(order.inStockNo);
    expect(await getPhysicalQty(testStoreId, skuA)).toBe(beforeA + 5);
    expect(await getPhysicalQty(testStoreId, skuB)).toBe(beforeB + 7);
  });
});
