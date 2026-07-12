import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/audit.service", () => ({
  listAuditLogs: vi.fn(),
  getAuditStatistics: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as auditService from "@services/admin/audit.service";
import { ok } from "@shared/response";
import { listAuditLogs, getAuditStatistics } from "@controllers/audit.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

  it("listAuditLogs - 应支持筛选参数", async () => {
    (auditService.listAuditLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: {
        page: 2,
        pageSize: 10,
        userId: 1,
        action: "CREATE",
        resourceType: "ORDER",
        dateStart: "2024-01-01",
        dateEnd: "2024-01-31",
      },
    });
    const res = mockRes();
    await listAuditLogs(req as any, res as any);
    expect(auditService.listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      pageSize: 10,
      userId: 1,
      action: "CREATE",
      resourceType: "ORDER",
      dateStart: "2024-01-01",
      dateEnd: "2024-01-31",
      tenantId: "t1",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("listAuditLogs - zod验证失败", async () => {
    const req = mockReq({ query: { page: "invalid", pageSize: 200 } });
    const res = mockRes();
    await expect(listAuditLogs(req as any, res as any)).rejects.toThrow();
  });

  it("getAuditStatistics - 应返回审计统计", async () => {
    (auditService.getAuditStatistics as any).mockResolvedValue({ totalActions: 0, topUsers: [] });
    const req = mockReq();
    const res = mockRes();
    await getAuditStatistics(req as any, res as any);
    expect(auditService.getAuditStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });
});