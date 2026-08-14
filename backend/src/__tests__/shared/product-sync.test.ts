import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryWithTenant, mockQueryOneWithTenant, mockTransaction } = vi.hoisted(() => ({
  mockQueryWithTenant: vi.fn(),
  mockQueryOneWithTenant: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: mockQueryWithTenant,
  queryOneWithTenant: mockQueryOneWithTenant,
  transaction: mockTransaction,
}));

import {
  syncProductFullChain,
  syncProductStatus,
  syncProductPrice,
  getProductSyncStatus,
} from "../../shared/product-sync";

describe("product-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncProductFullChain", () => {
    it("商品不存在时返回空结果", async () => {
      mockQueryOneWithTenant.mockResolvedValue(null);

      const result = await syncProductFullChain(999, [], "default");

      expect(result.spuId).toBe(999);
      expect(result.totalTargets).toBe(0);
      expect(result.stages).toEqual([]);
    });

    it("商品存在且变更名称时同步到多个表", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "测试商品",
        categoryId: 10,
        categoryName: "分类",
        brand: "品牌",
        unit: "瓶",
        mainImage: "img.jpg",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 5 });

      const result = await syncProductFullChain(1, ["productName"], "default");

      expect(result.spuId).toBe(1);
      expect(result.totalTargets).toBeGreaterThan(0);
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.successCount).toBeGreaterThan(0);
    });

    it("空 changedFields 表示全量同步", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "全量同步",
        categoryId: 1,
        categoryName: "cat",
        brand: "brand",
        unit: "box",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const result = await syncProductFullChain(1, [], "default");

      expect(result.totalTargets).toBeGreaterThan(0);
    });

    it("变更 status 字段触发 SKU 状态同步", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 1,
        categoryName: "cat",
        brand: "brand",
        unit: "box",
        mainImage: "img",
        status: "INACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 2 });

      const result = await syncProductFullChain(1, ["status"], "default");

      expect(result.stages.some(s => s.stage === "SKU_SYNC")).toBe(true);
    });

    it("DB 错误时仍返回结果（不抛出）", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 1,
        categoryName: "cat",
        brand: "brand",
        unit: "box",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockRejectedValue(new Error("DB Error"));

      const result = await syncProductFullChain(1, ["productName"], "default");

      expect(result.failCount).toBeGreaterThan(0);
    });

    it("queryWithTenant 返回 null 时 affectedRows 应为 0（?. 和 || 分支）", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 1,
        categoryName: "cat",
        brand: "brand",
        unit: "box",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue(null);

      const result = await syncProductFullChain(1, ["productName"], "default");

      expect(result.stages.length).toBeGreaterThan(0);
      for (const stage of result.stages) {
        expect(stage.affectedRows).toBe(0);
      }
    });

    it("queryWithTenant 返回无 affectedRows 字段时 affectedRows 应为 0", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 1,
        categoryName: "cat",
        brand: "brand",
        unit: "box",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({});

      const result = await syncProductFullChain(1, ["productName"], "default");

      expect(result.stages.length).toBeGreaterThan(0);
      for (const stage of result.stages) {
        expect(stage.affectedRows).toBe(0);
      }
    });

    it("只有 categoryId 变更时同步 SKU 和库存表", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 2,
        categoryName: "新分类",
        brand: "brand",
        unit: "box",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 3 });

      const result = await syncProductFullChain(1, ["categoryId"], "default");

      const stages = result.stages.map(s => s.stage);
      expect(stages).toContain("SKU_SYNC");
      expect(stages).toContain("INVENTORY_SYNC");
      expect(stages).not.toContain("SALE_ORDER_SYNC");
      expect(stages).not.toContain("LEDGER_SYNC");
    });

    it("只有 brand 变更时只同步 SKU 表", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 1,
        categoryName: "cat",
        brand: "新品牌",
        unit: "box",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 5 });

      const result = await syncProductFullChain(1, ["brand"], "default");

      const stages = result.stages.map(s => s.stage);
      expect(stages).toEqual(["SKU_SYNC"]);
    });

    it("只有 unit 变更时同步 SKU、销售订单、采购订单", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 1,
        categoryName: "cat",
        brand: "brand",
        unit: "箱",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 2 });

      const result = await syncProductFullChain(1, ["unit"], "default");

      const stages = result.stages.map(s => s.stage);
      expect(stages).toContain("SKU_SYNC");
      expect(stages).toContain("SALE_ORDER_SYNC");
      expect(stages).toContain("PURCHASE_ORDER_SYNC");
      expect(stages).not.toContain("LEDGER_SYNC");
    });

    it("变更不相关字段时不同步任何阶段", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 1,
        categoryName: "cat",
        brand: "brand",
        unit: "box",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 0 });

      const result = await syncProductFullChain(1, ["mainImage"], "default");

      expect(result.totalTargets).toBe(0);
      expect(result.stages).toEqual([]);
      expect(mockQueryWithTenant).not.toHaveBeenCalled();
    });

    it("同时变更 productName 和 status 时同步所有相关阶段", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "新名称",
        categoryId: 1,
        categoryName: "cat",
        brand: "brand",
        unit: "box",
        mainImage: "img",
        status: "INACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 5 });

      const result = await syncProductFullChain(1, ["productName", "status"], "default");

      const stages = result.stages.map(s => s.stage);
      expect(stages).toContain("SKU_SYNC");
      expect(stages).toContain("INVENTORY_SYNC");
      expect(stages).toContain("SALE_ORDER_SYNC");
      expect(stages).toContain("LEDGER_SYNC");
      expect(stages).toContain("BATCH_SYNC");
    });

    it("同时变更 categoryId 和 unit 时同步对应阶段", async () => {
      mockQueryOneWithTenant.mockResolvedValue({
        id: 1,
        productName: "test",
        categoryId: 2,
        categoryName: "新分类",
        brand: "brand",
        unit: "箱",
        mainImage: "img",
        status: "ACTIVE",
      });
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 3 });

      const result = await syncProductFullChain(1, ["categoryId", "unit"], "default");

      const stages = result.stages.map(s => s.stage);
      expect(stages).toContain("SKU_SYNC");
      expect(stages).toContain("INVENTORY_SYNC");
      expect(stages).toContain("SALE_ORDER_SYNC");
      expect(stages).toContain("PURCHASE_ORDER_SYNC");
      expect(stages).not.toContain("LEDGER_SYNC");
    });
  });

  describe("syncProductStatus", () => {
    it("应同步状态到 SKU 表", async () => {
      mockQueryWithTenant.mockResolvedValue({ affectedRows: 3 });

      const results = await syncProductStatus(1, "INACTIVE", "default");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].stage).toBe("STATUS_SKU");
      expect(results[0].syncedFields).toContain("status");
    });

    it("DB 错误时返回 success=false", async () => {
      mockQueryWithTenant.mockRejectedValue(new Error("DB Error"));

      const results = await syncProductStatus(1, "INACTIVE", "default");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].success).toBe(false);
    });

    it("queryWithTenant 返回 null 时 affectedRows 应为 0", async () => {
      mockQueryWithTenant.mockResolvedValue(null);

      const results = await syncProductStatus(1, "INACTIVE", "default");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].affectedRows).toBe(0);
    });
  });

  describe("syncProductPrice", () => {
    it("无 SKU 时返回空数组", async () => {
      mockQueryWithTenant.mockResolvedValue([]);

      const results = await syncProductPrice(1, ["retailPrice"], "default");

      expect(results).toEqual([]);
    });

    it("有 SKU 时同步价格到销售订单", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])  // SKU 列表
        .mockResolvedValueOnce([{ sku_id: 1, retail_price: 100, wholesale_price: 80, cost_price: 50 }]); // 价格

      mockQueryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const results = await syncProductPrice(1, ["retailPrice"], "default");

      expect(results.length).toBeGreaterThan(0);
    });

    it("同步成本价到采购订单", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ sku_id: 1, cost_price: 50 }]);

      mockQueryWithTenant.mockResolvedValue({ affectedRows: 2 });

      const results = await syncProductPrice(1, ["costPrice"], "default");

      expect(results.some(r => r.stage === "PRICE_PURCHASE_ORDER")).toBe(true);
    });

    it("销售订单价格同步失败时返回 success=false", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ sku_id: 1, retail_price: 100, wholesale_price: 80, cost_price: 50 }]);

      mockQueryWithTenant.mockRejectedValue(new Error("Sale order sync failed"));

      const results = await syncProductPrice(1, ["retailPrice"], "default");

      const saleOrderResult = results.find(r => r.stage === "PRICE_SALE_ORDER");
      expect(saleOrderResult).toBeDefined();
      expect(saleOrderResult?.success).toBe(false);
      expect(saleOrderResult?.error).toBe("Sale order sync failed");
      expect(saleOrderResult?.affectedRows).toBe(0);
    });

    it("采购订单价格同步失败时返回 success=false", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ sku_id: 1, retail_price: 100, wholesale_price: 80, cost_price: 50 }]);

      mockQueryWithTenant
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockRejectedValue(new Error("Purchase order sync failed"));

      const results = await syncProductPrice(1, ["retailPrice", "costPrice"], "default");

      const purchaseOrderResult = results.find(r => r.stage === "PRICE_PURCHASE_ORDER");
      expect(purchaseOrderResult).toBeDefined();
      expect(purchaseOrderResult?.success).toBe(false);
      expect(purchaseOrderResult?.error).toBe("Purchase order sync failed");
      expect(purchaseOrderResult?.affectedRows).toBe(0);
    });

    it("wholesalePrice 变更时同步批发价到销售订单", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
        .mockResolvedValueOnce([
          { sku_id: 1, retail_price: 100, wholesale_price: 80, cost_price: 50 },
          { sku_id: 2, retail_price: 120, wholesale_price: 100, cost_price: 60 }
        ]);

      mockQueryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const results = await syncProductPrice(1, ["wholesalePrice"], "default");

      const saleOrderResult = results.find(r => r.stage === "PRICE_SALE_ORDER");
      expect(saleOrderResult).toBeDefined();
      expect(saleOrderResult?.success).toBe(true);
      expect(saleOrderResult?.syncedFields).toContain("wholesalePrice");
    });

    it("无匹配价格类型时返回空数组", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ sku_id: 1, retail_price: 100, wholesale_price: 80, cost_price: 50 }]);

      const results = await syncProductPrice(1, ["unknownPriceType"], "default");

      expect(results).toEqual([]);
    });

    it("同时有 retailPrice 和 wholesalePrice 时优先使用 wholesalePrice", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ sku_id: 1, retail_price: 100, wholesale_price: 80, cost_price: 50 }]);

      mockQueryWithTenant.mockResolvedValue({ affectedRows: 2 });

      const results = await syncProductPrice(1, ["retailPrice", "wholesalePrice"], "default");

      const saleOrderResult = results.find(r => r.stage === "PRICE_SALE_ORDER");
      expect(saleOrderResult).toBeDefined();
      expect(saleOrderResult?.success).toBe(true);
      expect(saleOrderResult?.syncedFields).toContain("wholesalePrice");
    });

    it("SKU 存在但价格数据为空数组时仍执行同步", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([]);

      const results = await syncProductPrice(1, ["retailPrice", "costPrice"], "default");

      const saleOrderResult = results.find(r => r.stage === "PRICE_SALE_ORDER");
      const purchaseOrderResult = results.find(r => r.stage === "PRICE_PURCHASE_ORDER");
      expect(saleOrderResult).toBeDefined();
      expect(saleOrderResult?.affectedRows).toBe(0);
      expect(purchaseOrderResult).toBeDefined();
      expect(purchaseOrderResult?.affectedRows).toBe(0);
    });

    it("更新操作返回 null 时 count 应为 0（?. 和 || 分支）", async () => {
      mockQueryWithTenant
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ sku_id: 1, retail_price: 100, wholesale_price: 80, cost_price: 50 }]);
      mockQueryWithTenant.mockResolvedValue(null);

      const results = await syncProductPrice(1, ["retailPrice", "costPrice"], "default");

      const saleOrderResult = results.find(r => r.stage === "PRICE_SALE_ORDER");
      const purchaseOrderResult = results.find(r => r.stage === "PRICE_PURCHASE_ORDER");
      expect(saleOrderResult).toBeDefined();
      expect(saleOrderResult?.affectedRows).toBe(0);
      expect(purchaseOrderResult).toBeDefined();
      expect(purchaseOrderResult?.affectedRows).toBe(0);
    });
  });

  describe("getProductSyncStatus", () => {
    it("商品不存在时抛出错误", async () => {
      mockQueryOneWithTenant.mockResolvedValue(null);

      await expect(getProductSyncStatus(999, "default")).rejects.toThrow("商品不存在");
    });

    it("商品存在时返回各表同步状态", async () => {
      mockQueryOneWithTenant.mockResolvedValue({ id: 1, name: "测试商品" });
      mockQueryOneWithTenant
        .mockResolvedValueOnce({ id: 1, name: "测试商品" })
        .mockResolvedValue({ cnt: 5 });

      const result = await getProductSyncStatus(1, "default");

      expect(result.spuId).toBe(1);
      expect(result.productName).toBe("测试商品");
      expect(result.targets.length).toBeGreaterThan(0);
    });

    it("某个目标表查询失败时返回 inSync=false", async () => {
      mockQueryOneWithTenant
        .mockResolvedValueOnce({ id: 1, name: "测试商品" })
        .mockResolvedValueOnce({ cnt: 10 })
        .mockRejectedValueOnce(new Error("Query failed"))
        .mockResolvedValue({ cnt: 3 });

      const result = await getProductSyncStatus(1, "default");

      expect(result.targets.length).toBe(5);
      expect(result.targets[0].inSync).toBe(true);
      expect(result.targets[1].inSync).toBe(false);
      expect(result.targets[1].recordCount).toBe(0);
      expect(result.targets[2].inSync).toBe(true);
    });

    it("所有目标表都查询失败时全部返回 inSync=false", async () => {
      mockQueryOneWithTenant
        .mockResolvedValueOnce({ id: 1, name: "测试商品" })
        .mockRejectedValue(new Error("All queries failed"));

      const result = await getProductSyncStatus(1, "default");

      expect(result.targets.length).toBe(5);
      expect(result.targets.every(t => t.inSync === false)).toBe(true);
      expect(result.targets.every(t => t.recordCount === 0)).toBe(true);
    });

    it("查询结果无 cnt 字段时 recordCount 为 0", async () => {
      mockQueryOneWithTenant
        .mockResolvedValueOnce({ id: 1, name: "测试商品" })
        .mockResolvedValue({ no_cnt: 5 });

      const result = await getProductSyncStatus(1, "default");

      expect(result.targets.length).toBe(5);
      expect(result.targets.every(t => t.recordCount === 0)).toBe(true);
    });

    it("查询结果为 null 时 recordCount 应为 0（?. 分支）", async () => {
      mockQueryOneWithTenant
        .mockResolvedValueOnce({ id: 1, name: "测试商品" })
        .mockResolvedValue(null);

      const result = await getProductSyncStatus(1, "default");

      expect(result.targets.length).toBe(5);
      expect(result.targets.every(t => t.recordCount === 0)).toBe(true);
    });
  });
});
