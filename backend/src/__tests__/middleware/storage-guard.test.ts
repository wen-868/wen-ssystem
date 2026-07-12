import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryOneWithTenant, mockFail, mockLogger } = vi.hoisted(() => ({
  mockQueryOneWithTenant: vi.fn(),
  mockFail: vi.fn((msg: string, code?: string) => ({ code: code || "400", msg, traceId: "test", apiCost: 1 })),
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: mockQueryOneWithTenant,
}));

vi.mock("../../shared/response", () => ({
  fail: mockFail,
  ok: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: mockLogger,
}));

import { storageGuard } from "../../middleware/storage-guard";
import type { Request, Response, NextFunction } from "express";

function mockReqRes(opts?: { tenantId?: string; headerTenantId?: string }) {
  const req = {
    headers: {
      "x-tenant-id": opts?.headerTenantId,
    },
  } as unknown as Request;
  if (opts?.tenantId) {
    (req as any).tenantId = opts.tenantId;
  }
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("storage-guard middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无 tenantId 直接放行", async () => {
    const { req, res, next } = mockReqRes();
    const mw = storageGuard();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockQueryOneWithTenant).not.toHaveBeenCalled();
  });

  it("从 header 取 tenantId", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce({ storageLimit: 500, unit: "MB" })
      .mockResolvedValueOnce({ usedBytes: 100 * 1024 * 1024 });
    const { req, res, next } = mockReqRes({ headerTenantId: "test-tenant" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockQueryOneWithTenant).toHaveBeenCalled();
    expect((req as any).storageUsage).toBeDefined();
  });

  it("从 req.tenantId 取 tenantId（优先级更高）", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce({ storageLimit: 500, unit: "MB" })
      .mockResolvedValueOnce({ usedBytes: 100 * 1024 * 1024 });
    const { req, res, next } = mockReqRes({ tenantId: "from-req", headerTenantId: "from-header" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(mockQueryOneWithTenant).toHaveBeenCalledWith(
      expect.any(String),
      ["from-req"],
      "from-req"
    );
  });

  it("容量未满时放行并设置 storageUsage", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce({ storageLimit: 500, unit: "MB" })
      .mockResolvedValueOnce({ usedBytes: 100 * 1024 * 1024 });
    const { req, res, next } = mockReqRes({ tenantId: "t1" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).storageUsage).toEqual({
      usedBytes: 100 * 1024 * 1024,
      limitBytes: 500 * 1024 * 1024,
    });
  });

  it("容量已满返回 400 + code 1002", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce({ storageLimit: 500, unit: "MB" })
      .mockResolvedValueOnce({ usedBytes: 600 * 1024 * 1024 });
    const { req, res, next } = mockReqRes({ tenantId: "t1" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFail).toHaveBeenCalledWith(
      "存储容量已满，请联系管理员升级套餐",
      "1002"
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("刚好等于限制时判定为已满", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce({ storageLimit: 500, unit: "MB" })
      .mockResolvedValueOnce({ usedBytes: 500 * 1024 * 1024 });
    const { req, res, next } = mockReqRes({ tenantId: "t1" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("无租户配置时使用默认 500MB 限制", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ usedBytes: 100 * 1024 * 1024 });
    const { req, res, next } = mockReqRes({ tenantId: "t1" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).storageUsage.limitBytes).toBe(500 * 1024 * 1024);
  });

  it("GB 单位的配额计算正确", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce({ storageLimit: 2, unit: "GB" })
      .mockResolvedValueOnce({ usedBytes: 1024 * 1024 * 1024 });
    const { req, res, next } = mockReqRes({ tenantId: "t1" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).storageUsage.limitBytes).toBe(2 * 1024 * 1024 * 1024);
  });

  it("查询失败时降级放行", async () => {
    mockQueryOneWithTenant.mockRejectedValue(new Error("DB Error"));
    const { req, res, next } = mockReqRes({ tenantId: "t1" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("usage 为 null 时 usedBytes 为 0", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce({ storageLimit: 500, unit: "MB" })
      .mockResolvedValueOnce(null);
    const { req, res, next } = mockReqRes({ tenantId: "t1" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).storageUsage.usedBytes).toBe(0);
  });

  it("usedBytes 字段不存在时为 0", async () => {
    mockQueryOneWithTenant
      .mockResolvedValueOnce({ storageLimit: 500, unit: "MB" })
      .mockResolvedValueOnce({});
    const { req, res, next } = mockReqRes({ tenantId: "t1" });
    const mw = storageGuard();
    await mw(req, res, next);
    expect((req as any).storageUsage.usedBytes).toBe(0);
  });
});
