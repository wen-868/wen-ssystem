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

import {
  getCurrentShift,
  settleShift,
  getShiftList,
  createShift,
  deriveShiftType,
} from "../../../services/store/shift.service";

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

  it("deriveShiftType：按开始时间派生班次（t_shift 无 shift_type 列，读侧唯一口径）", () => {
    expect(deriveShiftType("2026-10-01 09:00:00")).toBe("MORNING");
    expect(deriveShiftType("2026-10-01 13:30:00")).toBe("AFTERNOON");
    expect(deriveShiftType("2026-10-01 19:05:00")).toBe("EVENING");
    expect(deriveShiftType("2026-10-01T09:00:00")).toBe("MORNING");
    expect(deriveShiftType(null)).toBe("");
    expect(deriveShiftType("")).toBe("");
  });

  it("createShift：startTime 生效（原被静默忽略，恒取 DB 默认）", async () => {
    mocks.query.mockResolvedValueOnce({ insertId: 7 });
    const result = await createShift("t1", 1, 2, "门店经理", {
      startTime: "2026-10-01 19:00:00",
      openingCash: 100,
      remark: "r",
    });
    const args = mocks.query.mock.calls[0][1] as unknown[];
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO t_shift"),
      expect.anything()
    );
    expect(String(mocks.query.mock.calls[0][0])).toContain("COALESCE(?, CURRENT_TIMESTAMP)");
    // 按字符串入库（不是 Date）：连接池 timezone="Z" 会把 Date 转 UTC，导致用户填的 19:00 变 11:00
    expect(args[5]).toBe("2026-10-01 19:00:00");
    expect(result.shiftType).toBe("EVENING");
  });

  it("createShift：非法 startTime 回落 DB 默认（不写坏库）", async () => {
    mocks.query.mockResolvedValueOnce({ insertId: 8 });
    await createShift("t1", 1, 2, "门店经理", { startTime: "not-a-date" });
    const args = mocks.query.mock.calls[0][1] as unknown[];
    expect(args[5]).toBeNull();
  });

  it("getShiftList：与详情/统计同源读 t_shift，返回 { records, total }", async () => {
    mocks.query.mockResolvedValueOnce([
      {
        id: 1,
        shiftNo: "JB20261001001",
        storeId: 1,
        operatorId: 2,
        operatorName: "门店经理",
        startTime: "2026-10-01 09:00:00",
        endTime: null,
        status: "OPEN",
        openingCash: 200,
        remark: "",
      },
    ]);
    mocks.queryOne
      .mockResolvedValueOnce({ totalSales: 500, orderCount: 3, cashOrderCount: 2, creditOrderCount: 1 })
      .mockResolvedValueOnce({ returnOrderCount: 0 })
      .mockResolvedValueOnce({ totalReceived: 400 });
    mocks.query.mockResolvedValueOnce([{ channel: "CASH", amount: 200 }]);

    const result = await getShiftList("t1", 1, { page: 1, pageSize: 20 });

    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM t_shift"),
      expect.arrayContaining(["t1", 1])
    );
    expect(result.total).toBe(1);
    expect(result.records[0]).toMatchObject({
      shiftNo: "JB20261001001",
      shiftType: "MORNING",
      status: "OPEN",
      totalSalesAmount: 500,
      totalOrders: 3,
    });
  });

  it("getShiftList：shiftType 按派生口径筛选（与列表展示同一取值）", async () => {
    mocks.query.mockResolvedValueOnce([
      { id: 1, shiftNo: "JB-M", storeId: 1, operatorId: null, operatorName: "", startTime: "2026-10-01 09:00:00", endTime: null, status: "OPEN", openingCash: 0, remark: "" },
      { id: 2, shiftNo: "JB-E", storeId: 1, operatorId: null, operatorName: "", startTime: "2026-10-01 20:00:00", endTime: null, status: "OPEN", openingCash: 0, remark: "" },
    ]);
    mocks.queryOne
      .mockResolvedValueOnce({ totalSales: 0, orderCount: 0, cashOrderCount: 0, creditOrderCount: 0 })
      .mockResolvedValueOnce({ returnOrderCount: 0 })
      .mockResolvedValueOnce({ totalReceived: 0 });
    mocks.query.mockResolvedValueOnce([]);

    const result = await getShiftList("t1", 1, { page: 1, pageSize: 20, shiftType: "EVENING" });

    expect(result.total).toBe(1);
    expect(result.records.map((r) => r.shiftNo)).toEqual(["JB-E"]);
  });
});
