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

import { ok, fail } from "@shared/response";
import { queryOne } from "@shared/db";
import { runMigrations } from "@shared/migration";
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

  // ==================== 分支覆盖率补充测试 ====================
  it("getSystemInfo - queryOne返回null时使用默认值0", async () => {
    (queryOne as any).mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await getSystemInfo(req as any, res as any);
    expect(ok).toHaveBeenCalledWith(expect.objectContaining({
      userCount: 0, roleCount: 0, configCount: 0
    }));
  });

  it("runSystemMigration - 迁移失败应返回500", async () => {
    (runMigrations as any).mockRejectedValue(new Error("迁移错误"));
    const req = mockReq();
    const res = mockRes();
    await runSystemMigration(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(fail).toHaveBeenCalled();
  });
});
