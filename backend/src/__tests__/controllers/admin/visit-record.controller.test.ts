import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/visit-record.service", () => ({
  checkinSchema: { parse: (v: any) => v },
  checkoutSchema: { parse: (v: any) => v },
  listVisitRecords: vi.fn(),
  getVisitRecordDetail: vi.fn(),
  checkin: vi.fn(),
  checkout: vi.fn(),
  listPendingFollowUps: vi.fn(),
  getVisitStatistics: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as visitRecordService from "../../../services/admin/visit-record.service";
import { ok } from "../../../shared/response";
import {
  listVisitRecords,
  getVisitRecordDetail,
  checkin,
  checkout,
  listPendingFollowUps,
  getVisitStatistics,
} from "../../../controllers/admin/visit-record.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
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

describe("visit-record.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listVisitRecords - 应返回拜访记录列表", async () => {
    (visitRecordService.listVisitRecords as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listVisitRecords(req as any, res as any, vi.fn());
    expect(visitRecordService.listVisitRecords).toHaveBeenCalledWith("t1", expect.any(Object));
    expect(ok).toHaveBeenCalled();
  });

  it("getVisitRecordDetail - 应返回拜访记录详情", async () => {
    (visitRecordService.getVisitRecordDetail as any).mockResolvedValue({ visitNo: "VR123" });
    const req = mockReq({ params: { visitNo: "VR123" } });
    const res = mockRes();
    await getVisitRecordDetail(req as any, res as any, vi.fn());
    expect(visitRecordService.getVisitRecordDetail).toHaveBeenCalledWith("t1", "VR123");
    expect(ok).toHaveBeenCalled();
  });

  it("checkin - 应签到", async () => {
    (visitRecordService.checkin as any).mockResolvedValue({ visitNo: "VR123" });
    const req = mockReq({ params: { visitNo: "VR123" }, body: { latitude: 0, longitude: 0 } });
    const res = mockRes();
    await checkin(req as any, res as any, vi.fn());
    expect(visitRecordService.checkin).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("checkout - 应签退", async () => {
    (visitRecordService.checkout as any).mockResolvedValue({ visitNo: "VR123" });
    const req = mockReq({ params: { visitNo: "VR123" }, body: { remark: "拜访完成" } });
    const res = mockRes();
    await checkout(req as any, res as any, vi.fn());
    expect(visitRecordService.checkout).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listPendingFollowUps - 应返回待跟进列表", async () => {
    (visitRecordService.listPendingFollowUps as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPendingFollowUps(req as any, res as any, vi.fn());
    expect(visitRecordService.listPendingFollowUps).toHaveBeenCalledWith("t1", 1, 1, 20);
    expect(ok).toHaveBeenCalled();
  });

  it("listPendingFollowUps - 应使用指定visitorId", async () => {
    (visitRecordService.listPendingFollowUps as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { visitor_id: "2", page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPendingFollowUps(req as any, res as any, vi.fn());
    expect(visitRecordService.listPendingFollowUps).toHaveBeenCalledWith("t1", 2, 1, 20);
    expect(ok).toHaveBeenCalled();
  });

  it("getVisitStatistics - 应返回拜访统计", async () => {
    (visitRecordService.getVisitStatistics as any).mockResolvedValue({ total: 0 });
    const req = mockReq({ query: { start_date: "2026-01-01", end_date: "2026-01-31" } });
    const res = mockRes();
    await getVisitStatistics(req as any, res as any, vi.fn());
    expect(visitRecordService.getVisitStatistics).toHaveBeenCalledWith("t1", null, "2026-01-01", "2026-01-31");
    expect(ok).toHaveBeenCalled();
  });

  it("getVisitStatistics - 应支持指定visitorId", async () => {
    (visitRecordService.getVisitStatistics as any).mockResolvedValue({ total: 0 });
    const req = mockReq({ query: { visitor_id: "2" } });
    const res = mockRes();
    await getVisitStatistics(req as any, res as any, vi.fn());
    expect(visitRecordService.getVisitStatistics).toHaveBeenCalledWith("t1", 2, expect.any(String), expect.any(String));
    expect(ok).toHaveBeenCalled();
  });
});
