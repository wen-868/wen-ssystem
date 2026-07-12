import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@shared/db", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { query, queryOne } from "@shared/db";
import { ok } from "@shared/response";
import { getPlatformOverview, listPlatformTenants } from "@controllers/admin/platform.controller";

const mockReq = (overrides: any = {}) => ({
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

describe("platform.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getPlatformOverview - 应获取平台概览", async () => {
    const req = mockReq();
    const res = mockRes();
    await getPlatformOverview(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("listPlatformTenants - 应列出平台租户", async () => {
    const req = mockReq();
    const res = mockRes();
    await listPlatformTenants(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getPlatformOverview - queryOne返回null时使用默认值0", async () => {
    (queryOne as any).mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await getPlatformOverview(req as any, res as any);
    expect(ok).toHaveBeenCalledWith({
      tenantCount: 0,
      userCount: 0,
      storeCount: 0,
      orderCount: 0,
    });
  });

  it("listPlatformTenants - query返回null时使用空数组兜底", async () => {
    (query as any).mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await listPlatformTenants(req as any, res as any);
    expect(ok).toHaveBeenCalledWith([]);
  });
});
