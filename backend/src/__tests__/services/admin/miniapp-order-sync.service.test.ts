/**
 * miniapp-order-sync.service 单元测试（ajian_retail_fix_01）
 *
 * 覆盖：status 数字归一化（VARCHAR SUCCESS/FAILED → 0/1/2）、租户过滤、重试语义。
 * 背景：原查询引用 tenant_id/platform_order_no/response/updated_at 列，
 * 而 049 建表缺这些列，生产 GET /api/miniapp-order-sync 500；迁移 125 补列后
 * service 改为 CASE 归一化 status，重试置 PENDING。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { listSyncLogs, retrySync } from "../../../services/admin/miniapp-order-sync.service";

describe("services/admin/miniapp-order-sync", () => {
  beforeEach(() => vi.resetAllMocks());

  describe("listSyncLogs", () => {
    it("查询使用 CASE 归一化 status 并携带租户条件", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
      mocks.queryWithTenant.mockResolvedValue([
        {
          id: 1,
          orderNo: "MO001",
          platformOrderNo: "PLAT001",
          status: 1,
          response: "ok",
          createdAt: new Date("2026-08-08T00:00:00Z"),
          updatedAt: new Date("2026-08-08T00:00:00Z"),
        },
      ]);

      const res = await listSyncLogs("t1", { page: 1, pageSize: 20 });

      expect(res.total).toBe(1);
      expect(res.records[0]).toMatchObject({ orderNo: "MO001", platformOrderNo: "PLAT001", status: 1 });
      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("WHERE tenant_id = ?"),
        ["t1"],
        "t1"
      );
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("CASE WHEN status IN ('SUCCESS','1') THEN 1 WHEN status IN ('FAILED','2') THEN 2 ELSE 0 END AS status"),
        expect.any(Array),
        "t1"
      );
    });

    it("status 筛选使用 CASE 归一化比较（前端数字 → 表内字符串）", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      mocks.queryWithTenant.mockResolvedValue([]);

      await listSyncLogs("t1", { page: 1, pageSize: 20, status: 2 });

      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("CASE WHEN status IN ('SUCCESS','1') THEN 1 WHEN status IN ('FAILED','2') THEN 2 ELSE 0 END = ?"),
        ["t1", 2],
        "t1"
      );
    });

    it("orderNo 筛选使用 LIKE", async () => {
      mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
      mocks.queryWithTenant.mockResolvedValue([]);

      await listSyncLogs("t1", { page: 1, pageSize: 20, orderNo: "MO" });

      expect(mocks.queryOneWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("order_no LIKE ?"),
        ["t1", "%MO%"],
        "t1"
      );
    });
  });

  describe("retrySync", () => {
    it("重试将状态置为 PENDING 并更新时间", async () => {
      mocks.queryWithTenant.mockResolvedValue({ affectedRows: 1 });

      const res = await retrySync("t1", "MO001");

      expect(res).toEqual({ orderNo: "MO001", status: 0 });
      expect(mocks.queryWithTenant).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'PENDING', updated_at = NOW()"),
        ["MO001", "t1"],
        "t1"
      );
    });
  });
});
