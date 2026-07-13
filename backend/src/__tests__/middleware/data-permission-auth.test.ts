import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/data-permission.service", () => ({
  getUserDataPermissions: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import * as service from "@services/admin/data-permission.service";
import { fail } from "@shared/response";
import { requireDataPermission, getDataPermissionFilter, getUserDataPermissionContext } from "@middleware/data-permission-auth";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", roles: [] },
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn();
  return res;
};

describe("data-permission-auth", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("requireDataPermission", () => {
    it("应允许超级管理员访问", async () => {
      const req = mockReq({ user: { id: 1, roles: ["SUPER_ADMIN"] } });
      const res = mockRes();
      const next = vi.fn();
      await requireDataPermission("STORE", () => 1)(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.dataPermission.hasAllPermission).toBe(true);
    });

    it("应允许有ALL权限的用户访问", async () => {
      (service.getUserDataPermissions as any).mockResolvedValue([
        { permission_type: "ALL", scopeValues: null },
      ]);
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      await requireDataPermission("STORE", () => 1)(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.dataPermission.hasAllPermission).toBe(true);
    });

    it("应允许有匹配范围的用户访问", async () => {
      (service.getUserDataPermissions as any).mockResolvedValue([
        { permission_type: "STORE", scopeValues: "[1,2,3]" },
      ]);
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      await requireDataPermission("STORE", () => 2)(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
    });

    it("应拒绝无权限的用户访问", async () => {
      (service.getUserDataPermissions as any).mockResolvedValue([
        { permission_type: "STORE", scopeValues: "[1,2,3]" },
      ]);
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      await requireDataPermission("STORE", () => 99)(req as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("应拒绝未登录用户", async () => {
      const req = mockReq({ user: undefined });
      const res = mockRes();
      const next = vi.fn();
      await requireDataPermission("STORE", () => 1)(req as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("空scopeValues时应允许访问", async () => {
      (service.getUserDataPermissions as any).mockResolvedValue([
        { permission_type: "STORE", scopeValues: null },
      ]);
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      await requireDataPermission("STORE", () => 1)(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
    });

    it("targetId为null时应允许访问", async () => {
      (service.getUserDataPermissions as any).mockResolvedValue([
        { permission_type: "STORE", scopeValues: "[1,2,3]" },
      ]);
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      await requireDataPermission("STORE", () => null)(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("getDataPermissionFilter", () => {
    it("hasAllPermission时不设置filter", () => {
      const req = mockReq({ dataPermission: { hasAllPermission: true, permissions: [] } });
      const res = mockRes();
      const next = vi.fn();
      getDataPermissionFilter("STORE", "storeId")(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.dataPermissionFilter).toBeUndefined();
    });

    it("无权限上下文时不设置filter", () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      getDataPermissionFilter("STORE", "storeId")(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.dataPermissionFilter).toBeUndefined();
    });

    it("应设置数据权限filter", () => {
      const req = mockReq({
        dataPermission: {
          hasAllPermission: false,
          permissions: [{ permissionType: "STORE", scopeValues: [1, 2, 3] }],
        },
      });
      const res = mockRes();
      const next = vi.fn();
      getDataPermissionFilter("STORE", "storeId")(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.dataPermissionFilter).toEqual({ storeId: [1, 2, 3] });
    });

    it("空scopeValues时不设置filter", () => {
      const req = mockReq({
        dataPermission: {
          hasAllPermission: false,
          permissions: [{ permissionType: "STORE", scopeValues: [] }],
        },
      });
      const res = mockRes();
      const next = vi.fn();
      getDataPermissionFilter("STORE", "storeId")(req as any, res as any, next);
      expect(next).toHaveBeenCalled();
      expect(req.dataPermissionFilter).toBeUndefined();
    });
  });

  describe("getUserDataPermissionContext", () => {
    it("应返回权限上下文", async () => {
      (service.getUserDataPermissions as any).mockResolvedValue([
        { permission_type: "STORE", scopeValues: "[1,2]" },
      ]);
      const ctx = await getUserDataPermissionContext(1, "t1");
      expect(ctx.hasAllPermission).toBe(false);
      expect(ctx.permissions).toHaveLength(1);
      expect(ctx.permissions[0].permissionType).toBe("STORE");
      expect(ctx.permissions[0].scopeValues).toEqual([1, 2]);
    });

    it("应识别ALL权限", async () => {
      (service.getUserDataPermissions as any).mockResolvedValue([
        { permission_type: "ALL", scopeValues: null },
      ]);
      const ctx = await getUserDataPermissionContext(1, "t1");
      expect(ctx.hasAllPermission).toBe(true);
    });
  });
});
