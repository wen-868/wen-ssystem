import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryWithTenant, mockQueryOneWithTenant, mockTransaction } = vi.hoisted(() => ({
  mockQueryWithTenant: vi.fn(),
  mockQueryOneWithTenant: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  queryWithTenant: mockQueryWithTenant,
  queryOneWithTenant: mockQueryOneWithTenant,
  transaction: mockTransaction,
}));

import {
  syncProductFullChain,
  syncProductStatus,
  syncProductPrice,
  getProductSyncStatus,
} from "../../shared/product-sync.js";

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
  });
});
