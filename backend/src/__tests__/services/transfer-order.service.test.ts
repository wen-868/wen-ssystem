import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import {
  listTransferOrders,
  getTransferStatistics,
  getTransferOrderDetail,
} from "../../services/transfer-order.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transfer-order.service - 调拨单", () => {
  it("listTransferOrders 全量分页查询", async () => {
    mocks.queryWithTenant.mockResolvedValue([{ id: 1, order_no: "DB1" }]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 1 });
    const res = await listTransferOrders({ tenantId, page: 1, pageSize: 20 });
    expect(res.total).toBe(1);
    expect(res.records[0].order_no).toBe("DB1");
    expect(String(mocks.queryWithTenant.mock.calls[0][0])).toContain("LEFT JOIN t_store");
  });

  it("listTransferOrders 带状态/门店/日期筛选", async () => {
    mocks.queryWithTenant.mockResolvedValue([]);
    mocks.queryOneWithTenant.mockResolvedValue({ total: 0 });
    await listTransferOrders({ tenantId, page: 1, pageSize: 10, status: "TRANSIT", storeId: 2, dateStart: "2026-08-01", dateEnd: "2026-08-10" });
    const sql = String(mocks.queryWithTenant.mock.calls[0][0]);
    expect(sql).toContain("to_.status = ?");
    expect(sql).toContain("from_store_id = ? OR to_.to_store_id = ?");
    expect(sql).toContain("to_.created_at >= ?");
    expect(sql).toContain("to_.created_at <= ?");
    const values = mocks.queryWithTenant.mock.calls[0][1];
    expect(values).toContain("2026-08-10 23:59:59");
  });

  it("getTransferStatistics 返回三项统计", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ total: 5 })
      .mockResolvedValueOnce({ total: 2 })
      .mockResolvedValueOnce({ total: 3 });
    const stats = await getTransferStatistics(tenantId);
    expect(stats).toEqual({ monthTotal: 5, transitCount: 2, receivedCount: 3 });
  });

  it("getTransferOrderDetail 存在时返回订单与明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, order_no: "DB1" });
    mocks.queryWithTenant.mockResolvedValue([{ sku_id: 1, qty: 10 }]);
    const detail = await getTransferOrderDetail(1, tenantId);
    expect(detail.order_no).toBe("DB1");
    expect(detail.items).toHaveLength(1);
  });

  it("getTransferOrderDetail 不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(getTransferOrderDetail(99, tenantId))
      .rejects.toMatchObject({ statusCode: 404, message: "调拨单不存在" });
  });
});
