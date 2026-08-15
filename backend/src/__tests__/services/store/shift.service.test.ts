import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  makeBizNo: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: mocks.makeBizNo,
}));

import { getCurrentShift, settleShift } from "../../../services/store/shift.service";

describe("store/shift.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.makeBizNo.mockReturnValue("BJ20260815001");
  });

  it("getCurrentShift：汇总销售/退货/收款统计", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ startTime: "2026-08-15 09:00:00" }) // 首笔销售
      .mockResolvedValueOnce({ totalSales: 500, orderCount: 3, cashOrderCount: 2, creditOrderCount: 1 }) // 销售
      .mockResolvedValueOnce({ returnOrderCount: 1 }) // 退货
      .mockResolvedValueOnce({ totalReceived: 400 }); // 收款
    mocks.query.mockResolvedValueOnce([
      { channel: "CASH", amount: 200 },
      { channel: "WECHAT", amount: 200 },
    ]);

    const result = await getCurrentShift("t1", 1);
    expect(result.totalSales).toBe(500);
    expect(result.orderCount).toBe(3);
    expect(result.totalReceived).toBe(400);
    expect(result.paymentBreakdown).toHaveLength(2);
    expect(result.operatingHours).toContain("时");
  });

  it("settleShift：生成班次结算并写入日结表", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ startTime: "2026-08-15 09:00:00" })
      .mockResolvedValueOnce({ totalSales: 500, orderCount: 3, cashOrderCount: 2, creditOrderCount: 1 })
      .mockResolvedValueOnce({ returnOrderCount: 1 })
      .mockResolvedValueOnce({ totalReceived: 400 });
    mocks.query.mockResolvedValueOnce([
      { channel: "CASH", amount: 200 },
      { channel: "WECHAT", amount: 200 },
    ]);
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 }); // INSERT 日结

    const result = await settleShift("t1", 1, 5, 400);
    expect(result.settleNo).toBe("BJ20260815001");
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_daily_settlement"),
      expect.arrayContaining(["t1", "BJ20260815001"])
    );
  });
});
