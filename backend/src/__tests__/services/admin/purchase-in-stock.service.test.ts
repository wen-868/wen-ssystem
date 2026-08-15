import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

vi.mock("../../../shared/trace-code", () => ({
  bindTraceCodeOnInStock: vi.fn(),
}));

import { list, getDetail } from "../../../services/admin/purchase-in-stock.service";

describe("admin/purchase-in-stock.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("list：分页采购入库单列表", async () => {
    mocks.query.mockResolvedValueOnce([{ stock_no: "RK001", stock_status: "PENDING" }]);
    const result = await list({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result).toHaveLength(1);
    expect(result[0].stock_no).toBe("RK001");
  });

  it("getDetail：返回入库单详情含明细", async () => {
    mocks.queryOne.mockResolvedValueOnce({ stock_no: "RK001", stock_status: "PENDING" });
    mocks.query.mockResolvedValueOnce([{ sku_id: 1, sku_name: "酒" }]);
    const detail = await getDetail("RK001", "t1");
    expect(detail.stock_no).toBe("RK001");
    expect(detail.items).toHaveLength(1);
  });

  it("getDetail：入库单不存在抛 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(getDetail("NOPE", "t1")).rejects.toThrow("入库单不存在");
  });
});
