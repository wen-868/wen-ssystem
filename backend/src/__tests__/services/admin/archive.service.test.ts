/**
 * 管理端历史单据归档 service 单元测试
 * 被测文件：src/services/admin/archive.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: vi.fn(),
  transaction: mocks.transaction,
}));

import { archiveBillings } from "../../../services/admin/archive.service";

describe("archive.service", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("archiveBillings - SALE_BILL", () => {
    it("dryRun 模式返回试运行结果不执行事务", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ cnt: 50 }]);
      const res = await archiveBillings({
        tenantId: "t1",
        archiveDays: 90,
        archiveType: "SALE_BILL",
        dryRun: true,
      });
      expect(res.length).toBe(1);
      expect(res[0].archiveType).toBe("SALE_BILL");
      expect(res[0].archivedCount).toBe(0);
      expect(res[0].remainingCount).toBe(50);
      expect(res[0].message).toContain("试运行");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("无待归档数据时返回提示", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ cnt: 0 }]);
      const res = await archiveBillings({
        tenantId: "t1", archiveDays: 30, archiveType: "SALE_BILL", dryRun: false,
      });
      expect(res[0].archivedCount).toBe(0);
      expect(res[0].message).toBe("无待归档数据");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("执行归档调用事务并迁移 SALE_BILL 及其子表", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ cnt: 5 }]);
      const conn = { execute: vi.fn().mockResolvedValue(undefined) };
      mocks.transaction.mockImplementation(async (cb: any) => cb(conn));
      const res = await archiveBillings({
        tenantId: "t1", archiveDays: 30, archiveType: "SALE_BILL", dryRun: false,
      });
      expect(res[0].archivedCount).toBe(5);
      expect(res[0].remainingCount).toBe(0);
      expect(mocks.transaction).toHaveBeenCalledTimes(1);
      // SALE_BILL 事务中执行：主表INSERT、子表INSERT、子表DELETE、主表DELETE = 4 次
      expect(conn.execute).toHaveBeenCalledTimes(4);
      const firstSql = conn.execute.mock.calls[0][0] as string;
      expect(firstSql).toContain("INSERT INTO t_sale_bill_archive");
    });
  });

  describe("archiveBillings - PURCHASE_ORDER", () => {
    it("执行归档迁移 PURCHASE_ORDER 及其子表", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ cnt: 3 }]);
      const conn = { execute: vi.fn().mockResolvedValue(undefined) };
      mocks.transaction.mockImplementation(async (cb: any) => cb(conn));
      const res = await archiveBillings({
        tenantId: "t1", archiveDays: 60, archiveType: "PURCHASE_ORDER", dryRun: false,
      });
      expect(res[0].archivedCount).toBe(3);
      expect(conn.execute).toHaveBeenCalledTimes(4);
      expect(conn.execute.mock.calls[0][0]).toContain("INSERT INTO t_purchase_order_archive");
    });
  });

  describe("archiveBillings - INVENTORY_LEDGER", () => {
    it("执行归档仅迁移主表（无子表）", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ cnt: 8 }]);
      const conn = { execute: vi.fn().mockResolvedValue(undefined) };
      mocks.transaction.mockImplementation(async (cb: any) => cb(conn));
      const res = await archiveBillings({
        tenantId: "t1", archiveDays: 90, archiveType: "INVENTORY_LEDGER", dryRun: false,
      });
      expect(res[0].archivedCount).toBe(8);
      // INVENTORY_LEDGER 无子表：主表 INSERT + 主表 DELETE = 2 次
      expect(conn.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("archiveBillings - ALL", () => {
    it("ALL 类型时遍历三种类型并各自返回结果", async () => {
      // 每种类型一次 count 查询
      mocks.queryWithTenant
        .mockResolvedValueOnce([{ cnt: 1 }])  // SALE_BILL
        .mockResolvedValueOnce([{ cnt: 2 }])  // PURCHASE_ORDER
        .mockResolvedValueOnce([{ cnt: 3 }]); // INVENTORY_LEDGER
      const conn = { execute: vi.fn().mockResolvedValue(undefined) };
      mocks.transaction.mockImplementation(async (cb: any) => cb(conn));
      const res = await archiveBillings({
        tenantId: "t1", archiveDays: 30, archiveType: "ALL", dryRun: false,
      });
      expect(res.length).toBe(3);
      expect(res[0].archiveType).toBe("SALE_BILL");
      expect(res[0].archivedCount).toBe(1);
      expect(res[1].archiveType).toBe("PURCHASE_ORDER");
      expect(res[1].archivedCount).toBe(2);
      expect(res[2].archiveType).toBe("INVENTORY_LEDGER");
      expect(res[2].archivedCount).toBe(3);
    });

    it("ALL dryRun 模式不执行事务", async () => {
      mocks.queryWithTenant
        .mockResolvedValueOnce([{ cnt: 10 }])
        .mockResolvedValueOnce([{ cnt: 20 }])
        .mockResolvedValueOnce([{ cnt: 30 }]);
      const res = await archiveBillings({
        tenantId: "t1", archiveDays: 30, archiveType: "ALL", dryRun: true,
      });
      expect(res.length).toBe(3);
      res.forEach(r => expect(r.archivedCount).toBe(0));
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("archiveBillings - cutoff 日期计算", () => {
    it("archiveDays 影响查询参数的 cutoff 日期", async () => {
      mocks.queryWithTenant.mockResolvedValue([{ cnt: 0 }]);
      await archiveBillings({
        tenantId: "t1", archiveDays: 365, archiveType: "SALE_BILL", dryRun: false,
      });
      const [, params] = mocks.queryWithTenant.mock.calls[0];
      expect(params[0]).toBe("t1");
      // 第二个参数应为 cutoff 日期字符串 YYYY-MM-DD
      expect(typeof params[1]).toBe("string");
      expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
