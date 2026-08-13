/**
 * 数据导入导出 service 单元测试
 * 被测文件：src/services/admin/data-transfer.service.ts
 * 覆盖：行业通用中文模板导出、同义词表头导入兼容、库存写入
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  exportProducts: vi.fn(),
  exportCustomers: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../services/admin/export.service", () => ({
  exportProducts: mocks.exportProducts,
  exportCustomers: mocks.exportCustomers,
}));

import {
  exportProductsData,
  exportCustomersData,
  importCustomersCsv,
  importProductsCsv,
  getProductTemplateCsv,
  getCustomerTemplateCsv,
} from "../../../services/admin/data-transfer.service";

describe("data-transfer.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("模板", () => {
    it("商品模板包含行业通用中文表头", () => {
      const csv = getProductTemplateCsv();
      expect(csv).toContain("商品编码,条码,商品名称,规格型号,单位,分类,品牌");
      expect(csv).toContain("进价,售价,批发价,库存数量,预警值");
      expect(csv.startsWith("\uFEFF")).toBe(true);
    });

    it("客户模板包含中文表头", () => {
      const csv = getCustomerTemplateCsv();
      expect(csv).toContain("客户名称,手机号,客户类型,积分,等级,状态");
      expect(csv.startsWith("\uFEFF")).toBe(true);
    });
  });

  describe("exportProductsData", () => {
    it("按行业模板中文表头映射导出字段", async () => {
      mocks.exportProducts.mockResolvedValue([
        {
          id: 1, skuCode: "SKU001", barcode: "6901", skuName: "五粮液 52度 500ml",
          specs: "500ml", categoryName: "白酒", brandName: "五粮液", baseUnit: "瓶",
          costPrice: 300, retailPrice: 450, wholesalePrice: 380,
          warningThreshold: 50, quantity: 100,
        },
      ]);
      const rows = await exportProductsData("t1");
      expect(rows[0]).toEqual({
        "商品编码": "SKU001", "条码": "6901", "商品名称": "五粮液 52度 500ml",
        "规格型号": "500ml", "单位": "瓶", "分类": "白酒", "品牌": "五粮液",
        "进价": 300, "售价": 450, "批发价": 380, "库存数量": 100, "预警值": 50,
      });
    });
  });

  describe("exportCustomersData", () => {
    it("客户类型与状态转为中文", async () => {
      mocks.exportCustomers.mockResolvedValue([
        { id: 1, name: "张三", mobile: "13800138000", customerType: "WHOLESALE", points: 10, levelCode: "VIP", status: 1 },
        { id: 2, name: "李四", mobile: "13900139000", customerType: "RETAIL", points: 0, levelCode: null, status: 0 },
      ]);
      const rows = await exportCustomersData("t1");
      expect(rows[0]["客户类型"]).toBe("批发");
      expect(rows[0]["状态"]).toBe("正常");
      expect(rows[1]["客户类型"]).toBe("零售");
      expect(rows[1]["状态"]).toBe("停用");
    });
  });

  describe("importCustomersCsv", () => {
    it("中文表头导入并映射零售/批发", async () => {
      mocks.query
        .mockResolvedValueOnce([]) // 手机号查重：不存在
        .mockResolvedValueOnce([]) // 手机号查重：不存在
        .mockResolvedValueOnce([]); // 预留
      const csv = "客户名称,手机号,客户类型,积分,等级\n张三,13800138000,零售,100,VIP\n李四,13900139000,批发,50,普通";
      const res = await importCustomersCsv(csv, "t1");
      expect(res.imported).toBe(2);
      const inserts = mocks.query.mock.calls.filter((c) => String(c[0]).includes("INSERT INTO t_member"));
      expect(inserts.length).toBe(2);
      expect(inserts[0][1]).toEqual(["张三", "13800138000", "RETAIL", 100, "VIP", 1, "t1"]);
      expect(inserts[1][1]).toEqual(["李四", "13900139000", "WHOLESALE", 50, "普通", 1, "t1"]);
    });

    it("兼容英文表头并规范 +86 手机号", async () => {
      mocks.query.mockResolvedValueOnce([]);
      const csv = "name,mobile,customerType\n王五,+8613700137000,WHOLESALE";
      const res = await importCustomersCsv(csv, "t1");
      expect(res.imported).toBe(1);
      const insert = mocks.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_member"));
      expect(insert![1]).toEqual(["王五", "13700137000", "WHOLESALE", 0, null, 1, "t1"]);
    });

    it("缺客户名称/手机号列时报错", async () => {
      await expect(importCustomersCsv("姓名,积分\n张三,100", "t1")).rejects.toThrow("客户名称");
    });

    it("手机号已存在则跳过", async () => {
      mocks.query.mockResolvedValueOnce([{ id: 9 }]);
      const csv = "客户名称,手机号\n张三,13800138000";
      const res = await importCustomersCsv(csv, "t1");
      expect(res.imported).toBe(0);
      expect(res.skipped).toBe(1);
    });
  });

  describe("importProductsCsv", () => {
    it("中文模板表头新增商品（含分类/SPU/价格/库存）", async () => {
      mocks.query
        .mockResolvedValueOnce([]) // 分类查重：不存在
        .mockResolvedValueOnce({ insertId: 10 }) // 建分类
        .mockResolvedValueOnce([]) // SPU 查重：不存在
        .mockResolvedValueOnce({ insertId: 20 }) // 建 SPU
        .mockResolvedValueOnce({}) // patchSpu 更新规格
        .mockResolvedValueOnce([]) // SKU 查重：不存在
        .mockResolvedValueOnce({ insertId: 30 }) // 建 SKU
        .mockResolvedValueOnce([]) // 价格查重：不存在
        .mockResolvedValueOnce({ insertId: 40 }) // 建价格
        .mockResolvedValueOnce([{ id: 1 }]) // 默认门店
        .mockResolvedValue({}); // 其余 UPDATE/INSERT 兜底

      const csv = "商品编码,条码,商品名称,规格型号,单位,分类,品牌,进价,售价,批发价,库存数量,预警值\n" +
        "SKU001,6901234567890,五粮液 52度 500ml,500ml,瓶,白酒,五粮液,300,450,380,100,50";
      const res = await importProductsCsv(csv, "t1");
      expect(res.imported).toBe(1);
      expect(res.updated).toBe(0);

      const skuInsert = mocks.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_product_sku"));
      expect(skuInsert[0]).toContain("INSERT INTO t_product_sku");
      expect(skuInsert[1]).toEqual([20, "SKU001", "6901234567890", "五粮液 52度 500ml", 50, "t1"]);

      const priceInsert = mocks.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_product_price"));
      expect(priceInsert[0]).toContain("INSERT INTO t_product_price");
      expect(priceInsert[1]).toEqual([30, 300, 450, 380, null, null, "t1"]);

      const invInsert = mocks.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO t_inventory_balance"));
      expect(invInsert[0]).toContain("INSERT INTO t_inventory_balance");
      expect(invInsert[1]).toEqual(["t1", 1, 30, 100, 100]);
    });

    it("商品编码已存在则更新并累加库存", async () => {
      mocks.query
        .mockResolvedValueOnce([{ id: 1 }]) // 分类已存在
        .mockResolvedValueOnce([{ id: 20 }]) // SPU 已存在
        .mockResolvedValueOnce([{ id: 30 }]) // SKU 查重：已存在
        .mockResolvedValueOnce({}) // UPDATE t_product_sku
        .mockResolvedValueOnce([{ id: 40 }]) // 价格已存在
        .mockResolvedValueOnce({}) // UPDATE t_product_price
        .mockResolvedValueOnce([{ id: 1 }]) // 默认门店
        .mockResolvedValue({}); // 其余 UPDATE/INSERT 兜底

      const csv = "商品编码,条码,商品名称,售价,库存数量\nSKU001,6901,五粮液,450,20";
      const res = await importProductsCsv(csv, "t1");
      expect(res.updated).toBe(1);

      const skuUpdate = mocks.query.mock.calls.find((c) => String(c[0]).includes("UPDATE t_product_sku"));
      expect(skuUpdate[0]).toContain("UPDATE t_product_sku");
      const priceUpdate = mocks.query.mock.calls.find((c) => String(c[0]).includes("UPDATE t_product_price"));
      expect(priceUpdate[0]).toContain("UPDATE t_product_price");
      const invUpsert = mocks.query.mock.calls.find((c) => String(c[0]).includes("ON DUPLICATE KEY UPDATE"));
      expect(invUpsert[1]).toEqual(["t1", 1, 30, 20, 20]);
    });

    it("兼容英文表头 sku_code/sku_name", async () => {
      mocks.query
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([{ id: 30 }])
        .mockResolvedValueOnce([{ id: 40 }])
        .mockResolvedValue({});
      const csv = "sku_code,sku_name,category,retail_price\nSKU001,茅台 500ml,白酒,1499";
      const res = await importProductsCsv(csv, "t1");
      expect(res.updated).toBe(1);
      const skuUpdate = mocks.query.mock.calls.find((c) => String(c[0]).includes("UPDATE t_product_sku"));
      expect(skuUpdate[1]).toEqual(["茅台 500ml", null, 0, 30]);
    });

    it("缺少商品名称列时报错", async () => {
      const csv = "条码,售价\n6901,100";
      await expect(importProductsCsv(csv, "t1")).rejects.toThrow("商品名称");
    });

    it("缺少商品名称的行跳过", async () => {
      mocks.query
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([{ id: 30 }])
        .mockResolvedValueOnce([{ id: 40 }])
        .mockResolvedValue({});
      const csv = "商品编码,商品名称,售价\nSKU001,,100\nSKU002,茅台,1499";
      const res = await importProductsCsv(csv, "t1");
      expect(res.skipped).toBe(1);
      expect(res.updated).toBe(1);
    });
  });
});
