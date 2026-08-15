import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  queryOneWithTenant: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import { saleReturnService } from "../../services/sale-return.service";

describe("sale-return reject", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("待审核退货单可驳回", async () => {
    mocks.queryOne.mockResolvedValueOnce({ return_no: "TH001", return_status: "PENDING" });
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    const result = await saleReturnService.reject("TH001", { tenantId: "t1", userId: 2 } as any);
    expect(result?.returnNo).toBe("TH001");
    expect(mocks.queryWithTenant).toHaveBeenCalledWith(
      expect.stringContaining("SET return_status = 'REJECTED'"),
      [2, "TH001", "t1"],
      "t1"
    );
  });

  it("非待审核状态不可驳回", async () => {
    mocks.queryOne.mockResolvedValueOnce({ return_no: "TH001", return_status: "COMPLETED" });
    await expect(saleReturnService.reject("TH001", { tenantId: "t1", userId: 2 } as any))
      .rejects.toThrow("只有待审核状态的退货单可以驳回");
  });
});
