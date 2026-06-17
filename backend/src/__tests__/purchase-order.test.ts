import { beforeEach, describe, expect, it } from "vitest";
import { mockQuery, mockExecute, resetMockDb } from "../shared/mock-db.js";
import { makeBizNo } from "../shared/id.js";

// -------- 业务函数 --------
async function createPurchaseOrder(input: {
  storeId: number;
  supplierId: number;
  items: { skuId: number; skuName?: string; boxQty?: number; bottleQty: number; unitPrice: number }[];
  remark?: string;
}) {
  if (input.items.length === 0) throw new Error("采购单至少需要 1 条明细");
  if (input.items.some((it) => it.unitPrice < 0)) throw new Error("单价不能为负");
  if (input.items.some((it) => Number(it.bottleQty ?? 0) + Number(it.boxQty ?? 0) <= 0)) throw new Error("数量必须大于 0");

  const orderNo = makeBizNo("PO");
  let goodsAmount = 0;
  for (const it of input.items) {
    const qty = Number(it.bottleQty ?? 0) + Number(it.boxQty ?? 0);
    const subtotal = qty * Number(it.unitPrice);
    goodsAmount += subtotal;
  }
  const taxAmount = Math.round((goodsAmount * 0.13) * 100) / 100; // 13% 进项税
  const payableAmount = Math.round((goodsAmount + taxAmount) * 100) / 100;

  await mockExecute(
    `INSERT INTO purchase_order (order_no, store_id, supplier_id, goods_amount, tax_amount, payable_amount, remark) VALUES (?,?,?,?,?,?,?)`,
    [orderNo, input.storeId, input.supplierId, goodsAmount, taxAmount, payableAmount, input.remark ?? null]
  );

  for (const it of input.items) {
    const qty = Number(it.bottleQty ?? 0) + Number(it.boxQty ?? 0);
    const subtotal = Math.round(qty * Number(it.unitPrice) * 100) / 100;
    await mockExecute(
      `INSERT INTO purchase_order_item (order_no, sku_id, sku_name, box_qty, bottle_qty, unit_price, subtotal_amount) VALUES (?,?,?,?,?,?,?)`,
      [orderNo, it.skuId, it.skuName ?? `SKU-${it.skuId}`, Number(it.boxQty ?? 0), it.bottleQty, it.unitPrice, subtotal]
    );
  }

  const main = await mockQuery<any>(
    `SELECT id, order_no AS orderNo, store_id AS storeId, supplier_id AS supplierId, order_status AS orderStatus, pay_status AS payStatus, goods_amount AS goodsAmount, tax_amount AS taxAmount, payable_amount AS payableAmount, paid_amount AS paidAmount, version FROM purchase_order WHERE order_no = ?`,
    [orderNo]
  );
  const items = await mockQuery<any>(`SELECT sku_id AS skuId, box_qty AS boxQty, bottle_qty AS bottleQty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount FROM purchase_order_item WHERE order_no = ?`, [orderNo]);
  return { main: main[0], items };
}

async function submitPurchase(orderNo: string) {
  const rows = await mockQuery<any>(`SELECT order_status AS orderStatus FROM purchase_order WHERE order_no = ?`, [orderNo]);
  if (rows.length === 0) throw new Error("采购单不存在");
  const current = rows[0].orderStatus;
  if (current !== "DRAFT") throw new Error(`当前状态 ${current} 不允许提交`);
  await mockExecute(`UPDATE purchase_order SET order_status = ?, auditor_id = ?, audit_time = ? WHERE order_no = ?`, ["SUBMITTED", null, null, orderNo]);
  const after = await mockQuery<any>(`SELECT order_status AS orderStatus, version FROM purchase_order WHERE order_no = ?`, [orderNo]);
  return after[0];
}

