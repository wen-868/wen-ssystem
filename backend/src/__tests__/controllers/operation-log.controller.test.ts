import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@shared/db", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue({ total: 0 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { ok } from "@shared/response";
import { listOperationLogs, getOperationLogStatistics } from "@controllers/operation-log.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  query: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

describe("operation-log.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listOperationLogs - 应列出操作日志", async () => {
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listOperationLogs(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getOperationLogStatistics - 应获取操作日志统计", async () => {
    const req = mockReq();
    const res = mockRes();
    await getOperationLogStatistics(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
