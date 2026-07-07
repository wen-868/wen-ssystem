import { describe, it, expect, vi } from "vitest";
import { tenantMiddleware, getTenantId, setTenantId } from "../../shared/tenant.js";
import type { Request, Response, NextFunction } from "express";

describe("tenant middleware", () => {
  describe("tenantMiddleware", () => {
    it("有 tenantId 应挂载到 req 并调用 next", () => {
      const req = {
        user: { tenantId: "tenant-123" },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      tenantMiddleware(req as any, res, next);

      expect(req.tenantId).toBe("tenant-123");
      expect(next).toHaveBeenCalled();
    });

    it("无 tenantId 应返回 403", () => {
      const req = {
        user: { tenantId: undefined },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      tenantMiddleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("无 user 对象应返回 403", () => {
      const req = {} as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      tenantMiddleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("getTenantId", () => {
    it("应返回 req 上的 tenantId", () => {
      const req = { tenantId: "tenant-456" } as unknown as Request;
      expect(getTenantId(req)).toBe("tenant-456");
    });

    it("无 tenantId 时返回 default", () => {
      const req = {} as Request;
      expect(getTenantId(req)).toBe("default");
    });
  });

  describe("setTenantId", () => {
    it("应设置 req 上的 tenantId", () => {
      const req = {} as Request;
      setTenantId(req, "tenant-789");
      expect((req as any).tenantId).toBe("tenant-789");
    });
  });
});
