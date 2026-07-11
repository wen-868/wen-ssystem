import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/audit.service.js", () => ({
  listAuditLogs: vi.fn(),
  getAuditStatistics: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as auditService from "../../services/admin/audit.service.js";
import { ok, fail } from "../../shared/response.js";
import {
  listAuditLogs,
  getAuditStatistics,
} from "../../controllers/audit.controller.js";

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

describe("audit.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listAuditLogs - 应返回审计日志列表", async () => {
    (auditService.listAuditLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listAuditLogs(req as any, res as any);
    expect(auditService.listAuditLogs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getAuditStatistics - 应返回审计统计", async () => {
    (auditService.getAuditStatistics as any).mockResolvedValue({ total: 100 });
    const req = mockReq();
    const res = mockRes();
    await getAuditStatistics(req as any, res as any);
    expect(auditService.getAuditStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });
});
