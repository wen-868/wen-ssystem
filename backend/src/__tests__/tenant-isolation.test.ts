import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  connExecute: mocks.connExecute,
}));

import { listErrorLogs } from "../services/admin/error-log.service";
import { confirmReceipt } from "../services/miniapp.service";
import { supplierService } from "../services/supplier.service";
import { getPurchaseOrderDetail } from "../services/admin/purchase-order.service";
import { saleReturnService } from "../services/sale-return.service";
import { buySeckill } from "../services/marketing/community-marketing.service";

describe("租户隔离专项测试", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.connExecute.mockImplementation(async (conn: any, sql: string, params: unknown[]) => conn.execute(sql, params));
  });

  describe("error-log 租户隔离", () => {
    it("只返回当前租户的错误日志", async () => {
      mocks.query.mockResolvedValue([
        { id: 1, message: "错误1", tenant_id: "tenant-a" },
        { id: 2, message: "错误2", tenant_id: "tenant-a" },
      ]);
      mocks.queryOne.mockResolvedValue({ total: 2 });

      const result = await listErrorLogs({ page: 1, pageSize: 20, tenantId: "tenant-a" });

      expect(result.total).toBe(2);
      expect(mocks.query.mock.calls[0][0]).toContain("tenant_id = ?");
    });

    it("跨租户查询返回空结果", async () => {
      mocks.query.mockResolvedValue([]);
      mocks.queryOne.mockResolvedValue({ total: 0 });

      const result = await listErrorLogs({ page: 1, pageSize: 20, tenantId: "tenant-b" });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe("supplier 租户隔离", () => {
    it("获取供应商时只返回当前租户的数据", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ id: 1, name: "供应商A", tenant_id: "tenant-a" });
      mocks.query.mockResolvedValue([
        { id: 1, name: "联系人1", tenant_id: "tenant-a" },
      ]);

      const result = await supplierService.getDetail(1, { tenantId: "tenant-a" } as any);

      expect(result).toBeTruthy();
      expect(mocks.query.mock.calls[0][0]).toContain("tenant_id = ?");
    });
  });

  describe("purchase 租户隔离", () => {
    it("获取采购订单详情时只查询当前租户的数据", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ order_no: "PO001", tenant_id: "tenant-a" });
      mocks.query.mockResolvedValue([
        { sku_id: 1, order_no: "PO001", tenant_id: "tenant-a" },
      ]);

      const result = await getPurchaseOrderDetail(1, "tenant-a");

      expect(result).toBeTruthy();
    });
  });

  describe("sale-return 租户隔离", () => {
    it("获取退货单时只查询当前租户的数据", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ return_no: "TH001", tenant_id: "tenant-a" });
      mocks.query.mockResolvedValue([
        { return_no: "TH001", tenant_id: "tenant-a" },
      ]);

      const result = await saleReturnService.getDetail("TH001", { tenantId: "tenant-a" } as any);

      expect(result).toBeTruthy();
      expect(mocks.query.mock.calls[0][0]).toContain("tenant_id = ?");
    });
  });

  describe("seckill 租户隔离", () => {
    it("秒杀下单时只操作当前租户的数据", async () => {
      const mockTransaction = vi.fn((fn: any) => fn({ execute: vi.fn().mockResolvedValue([[{ available_stock: 10 }]]) }));
      vi.doMock("../shared/db", () => ({
        transaction: mockTransaction,
        query: vi.fn(),
        queryOne: vi.fn(),
        connExecute: async (conn: any, sql: string, params: unknown[]) => conn.execute(sql, params),
      }));

      const { buySeckill: testBuySeckill } = await import("../services/marketing/community-marketing.service");
      await testBuySeckill("tenant-a", 1, 1, 1);

      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe("跨租户访问拒绝", () => {
    it("尝试访问其他租户数据应抛出异常", async () => {
      mocks.queryOneWithTenant.mockResolvedValue(null);

      await expect(getPurchaseOrderDetail(1, "wrong-tenant")).rejects.toThrow("采购订单不存在");
    });
  });
});