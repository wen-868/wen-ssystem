import { describe, it, expect, vi } from "vitest";

// mock env 和 db 依赖
vi.mock("../../shared/env", () => ({
  env: {
    JWT_SECRET: "test-secret-key-for-vitest",
    USE_MOCK_DB: "true",
  },
}));

vi.mock("../../shared/db", () => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

import {
  getUserAccessInfo,
  hasAnyRole,
  canAccessStore,
  requireRoles,
  requireAuth,
  requirePlatformAuth,
  signToken,
  signPlatformToken,
  PLATFORM_JWT_ISSUER,
  PLATFORM_JWT_AUDIENCE,
  MERCHANT_JWT_ISSUER,
  MERCHANT_JWT_AUDIENCE,
  type AuthUser,
} from "../../shared/auth";
import jwt from "jsonwebtoken";
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

  describe("requirePlatformAuth", () => {
    // 使用源码中导出的 signPlatformToken，确保 issuer/audience 与生产环境一致
    // 避免测试 helper 自行签发 token 时遗漏 issuer/audience 校验
    function makePlatformToken(payload: Record<string, unknown>) {
      return signPlatformToken(payload);
    }

    it("无 token 应返回 401", () => {
      const req = { headers: {} } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requirePlatformAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("有效 platform_admin token 应调用 next", () => {
      const token = makePlatformToken({ type: "platform_admin", id: 1, tenantId: 1 });
      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as unknown as Request;
      const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requirePlatformAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
    });

    it("token 类型不是 platform_admin 应返回 403", () => {
      const token = makePlatformToken({ type: "normal_user", id: 1 });
      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requirePlatformAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
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

      requirePlatformAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("Bearer 前缀大小写不敏感", () => {
      const token = makePlatformToken({ type: "platform_admin", id: 1 });
      const req = {
        headers: { authorization: `bearer ${token}` },
      } as unknown as Request;
      const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requirePlatformAuth(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    // ===== R48-06 新增：跨域 JWT 隔离测试 =====

    it("商家 JWT 无法通过平台认证（issuer 不匹配）", () => {
      // signToken 用 MERCHANT_JWT_ISSUER 签发，requirePlatformAuth 会拒绝
      const merchantToken = signToken(makeUser(["SUPER_ADMIN"]));
      const req = {
        headers: { authorization: `Bearer ${merchantToken}` },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requirePlatformAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("平台 JWT 无法通过商家认证（issuer 不匹配）", () => {
      const platformToken = makePlatformToken({ type: "platform_admin", id: 1 });
      const req = {
        headers: { authorization: `Bearer ${platformToken}` },
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

    it("伪造 type=platform_admin 的商家 JWT 无法通过平台认证", () => {
      // 即使攻击者手动给商家 JWT 加上 type=platform_admin，
      // 由于 issuer 是 zhixiang-system，requirePlatformAuth 校验 issuer 会拒绝
      const forgedToken = jwt.sign(
        { ...makeUser(["SUPER_ADMIN"]), type: "platform_admin" },
        "test-secret-key-for-vitest",
        {
          algorithm: "HS256",
          issuer: MERCHANT_JWT_ISSUER,
          audience: MERCHANT_JWT_AUDIENCE,
        }
      );
      const req = {
        headers: { authorization: `Bearer ${forgedToken}` },
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      requirePlatformAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("平台 JWT 常量值正确", () => {
      // 防止常量被意外修改导致认证体系失效
      expect(PLATFORM_JWT_ISSUER).toBe("zhixiang-platform");
      expect(PLATFORM_JWT_AUDIENCE).toBe("zhixiang-platform-client");
      expect(MERCHANT_JWT_ISSUER).toBe("zhixiang-system");
      expect(MERCHANT_JWT_AUDIENCE).toBe("zhixiang-client");
      expect(PLATFORM_JWT_ISSUER).not.toBe(MERCHANT_JWT_ISSUER);
      expect(PLATFORM_JWT_AUDIENCE).not.toBe(MERCHANT_JWT_AUDIENCE);
    });
  });
});
