import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@shared/db", () => ({
  queryOne: vi.fn().mockResolvedValue({ cnt: 0 }),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@shared/env", () => ({
  env: { NODE_ENV: "test" },
}));

vi.mock("@shared/migration", () => ({
  runMigrations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@shared/logger", () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

import { ok } from "@shared/response";
import { healthCheck, getSystemInfo, runSystemMigration } from "@controllers/admin/system.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

describe("system.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("healthCheck - 应返回健康状态", async () => {
    const req = mockReq();
    const res = mockRes();
    await healthCheck(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("getSystemInfo - 应返回系统信息", async () => {
    const req = mockReq();
    const res = mockRes();
    await getSystemInfo(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });

  it("runSystemMigration - 应执行迁移", async () => {
    const req = mockReq();
    const res = mockRes();
    await runSystemMigration(req as any, res as any);
    expect(ok).toHaveBeenCalled();
  });
});