async function auditPurchase(orderNo: string, passed: boolean, auditorId: number = 1) {
  const rows = await mockQuery<any>(`SELECT order_status AS orderStatus FROM purchase_order WHERE order_no = ?`, [orderNo]);
  if (rows.length === 0) throw new Error("采购单不存在");
  if (rows[0].orderStatus !== "SUBMITTED") throw new Error("当前状态不允许审核");
  const target = passed ? "AUDITED" : "SUBMITTED"; // 不通过保持为 SUBMITTED，由业务视情况处理
  await mockExecute(`UPDATE purchase_order SET order_status = ?, auditor_id = ?, audit_time = ? WHERE order_no = ?`, [target, auditorId, new Date().toISOString(), orderNo]);
  const after = await mockQuery<any>(`SELECT order_status AS orderStatus, auditor_id AS auditorId, audit_time AS auditTime, version FROM purchase_order WHERE order_no = ?`, [orderNo]);
  return after[0];
}

async function cancelPurchase(orderNo: string) {
  const rows = await mockQuery<any>(`SELECT order_status AS orderStatus FROM purchase_order WHERE order_no = ?`, [orderNo]);
  if (rows.length === 0) throw new Error("采购单不存在");
  if (!["DRAFT", "SUBMITTED"].includes(String(rows[0].orderStatus))) throw new Error("已审核订单不能直接取消");
  await mockExecute(`UPDATE purchase_order SET order_status = ?, auditor_id = ?, audit_time = ? WHERE order_no = ?`, ["CANCELLED", null, null, orderNo]);
  const after = await mockQuery<any>(`SELECT order_status AS orderStatus FROM purchase_order WHERE order_no = ?`, [orderNo]);
  return after[0];
}

async function payPurchase(orderNo: string, amount: number) {
  const rows = await mockQuery<any>(`SELECT payable_amount AS payableAmount, paid_amount AS paidAmount, order_status AS orderStatus, pay_status AS payStatus FROM purchase_order WHERE order_no = ?`, [orderNo]);
  if (rows.length === 0) throw new Error("采购单不存在");
  const payable = Number(rows[0].payableAmount);
  const paid = Number(rows[0].paidAmount ?? 0);
  if (amount <= 0) throw new Error("付款金额必须大于 0");
  if (paid + amount > payable + 0.001) throw new Error("付款金额超过应付金额");
  const newPaid = Math.round((paid + amount) * 100) / 100;
  const status = Math.abs(newPaid - payable) < 0.01 ? "PAID" : "PARTIAL";
  await mockExecute(`UPDATE purchase_order SET pay_status = ?, paid_amount = ? WHERE order_no = ?`, [status, newPaid, orderNo]);
  const after = await mockQuery<any>(`SELECT pay_status AS payStatus, paid_amount AS paidAmount FROM purchase_order WHERE order_no = ?`, [orderNo]);
  return after[0];
}

