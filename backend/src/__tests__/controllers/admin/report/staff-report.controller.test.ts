import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../../services/admin/report/staff-report.service", () => ({
  getStaffPerformanceRanking: vi.fn(),
}));

vi.mock("../../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as staffReportService from "../../../../services/admin/report/staff-report.service";
import { ok } from "../../../../shared/response";
import { getStaffPerformanceRanking } from "../../../../controllers/admin/report/staff-report.controller";

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

describe("report/staff-report.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getStaffPerformanceRanking - 应返回员工业绩排名（默认参数）", async () => {
    (staffReportService.getStaffPerformanceRanking as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getStaffPerformanceRanking(req as any, res as any, vi.fn());
    expect(staffReportService.getStaffPerformanceRanking).toHaveBeenCalledWith(
      "t1",
      undefined,
      undefined,
      20
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getStaffPerformanceRanking - 应传递日期范围和limit", async () => {
    (staffReportService.getStaffPerformanceRanking as any).mockResolvedValue([]);
    const req = mockReq({
      query: { dateStart: "2026-01-01", dateEnd: "2026-12-31", limit: "10" },
    });
    const res = mockRes();
    await getStaffPerformanceRanking(req as any, res as any, vi.fn());
    expect(staffReportService.getStaffPerformanceRanking).toHaveBeenCalledWith(
      "t1",
      "2026-01-01",
      "2026-12-31",
      10
    );
    expect(ok).toHaveBeenCalled();
  });
});
