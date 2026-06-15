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
