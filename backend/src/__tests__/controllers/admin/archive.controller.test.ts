import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/archive.service.js", () => ({
  archiveBillings: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as archiveService from "../../../services/admin/archive.service.js";
import { ok, fail } from "../../../shared/response.js";
import { executeArchive } from "../../../controllers/admin/archive.controller.js";

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

describe("archive.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("executeArchive - 应执行单据归档（默认参数）", async () => {
    (archiveService.archiveBillings as any).mockResolvedValue({ archived: 10 });
    const req = mockReq({ body: {} });
    const res = mockRes();
    await executeArchive(req as any, res as any);
    expect(archiveService.archiveBillings).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        archiveDays: 365,
        archiveType: "ALL",
        dryRun: true,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("executeArchive - 应传递自定义参数", async () => {
    (archiveService.archiveBillings as any).mockResolvedValue({ archived: 5 });
    const req = mockReq({
      body: {
        archiveDays: 180,
        archiveType: "SALE_BILL",
        dryRun: false,
      },
    });
    const res = mockRes();
    await executeArchive(req as any, res as any);
    expect(archiveService.archiveBillings).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        archiveDays: 180,
        archiveType: "SALE_BILL",
        dryRun: false,
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("executeArchive - 参数校验失败应返回400", async () => {
    const req = mockReq({ body: { archiveDays: 0 } });
    const res = mockRes();
    await executeArchive(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("参数校验失败", "400");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(archiveService.archiveBillings).not.toHaveBeenCalled();
  });

  it("executeArchive - archiveType 无效应返回400", async () => {
    const req = mockReq({ body: { archiveType: "INVALID" } });
    const res = mockRes();
    await executeArchive(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("参数校验失败", "400");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(archiveService.archiveBillings).not.toHaveBeenCalled();
  });
});
