import { describe, expect, it } from "vitest";
import { mockConn, mockQuery } from "../shared/mock-db.js";

describe("Mock 数据库", () => {
  it("返回商品列表", async () => {
    const rows = await mockQuery<any>(
      `SELECT p.id AS spuId, s.id AS skuId, p.name, p.main_image AS mainImage,
              s.sku_name AS skuName, s.sku_code AS skuCode, s.barcode,
              pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, p.status
       FROM product_sku s
       JOIN product_spu p ON p.id = s.spu_id
       JOIN product_price pp ON pp.sku_id = s.id
       WHERE p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?
       ORDER BY p.id DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      ["%%", "%%", "%%", 20, 0]
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].skuName).toContain("示例白酒");
  });

  it("支持按字面量 OFFLINE 查询和扣减门店库存", async () => {
    const before = await mockQuery<any>(
      `SELECT physical_qty AS physicalQty, available_qty AS availableQty
       FROM inventory_balance
       WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'
       FOR UPDATE`,
      [1, 1]
    );

    await mockConn.execute(
      `UPDATE inventory_balance
       SET physical_qty = physical_qty - ?,
           available_qty = available_qty - ?,
           updated_at = NOW()
       WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'`,
      [1, 1, 1, 1]
    );

    const after = await mockQuery<any>(
      `SELECT physical_qty AS physicalQty, available_qty AS availableQty
       FROM inventory_balance
       WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE'
       FOR UPDATE`,
      [1, 1]
    );

    expect(before[0].availableQty).toBeGreaterThan(after[0].availableQty);
    expect(after[0].availableQty).toBe(before[0].availableQty - 1);
  });

  it("查询销售单明细时不会误返回销售单主表", async () => {
    await mockConn.execute(
      `INSERT INTO sale_bill (bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type,
                              business_status, collection_status, goods_amount, discount_amount, rounding_amount,
                              receivable_amount, received_amount, unreceived_amount, operator_id, remark, internal_remark)
       VALUES (?, ?, ?, ?, ?, ?, 'CREATED', 'UNPAID', ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      ["XS-MOCK-ITEM", 1, 1, "测试客户", "13900000000", "RETAIL", 129, 0, 0, 129, 129, 3, null, null]
    );
    await mockConn.execute(
      `INSERT INTO sale_bill_item (bill_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty, unit_price, price_type, subtotal_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["XS-MOCK-ITEM", 1, "示例白酒 53度 500ml 常温", 0, 1, 1, 129, "STORE", 129]
    );

    const rows = await mockQuery<any>(
      `SELECT sku_id AS skuId, total_bottle_qty AS quantity
       FROM sale_bill_item
       WHERE bill_no = ?`,
      ["XS-MOCK-ITEM"]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].skuId).toBe(1);
    expect(rows[0].totalBottleQty).toBe(1);
    expect(rows[0].customerName).toBeUndefined();
  });
});

describe("应收账款 Mock", () => {
  it("插入应收记录后可查询到列表", async () => {
    await mockConn.execute(
      `INSERT INTO receivable_account (receivable_no, source_type, source_no, store_id, customer_id, customer_name,
                                       customer_mobile, receivable_amount, received_amount, unreceived_amount, status)
       VALUES (?, 'MINIAPP_ORDER', ?, ?, ?, ?, ?, ?, 0, ?, 'UNPAID')`,
      ["YS-TEST-001", "MO-TEST-001", 1, 2, "默认批发客户", "13900000001", 99, 99]
    );

    const list = await mockQuery<any>(
      `SELECT receivable_no AS receivableNo, source_type AS sourceType, source_no AS sourceNo,
              customer_name AS customerName, customer_mobile AS customerMobile,
              receivable_amount AS receivableAmount, received_amount AS receivedAmount,
              unreceived_amount AS unreceivedAmount, status, created_at AS createdAt
       FROM receivable_account
       ORDER BY id DESC`,
      []
    );

    expect(list.length).toBeGreaterThanOrEqual(1);
    const found = list.find((r: any) => r.receivableNo === "YS-TEST-001");
    expect(found).toBeDefined();
    expect(found.customerName).toBe("默认批发客户");
    expect(Number(found.receivableAmount)).toBe(99);
    expect(Number(found.receivedAmount)).toBe(0);
    expect(found.status).toBe("UNPAID");
  });

  it("按 receivable_no 查询单条应收详情", async () => {
    const row = await mockQuery<any>(
      `SELECT receivable_no, source_no, received_amount, receivable_amount, unreceived_amount
       FROM receivable_account WHERE receivable_no = ?`,
      ["YS-TEST-001"]
    );

    expect(row).toHaveLength(1);
    expect(row[0].receivable_no).toBe("YS-TEST-001");
    expect(Number(row[0].unreceived_amount)).toBe(99);
  });

  it("更新应收收款后金额和状态正确变更", async () => {
    await mockConn.execute(
      `UPDATE receivable_account
       SET received_amount = ?, unreceived_amount = ?, status = ?, last_payment_time = NOW()
       WHERE receivable_no = ?`,
      [10, 89, "PARTIAL", "YS-TEST-001"]
    );

    const row = await mockQuery<any>(
      `SELECT receivable_no, received_amount, unreceived_amount, status
       FROM receivable_account WHERE receivable_no = ?`,
      ["YS-TEST-001"]
    );

    expect(row).toHaveLength(1);
    expect(Number(row[0].received_amount)).toBe(10);
    expect(Number(row[0].unreceived_amount)).toBe(89);
    expect(row[0].status).toBe("PARTIAL");
  });

  it("全额收款后状态变为 PAID", async () => {
    await mockConn.execute(
      `UPDATE receivable_account
       SET received_amount = ?, unreceived_amount = ?, status = ?, last_payment_time = NOW()
       WHERE receivable_no = ?`,
      [99, 0, "PAID", "YS-TEST-001"]
    );

    const row = await mockQuery<any>(
      `SELECT receivable_no, received_amount, unreceived_amount, status
       FROM receivable_account WHERE receivable_no = ?`,
      ["YS-TEST-001"]
    );

    expect(Number(row[0].received_amount)).toBe(99);
    expect(Number(row[0].unreceived_amount)).toBe(0);
    expect(row[0].status).toBe("PAID");
  });

  it("应收收款生成付款记录", async () => {
    await mockConn.execute(
      `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at)
       VALUES (?, 'RECEIVABLE', ?, ?, ?, 'SUCCESS', NOW())`,
      ["ZF-TEST-001", "YS-TEST-001", "TRANSFER", 10]
    );

    const payments = await mockQuery<any>(
      `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo,
              amount, status, channel AS paymentMethod
       FROM payment_order
       ORDER BY created_at DESC`,
      []
    );

    const found = payments.find((p: any) => p.payNo === "ZF-TEST-001");
    expect(found).toBeDefined();
    expect(found.sourceType).toBe("RECEIVABLE");
    expect(found.sourceNo).toBe("YS-TEST-001");
    expect(Number(found.amount)).toBe(10);
    expect(found.status).toBe("SUCCESS");
  });

  it("应收列表 count 查询返回正确总数", async () => {
    const total = await mockQuery<any>(
      `SELECT COUNT(*) AS total FROM receivable_account`,
      []
    );

    expect(total).toHaveLength(1);
    expect(Number(total[0].total)).toBeGreaterThanOrEqual(1);
  });
});
