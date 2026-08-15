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

import { reportLossGain, listLossGains } from "../../../services/admin/inventory-loss-gain.service";

describe("admin/inventory-loss-gain.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("SY20260815001");
  });

  it("reportLossGain：报损并更新库存与台账", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await reportLossGain({
      storeId: 1, type: "LOSS", skuId: 10, qty: 2, costPrice: 100,
      reason: "破损", operatorId: 1, tenantId: "t1",
    });
    expect(result.lgNo).toBe("SY20260815001");
    expect(result.amount).toBe(200);
    // 库存扣减（-2）
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE t_inventory_balance"),
      expect.arrayContaining([-2, 1, 10, "t1"]),
      "t1"
    );
  });

  it("listLossGains：分页损益列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ lg_no: "SY001", type: "LOSS" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listLossGains({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].lg_no).toBe("SY001");
  });
});
