import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/store/shift.service", () => ({
  getCurrentShift: vi.fn(),
  settleShift: vi.fn(),
  getShiftHistory: vi.fn(),
  getShiftList: vi.fn(),
  createShift: vi.fn(),
  closeShift: vi.fn(),
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
import { getCurrentShift, settleShift, getShiftHistory, getShiftList, createShift, closeShift } from "../../../controllers/store/shift.controller";

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

  it("getShiftList - 应把 page/pageSize/date/shiftType 透传给服务层（S3-145）", async () => {
    (shiftService.getShiftList as any).mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { page: "3", pageSize: "5", date: "2026-10-01", shiftType: "EVENING" } });
    const res = mockRes();
    await getShiftList(req as any, res as any, vi.fn());
    expect(shiftService.getShiftList).toHaveBeenCalledWith("t1", 1, {
      page: 3,
      pageSize: 5,
      date: "2026-10-01",
      shiftType: "EVENING",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("createShift - startTime/operatorName 应透传给服务层（S3-145）", async () => {
    (shiftService.createShift as any).mockResolvedValue({ shiftNo: "JB1" });
    const req = mockReq({
      body: { startTime: "2026-10-01 19:00:00", operatorName: "张三", openingCash: 100, remark: "r" },
    });
    const res = mockRes();
    await createShift(req as any, res as any, vi.fn());
    expect(shiftService.createShift).toHaveBeenCalledWith("t1", 1, 1, "张三", {
      startTime: "2026-10-01 19:00:00",
      openingCash: 100,
      remark: "r",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("closeShift - 应把 tenantId/storeId/shiftNo 透传给服务层并返回统一成功体（S3-146）", async () => {
    (shiftService.closeShift as any).mockResolvedValue({ shiftNo: "JB20261001001", status: "CLOSED" });
    const req = mockReq({ params: { shiftNo: "JB20261001001" }, body: {} });
    const res = mockRes();
    await closeShift(req as any, res as any, vi.fn());
    expect(shiftService.closeShift).toHaveBeenCalledWith("t1", 1, "JB20261001001");
    expect(ok).toHaveBeenCalledWith({ shiftNo: "JB20261001001", status: "CLOSED" });
  });
});
