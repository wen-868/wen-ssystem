/**
 * 管理端批量价格调整 service 单元测试
 * 被测文件：src/services/admin/batch-price.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

import {
  previewBatchPriceAdjustment,
  executeBatchPriceAdjustment,
  listBatchPriceLogs,
  getBatchPriceDetail,
} from "../../../services/admin/batch-price.service";

describe("batch-price.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("previewBatchPriceAdjustment", () => {
    it("totalCount 为 0 时返回空结果", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      const res = await previewBatchPriceAdjustment(
        {},
        { field: "retail_price", method: "FIXED", value: 10, direction: "INCREASE" },
        "t1"
      );
      expect(res.totalCount).toBe(0);
      expect(res.affectedCount).toBe(0);
      expect(res.items).toEqual([]);
    });

    it("FIXED 增加方式计算新价格", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      mocks.queryWithTenant.mockResolvedValue([
        { skuId: 1, skuName: "茅台", skuCode: "M", price: 100 },
      ]);
      const res = await previewBatchPriceAdjustment(
        {},
        { field: "retail_price", method: "FIXED", value: 10, direction: "INCREASE" },
        "t1"
      );
      expect(res.affectedCount).toBe(1);
      expect(res.items[0].newPrice).toBe(110);
      expect(res.items[0].changeAmount).toBe(10);
      expect(res.totalOldAmount).toBe(100);
      expect(res.totalNewAmount).toBe(110);
      expect(res.totalChangeAmount).toBe(10);
    });

    it("PERCENTAGE 减少方式计算新价格", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      mocks.queryWithTenant.mockResolvedValue([
        { skuId: 2, skuName: "啤酒", skuCode: "B", price: 200 },
      ]);
      const res = await previewBatchPriceAdjustment(
        {},
        { field: "wholesale_price", method: "PERCENTAGE", value: 10, direction: "DECREASE" },
        "t1"
      );
      // 200 * (1 - 0.1) = 180
      expect(res.items[0].newPrice).toBe(180);
      expect(res.items[0].changeAmount).toBe(-20);
      expect(res.items[0].changePercent).toBe(-10);
    });

    it("新旧价格相同时跳过", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      mocks.queryWithTenant.mockResolvedValue([
        { skuId: 3, skuName: "X", skuCode: "X", price: 100 },
      ]);
      const res = await previewBatchPriceAdjustment(
        {},
        { field: "retail_price", method: "FIXED", value: 0, direction: "INCREASE" },
        "t1"
      );
      expect(res.affectedCount).toBe(0);
      expect(res.skippedCount).toBe(1);
    });

    it("价格不会小于 0", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      mocks.queryWithTenant.mockResolvedValue([
        { skuId: 4, skuName: "Y", skuCode: "Y", price: 50 },
      ]);
      const res = await previewBatchPriceAdjustment(
        {},
        { field: "retail_price", method: "FIXED", value: 100, direction: "DECREASE" },
        "t1"
      );
      expect(res.items[0].newPrice).toBe(0);
    });

    it("带筛选条件时拼接 WHERE", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await previewBatchPriceAdjustment(
        { categoryId: 1, brand: "茅台", keyword: "k", minPrice: 10, maxPrice: 100, skuIds: [1, 2] },
        { field: "retail_price", method: "FIXED", value: 5, direction: "INCREASE" },
        "t1"
      );
      const [sql, params] = mocks.queryOneWithTenant.mock.calls[0];
      expect(sql).toContain("s.category_id = ?");
      expect(sql).toContain("s.brand = ?");
      expect(sql).toContain("LIKE");
      expect(params).toContain(1);
      expect(params).toContain("茅台");
      expect(params).toContain(10);
      expect(params).toContain(100);
    });
  });

  describe("executeBatchPriceAdjustment", () => {
    it("事务中成功更新价格并写日志", async () => {
      const conn = { query: vi.fn() };
      conn.query.mockResolvedValueOnce([[{ priceId: 1, skuId: 1, oldPrice: 100, priceLevelId: 1 }]]); // select
      conn.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // update
      conn.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // log insert
      mocks.transaction.mockImplementation(async (cb: any) => cb(conn));

      const res = await executeBatchPriceAdjustment(
        {},
        { field: "retail_price", method: "FIXED", value: 10, direction: "INCREASE" },
        "测试调整",
        99,
        "t1"
      );
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);
      expect(res.failedCount).toBe(0);
      expect(res.changeLogs).toBe(1);
  // 统一编号规则：前缀 + 日期8位 + 5位数字（如 BATCH2026081212510）
  expect(res.batchNo).toMatch(/^BATCH\d{13}$/);
      // 校验日志写入参数
      const logCall = conn.query.mock.calls[2];
      expect(logCall[0]).toContain("INSERT INTO t_product_price_log");
      expect(logCall[1]).toContain("测试调整");
    });

    it("新旧价格相同时计入 failed", async () => {
      const conn = { query: vi.fn() };
      conn.query.mockResolvedValueOnce([[{ priceId: 1, skuId: 1, oldPrice: 100, priceLevelId: 1 }]]);
      mocks.transaction.mockImplementation(async (cb: any) => cb(conn));
      const res = await executeBatchPriceAdjustment(
        {},
        { field: "retail_price", method: "FIXED", value: 0, direction: "INCREASE" },
        "x",
        1,
        "t1"
      );
      expect(res.updatedCount).toBe(0);
      expect(res.failedCount).toBe(1);
    });

    it("affectedRows 为 0 时计入 failed", async () => {
      const conn = { query: vi.fn() };
      conn.query.mockResolvedValueOnce([[{ priceId: 1, skuId: 1, oldPrice: 100, priceLevelId: 1 }]]);
      conn.query.mockResolvedValueOnce([{ affectedRows: 0 }]); // update 失败
      mocks.transaction.mockImplementation(async (cb: any) => cb(conn));
      const res = await executeBatchPriceAdjustment(
        {},
        { field: "retail_price", method: "FIXED", value: 10, direction: "INCREASE" },
        "x",
        1,
        "t1"
      );
      expect(res.updatedCount).toBe(0);
      expect(res.failedCount).toBe(1);
      expect(res.changeLogs).toBe(0);
    });
  });

  describe("listBatchPriceLogs", () => {
    it("无筛选返回分组记录", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ batchNo: "B1", skuCount: 5 }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      const res = await listBatchPriceLogs(1, 10, "t1");
      expect(res.total).toBe(1);
      expect(res.records.length).toBe(1);
      const [sql] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("GROUP BY batch_no, price_type");
    });

    it("带全部筛选条件", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await listBatchPriceLogs(1, 10, "t1", {
        batchNo: "B1", priceType: "RETAIL", operatorId: 9, startDate: "2026-01-01", endDate: "2026-01-31",
      });
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("batch_no = ?");
      expect(sql).toContain("price_type = ?");
      expect(sql).toContain("operator_id = ?");
      expect(params).toContain("B1");
      expect(params).toContain("RETAIL");
      expect(params).toContain(9);
    });

    it("total 为 null 时归零", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue(null);
      const res = await listBatchPriceLogs(1, 10, "t1");
      expect(res.total).toBe(0);
    });
  });

  describe("getBatchPriceDetail", () => {
    it("返回批次明细", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ id: 1, skuId: 1, skuName: "茅台" }]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      const res = await getBatchPriceDetail("BATCH_123", "t1");
      expect(res.total).toBe(1);
      expect(res.records.length).toBe(1);
      const [sql, params] = mocks.queryWithTenant.mock.calls[0];
      expect(sql).toContain("ppl.batch_no = ?");
      expect(params).toEqual(["BATCH_123", "t1", 50, 0]);
    });

    it("自定义分页参数", async () => {
      mocks.queryWithTenant.mockResolvedValue([]);
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      await getBatchPriceDetail("B1", "t1", 3, 20);
      const [, params] = mocks.queryWithTenant.mock.calls[0];
      expect(params).toEqual(["B1", "t1", 20, 40]);
    });
  });
});
