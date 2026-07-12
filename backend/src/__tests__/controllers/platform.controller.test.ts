import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@shared/db", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

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
});
