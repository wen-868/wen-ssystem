import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/store/shift.service", () => ({
  getCurrentShift: vi.fn(),
  settleShift: vi.fn(),
  getShiftHistory: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as shiftService from "../../../services/store/shift.service";
import { ok } from "../../../shared/response";
import { getCurrentShift, settleShift, getShiftHistory } from "../../../controllers/store/shift.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "storeuser", storeId: 1 },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("store/shift.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getCurrentShift - 应返回当前班次", async () => {
    (shiftService.getCurrentShift as any).mockResolvedValue({ id: 1, status: "OPEN" });
    const req = mockReq();
    const res = mockRes();
    await getCurrentShift(req as any, res as any, vi.fn());
    expect(shiftService.getCurrentShift).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("settleShift - 应结算班次", async () => {
    (shiftService.settleShift as any).mockResolvedValue({ id: 1, status: "CLOSED" });
    const req = mockReq({ body: { actualAmount: 1000 } });
    const res = mockRes();
    await settleShift(req as any, res as any, vi.fn());
    expect(shiftService.settleShift).toHaveBeenCalledWith("t1", 1, 1, 1000);
    expect(ok).toHaveBeenCalled();
  });

  it("settleShift - 无 actualAmount 时使用默认值 0", async () => {
    (shiftService.settleShift as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: {} });
    const res = mockRes();
    await settleShift(req as any, res as any, vi.fn());
    expect(shiftService.settleShift).toHaveBeenCalledWith("t1", 1, 1, 0);
    expect(ok).toHaveBeenCalled();
  });

  it("getShiftHistory - 应返回班次历史", async () => {
    (shiftService.getShiftHistory as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: "2", pageSize: "10" } });
    const res = mockRes();
    await getShiftHistory(req as any, res as any, vi.fn());
    expect(shiftService.getShiftHistory).toHaveBeenCalledWith("t1", 1, 2, 10);
    expect(ok).toHaveBeenCalled();
  });

  it("getShiftHistory - 无参数时使用默认值", async () => {
    (shiftService.getShiftHistory as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await getShiftHistory(req as any, res as any, vi.fn());
    expect(shiftService.getShiftHistory).toHaveBeenCalledWith("t1", 1, 1, 20);
    expect(ok).toHaveBeenCalled();
  });
});
