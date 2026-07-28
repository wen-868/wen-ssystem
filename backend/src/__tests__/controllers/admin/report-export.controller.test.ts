import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/report-export.service", () => ({
  exportReport: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as svc from "../../../services/admin/report-export.service";
import { ok } from "../../../shared/response";
import { exportReport } from "../../../controllers/admin/report-export.controller";

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

describe("report-export.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exportReport - 应导出报表（默认excel格式）", async () => {
    (svc.exportReport as any).mockResolvedValue({ downloadUrl: "http://example.com/export.xlsx" });
    const req = mockReq({
      body: {
        report_type: "sales_report",
        filters: { dateStart: "2026-01-01" },
        columns: ["date", "amount"],
      },
    });
    const res = mockRes();
    await exportReport(req as any, res as any, vi.fn());
    expect(svc.exportReport).toHaveBeenCalledWith(
      expect.objectContaining({
        report_type: "sales_report",
        format: "excel",
        filters: { dateStart: "2026-01-01" },
        columns: ["date", "amount"],
      }),
      "t1"
    );
    expect(ok).toHaveBeenCalled();
  });

  it("exportReport - 应传递指定格式", async () => {
    (svc.exportReport as any).mockResolvedValue({ downloadUrl: "http://example.com/export.csv" });
    const req = mockReq({
      body: {
        report_type: "inventory_report",
        format: "csv",
        filters: {},
        columns: [],
      },
    });
    const res = mockRes();
    await exportReport(req as any, res as any, vi.fn());
    expect(svc.exportReport).toHaveBeenCalledWith(
      expect.objectContaining({
        report_type: "inventory_report",
        format: "csv",
      }),
      "t1"
    );
    expect(ok).toHaveBeenCalled();
  });
});