// -------- 测试 --------
describe("采购订单", () => {
  beforeEach(() => resetMockDb());
  it("创建采购单 - 正常：多条明细正确汇总金额，应付 = 商品 + 13% 税", async () => {
    const { main, items } = await createPurchaseOrder({
      storeId: 1,
      supplierId: 1,
      items: [
        { skuId: 1, bottleQty: 10, unitPrice: 50 },
        { skuId: 2, bottleQty: 20, unitPrice: 80 }
      ]
    });
    expect(items.length).toBe(2);
    // 10*50 + 20*80 = 500 + 1600 = 2100
    expect(Number(main.goodsAmount)).toBeCloseTo(2100, 2);
    expect(Number(main.taxAmount)).toBeCloseTo(273, 2);
    expect(Number(main.payableAmount)).toBeCloseTo(2373, 2);
    expect(main.orderStatus).toBe("DRAFT");
    expect(main.payStatus).toBe("UNPAID");
  });

  it("创建采购单 - 边界：单价精确到分", async () => {
    const { items } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 9, bottleQty: 3, unitPrice: 99.99 }]
    });
    expect(Number(items[0].subtotalAmount)).toBeCloseTo(299.97, 2);
  });

  it("创建采购单 - 异常：空明细应拒绝", async () => {
    await expect(createPurchaseOrder({ storeId: 1, supplierId: 1, items: [] })).rejects.toThrow();
  });

  it("创建采购单 - 异常：数量为 0 或 负 应拒绝", async () => {
    await expect(createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 0, unitPrice: 10 }]
    })).rejects.toThrow();
    await expect(createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: -5, unitPrice: 10 }]
    })).rejects.toThrow();
  });

  it("创建采购单 - 异常：单价为负应拒绝", async () => {
    await expect(createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 1, unitPrice: -10 }]
    })).rejects.toThrow();
  });

  it("状态流转：DRAFT → SUBMITTED → AUDITED", async () => {
    const { main } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 5, unitPrice: 100 }]
    });
    const afterSubmit = await submitPurchase(main.orderNo);
    expect(afterSubmit.orderStatus).toBe("SUBMITTED");

    const afterAudit = await auditPurchase(main.orderNo, true);
    expect(afterAudit.orderStatus).toBe("AUDITED");
    expect(Number(afterAudit.auditorId)).toBeGreaterThan(0);
    expect(afterAudit.auditTime).toBeTruthy();
  });

  it("状态流转 - 异常：不能对 DRAFT 直接审核", async () => {
    const { main } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 3, unitPrice: 20 }]
    });
    await expect(auditPurchase(main.orderNo, true)).rejects.toThrow();
  });

  it("状态流转 - 异常：不能重复提交", async () => {
    const { main } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 1, unitPrice: 100 }]
    });
    await submitPurchase(main.orderNo);
    await expect(submitPurchase(main.orderNo)).rejects.toThrow();
  });

  it("取消订单：DRAFT/SUBMITTED 可取消，取消后状态 CANCELLED", async () => {
    const { main } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 1, unitPrice: 100 }]
    });
    const after = await cancelPurchase(main.orderNo);
    expect(after.orderStatus).toBe("CANCELLED");
  });

  it("取消订单 - 异常：已审核订单应拒绝取消", async () => {
    const { main } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 1, unitPrice: 100 }]
    });
    await submitPurchase(main.orderNo);
    await auditPurchase(main.orderNo, true);
    await expect(cancelPurchase(main.orderNo)).rejects.toThrow();
  });

  it("付款：部分付款 → PARTIAL，再付款 → PAID，超付拒绝", async () => {
    const { main } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 10, unitPrice: 100 }]
    });
    // 10*100 = 1000, tax = 130, payable = 1130
    const partial = await payPurchase(main.orderNo, 500);
    expect(partial.payStatus).toBe("PARTIAL");
    expect(Number(partial.paidAmount)).toBeCloseTo(500, 2);

    const full = await payPurchase(main.orderNo, 630);
    expect(full.payStatus).toBe("PAID");
    expect(Number(full.paidAmount)).toBeCloseTo(1130, 2);

    // 超付
    await expect(payPurchase(main.orderNo, 1)).rejects.toThrow();
  });

  it("付款 - 异常：金额 ≤0 应拒绝", async () => {
    const { main } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 1, unitPrice: 100 }]
    });
    await expect(payPurchase(main.orderNo, 0)).rejects.toThrow();
    await expect(payPurchase(main.orderNo, -10)).rejects.toThrow();
  });

  it("乐观锁：每次状态更新 version 递增", async () => {
    const { main } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 1, bottleQty: 1, unitPrice: 100 }]
    });
    const versionBefore = Number(main.version);
    const after = await submitPurchase(main.orderNo);
    expect(Number(after.version)).toBeGreaterThan(versionBefore);
  });

  it("金额精度 - 分的四舍五入：3 × 9.995 = 29.99", async () => {
    // 直接在数据库层验证，此处我们要求：subtotal = 数量 × 单价，且保留 2 位小数
    const { items } = await createPurchaseOrder({
      storeId: 1, supplierId: 1,
      items: [{ skuId: 100, bottleQty: 3, unitPrice: 9.995 }]
    });
    expect(Number(items[0].subtotalAmount)).toBeCloseTo(29.99, 2);
  });
});
