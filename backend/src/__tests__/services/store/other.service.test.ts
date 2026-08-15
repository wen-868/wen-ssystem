import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { createHoldOrder, listHoldOrders, restoreHoldOrder, deleteHoldOrder } from "../../../services/store/other.service";

describe("store/other.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("GD20260815001");
  });

  it("createHoldOrder：创建挂单", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await createHoldOrder({
      customerName: "张三", customerMobile: "13800000000", amount: 100,
      remark: "", items: [{ skuId: 1, qty: 2 }], storeId: 1, tenantId: "t1",
    });
    expect(result.holdNo).toBe("GD20260815001");
    expect(result.status).toBe("HELD");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_hold_order"),
      expect.arrayContaining(["GD20260815001", 1, "t1"]),
      "t1"
    );
  });

  it("listHoldOrders：分页挂单列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ holdNo: "GD001", amount: 50 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listHoldOrders({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].holdNo).toBe("GD001");
  });

  it("restoreHoldOrder：读取挂单并展开 payload", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      holdNo: "GD001", customerName: "张三", amount: 50,
      payload: JSON.stringify({ items: [{ skuId: 1 }] }), status: "HELD",
    });
    const result = await restoreHoldOrder("GD001", "t1");
    expect(result?.holdNo).toBe("GD001");
    expect(result?.items).toEqual([{ skuId: 1 }]);
  });

  it("deleteHoldOrder：删除挂单（状态置 DELETED）", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await deleteHoldOrder("GD001", "t1");
    expect(result.status).toBe("DELETED");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'DELETED'"),
      expect.arrayContaining(["GD001", "t1"]),
      "t1"
    );
  });
});
