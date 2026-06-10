import { describe, expect, it } from "vitest";
import { mockQuery } from "../shared/mock-db.js";

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
});
