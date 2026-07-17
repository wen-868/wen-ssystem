/**
 * 管理端数据导出 service 单元测试
 * 被测文件：src/services/admin/export.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

import {
  exportCustomers,
  exportSuppliers,
  exportProducts,
  exportInventory,
  exportPurchaseOrders,
  exportPayments,
  exportSalesOrders,
  exportAuditLogs,
} from "../../../services/admin/export.service";

describe("export.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("exportCustomers", () => {
    it("无 keyword 时仅按 tenantId 查询", async () => {
      mocks.query.mockResolvedValue([{ id: 1, name: "客户A" }]);
      const res = await exportCustomers("t1");
      expect(res.length).toBe(1);
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("FROM t_member");
      expect(params).toEqual(["t1"]);
    });

    it("带 keyword 时拼接 LIKE 条件", async () => {
      mocks.query.mockResolvedValue([]);
      await exportCustomers("t1", "张三");
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["t1", "%张三%", "%张三%"]);
    });
  });

  describe("exportSuppliers", () => {
    it("无筛选时按 tenantId 查询", async () => {
      mocks.query.mockResolvedValue([{ id: 1, name: "供应商A" }]);
      const res = await exportSuppliers("t1");
      expect(res.length).toBe(1);
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["t1"]);
    });

    it("带 keyword 和 supplyType", async () => {
      mocks.query.mockResolvedValue([]);
      await exportSuppliers("t1", "茅", "酒厂");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("supply_type = ?");
      expect(params).toEqual(["t1", "%茅%", "%茅%", "酒厂"]);
    });
  });

  describe("exportProducts", () => {
    it("无 keyword 时返回全部商品", async () => {
      mocks.query.mockResolvedValue([{ id: 1, skuCode: "S1" }]);
      const res = await exportProducts("t1");
      expect(res.length).toBe(1);
      const [sql] = mocks.query.mock.calls[0];
      expect(sql).toContain("FROM t_product_sku");
    });

    it("带 keyword 时拼接 LIKE", async () => {
      mocks.query.mockResolvedValue([]);
      await exportProducts("t1", "茅台");
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["t1", "%茅台%", "%茅台%"]);
    });
  });

  describe("exportInventory", () => {
    it("无筛选时返回全部库存", async () => {
      mocks.query.mockResolvedValue([{ storeId: 1, skuId: 1 }]);
      const res = await exportInventory("t1");
      expect(res.length).toBe(1);
      const [, params] = mocks.query.mock.calls[0];
      expect(params).toEqual(["t1"]);
    });

    it("带 storeId 和 keyword", async () => {
      mocks.query.mockResolvedValue([]);
      await exportInventory("t1", "5", "茅");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("store_id = ?");
      expect(sql).toContain("LIKE");
      expect(params).toEqual(["t1", "5", "%茅%", "%茅%"]);
    });
  });

  describe("exportPurchaseOrders", () => {
    it("无筛选时返回全部采购单", async () => {
      mocks.query.mockResolvedValue([{ purchaseNo: "P1" }]);
      const res = await exportPurchaseOrders("t1");
      expect(res.length).toBe(1);
    });

    it("带 keyword 和 status", async () => {
      mocks.query.mockResolvedValue([]);
      await exportPurchaseOrders("t1", "供应商", "RECEIVED");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("status = ?");
      expect(params).toEqual(["t1", "%供应商%", "%供应商%", "RECEIVED"]);
    });
  });

  describe("exportPayments", () => {
    it("无 status 时返回全部付款", async () => {
      mocks.query.mockResolvedValue([{ paymentNo: "PAY1" }]);
      const res = await exportPayments("t1");
      expect(res.length).toBe(1);
    });

    it("带 status 筛选", async () => {
      mocks.query.mockResolvedValue([]);
      await exportPayments("t1", "PAID");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("status = ?");
      expect(params).toEqual(["t1", "PAID"]);
    });
  });

  describe("exportSalesOrders", () => {
    it("无筛选时返回全部销售单", async () => {
      mocks.query.mockResolvedValue([{ orderNo: "O1" }]);
      const res = await exportSalesOrders("t1");
      expect(res.length).toBe(1);
    });

    it("带全部筛选条件", async () => {
      mocks.query.mockResolvedValue([]);
      await exportSalesOrders("t1", "客户", "COMPLETED", "2026-01-01", "2026-01-31");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("status = ?");
      expect(sql).toContain("DATE(created_at) >= ?");
      expect(sql).toContain("DATE(created_at) <= ?");
      expect(params).toEqual(["t1", "%客户%", "%客户%", "COMPLETED", "2026-01-01", "2026-01-31"]);
    });
  });

  describe("exportAuditLogs", () => {
    it("无筛选时返回全部审计日志", async () => {
      mocks.query.mockResolvedValue([{ userName: "admin" }]);
      const res = await exportAuditLogs("t1");
      expect(res.length).toBe(1);
      const [sql] = mocks.query.mock.calls[0];
      expect(sql).toContain("FROM t_audit_log");
    });

    it("带 action/resourceType/日期范围", async () => {
      mocks.query.mockResolvedValue([]);
      await exportAuditLogs("t1", "CREATE", "PRODUCT", "2026-01-01", "2026-01-31");
      const [sql, params] = mocks.query.mock.calls[0];
      expect(sql).toContain("action = ?");
      expect(sql).toContain("resource_type = ?");
      expect(params).toEqual(["t1", "CREATE", "PRODUCT", "2026-01-01", "2026-01-31"]);
    });
  });
});
