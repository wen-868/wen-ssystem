import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../../services/admin/report/customer-report.service", () => ({
  getCustomerContribution: vi.fn(),
}));

vi.mock("../../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as customerReportService from "../../../../services/admin/report/customer-report.service";
import { ok } from "../../../../shared/response";
import { getCustomerContribution } from "../../../../controllers/admin/report/customer-report.controller";

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

describe("report/customer-report.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getCustomerContribution - 应返回客户贡献（默认分页）", async () => {
    (customerReportService.getCustomerContribution as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq();
    const res = mockRes();
    await getCustomerContribution(req as any, res as any, vi.fn());
    expect(customerReportService.getCustomerContribution).toHaveBeenCalledWith(
      "t1",
      1,
      20,
      undefined,
      undefined
    );
    expect(ok).toHaveBeenCalled();
  });

  it("getCustomerContribution - 应传递分页和日期范围", async () => {
    (customerReportService.getCustomerContribution as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: { page: "2", pageSize: "10", dateStart: "2026-01-01", dateEnd: "2026-12-31" },
    });
    const res = mockRes();
    await getCustomerContribution(req as any, res as any, vi.fn());
    expect(customerReportService.getCustomerContribution).toHaveBeenCalledWith(
      "t1",
      2,
      10,
      "2026-01-01",
      "2026-12-31"
    );
    expect(ok).toHaveBeenCalled();
  });
});
