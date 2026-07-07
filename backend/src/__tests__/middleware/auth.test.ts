import { describe, it, expect, vi, beforeEach } from "vitest";

// mock env 和 db 依赖
vi.mock("../../shared/env.js", () => ({
  env: {
    JWT_SECRET: "test-secret-key-for-vitest",
    USE_MOCK_DB: "true",
  },
}));

vi.mock("../../shared/db.js", () => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

import {
  getUserAccessInfo,
  hasAnyRole,
  canAccessStore,
  requireRoles,
  requireAuth,
  signToken,
  type AuthUser,
} from "../../shared/auth.js";
import type { Request, Response, NextFunction } from "express";

function makeUser(roles: string[], opts?: { id?: number; storeId?: number | null }): AuthUser {
  return {
    id: opts?.id ?? 1,
    username: "testuser",
    roles,
    storeId: opts?.storeId ?? null,
    tenantId: "default",
  };
}

describe("auth middleware", () => {
  describe("getUserAccessInfo", () => {
    it("SUPER_ADMIN 应有 ADMIN 和 CASHIER 两种模式", () => {
      const info = getUserAccessInfo(makeUser(["SUPER_ADMIN"]));
      expect(info.accessModes).toContain("ADMIN");
      expect(info.accessModes).toContain("CASHIER");
      expect(info.defaultMode).toBe("ADMIN");
    });

    it("STORE_MANAGER 默认 CASHIER 模式", () => {
      const info = getUserAccessInfo(makeUser(["STORE_MANAGER"]));
      expect(info.defaultMode).toBe("CASHIER");
      expect(info.accessModes).toContain("CASHIER");
    });

    it("无角色用户默认 CASHIER", () => {
      const info = getUserAccessInfo(makeUser([]));
      expect(info.accessModes).toEqual(["CASHIER"]);
      expect(info.defaultMode).toBe("CASHIER");
    });

    it("OPERATION_ADMIN 有 ADMIN 模式", () => {
      const info = getUserAccessInfo(makeUser(["OPERATION_ADMIN"]));
      expect(info.accessModes).toContain("ADMIN");
    });
  });

  describe("hasAnyRole", () => {
    it("user 为 undefined 返回 false", () => {
      expect(hasAnyRole(undefined, ["SUPER_ADMIN"])).toBe(false);
    });

    it("SUPER_ADMIN 总是返回 true", () => {
      expect(hasAnyRole(makeUser(["SUPER_ADMIN"]), ["STORE_MANAGER"])).toBe(true);
    });

    it("角色匹配返回 true", () => {
      expect(hasAnyRole(makeUser(["STORE_MANAGER"]), ["STORE_MANAGER"])).toBe(true);
    });

    it("角色不匹配返回 false", () => {
      expect(hasAnyRole(makeUser(["SALES_STAFF"]), ["STORE_MANAGER"])).toBe(false);
    });

    it("多角色中有一个匹配即返回 true", () => {
      expect(hasAnyRole(makeUser(["SALES_STAFF", "CASHIER"]), ["STORE_MANAGER", "CASHIER"])).toBe(true);
    });
  });

  describe("canAccessStore", () => {
    it("user 为 undefined 返回 false", () => {
      expect(canAccessStore(undefined, 1)).toBe(false);
    });

    it("SUPER_ADMIN 返回 true", () => {
      expect(canAccessStore(makeUser(["SUPER_ADMIN"]), 1)).toBe(true);
    });

    it("OPERATION_ADMIN 返回 true", () => {
      expect(canAccessStore(makeUser(["OPERATION_ADMIN"]), 1)).toBe(true);
    });

    it("storeManager 匹配 storeId 返回 true", () => {
      expect(canAccessStore(makeUser(["STORE_MANAGER"], { storeId: 5 }), 5)).toBe(true);
    });

    it("storeManager 不匹配 storeId 返回 false", () => {
      expect(canAccessStore(makeUser(["STORE_MANAGER"], { storeId: 5 }), 3)).toBe(false);
    });

    it("storeId 为 null 返回 false", () => {
      expect(canAccessStore(makeUser(["STORE_MANAGER"]), null)).toBe(false);
    });
  });

  describe("signToken", () => {
    it("应返回 JWT 字符串", () => {
      const token = signToken(makeUser(["SUPER_ADMIN"]));
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });
  });

  describe("requireRoles", () => {
    it("未登录应返回 401", () => {
      const req = { headers: {} } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      const middleware = requireRoles(["SUPER_ADMIN"]);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("有权限应调用 next", () => {
      const req = {
        headers: {},
        user: makeUser(["SUPER_ADMIN"]),
      } as unknown as Request;
      const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      const middleware = requireRoles(["SUPER_ADMIN"]);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("无权限应返回 403", () => {
      const req = {
        headers: {},
        user: makeUser(["SALES_STAFF"]),
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      const middleware = requireRoles(["SUPER_ADMIN", "STORE_MANAGER"]);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireAuth", () => {
    it("无 token 应返回 401", () => {
      const req = { headers: {} } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("有效 token 应调用 next", () => {
      const user = makeUser(["SUPER_ADMIN"]);
      const token = signToken(user);
      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as unknown as Request;
      const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
    });

    it("无效 token 应返回 401", () => {
      const req = {
        headers: { authorization: "Bearer invalid-token" },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
