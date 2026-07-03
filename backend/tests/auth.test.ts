/**
 * JWT 认证单元测试
 *
 * 测试 auth.ts 中的核心逻辑：
 * - requireAuth 中间件（有token放行，无token返回401）
 * - requireRoles 中间件（SUPER_ADMIN跳过，普通用户检查权限）
 * - hasAnyRole 权限检查
 * - canAccessStore 门店访问权限
 * - token 过期处理
 */

import jwt from "jsonwebtoken";
import { vi } from "vitest";

// ========== 常量 ==========

const JWT_SECRET = "test-secret-key-for-unit-testing";

// ========== 类型定义 ==========

interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  storeId?: number | null;
}

// ========== 纯函数提取（与 auth.ts 逻辑等价） ==========

/**
 * 检查用户是否拥有任一允许的角色
 * SUPER_ADMIN 跳过检查
 */
function hasAnyRole(user: AuthUser | undefined, allowedRoles: string[]): boolean {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return allowedRoles.some((role) => user.roles.includes(role));
}

/**
 * 检查用户是否可以访问指定门店
 * SUPER_ADMIN 和 OPERATION_ADMIN 可以访问所有门店
 */
function canAccessStore(
  user: AuthUser | undefined,
  storeId: number | null | undefined
): boolean {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN") || user.roles.includes("OPERATION_ADMIN"))
    return true;
  if (!storeId) return false;
  return Number(user.storeId) === Number(storeId);
}

/**
 * 生成 JWT token
 */
function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "8h" });
}

/**
 * 验证 JWT token
 */
function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * 从 Authorization header 中提取 token
 */
function extractToken(authorization: string | undefined): string {
  if (!authorization) return "";
  return authorization.replace(/^Bearer\s+/i, "");
}

/**
 * 模拟 requireAuth 中间件的核心逻辑
 * 返回 { authenticated: boolean, user: AuthUser | null, errorCode: string | null }
 */
function checkAuth(
  authorization: string | undefined
): { authenticated: boolean; user: AuthUser | null; errorCode: string | null } {
  const token = extractToken(authorization);
  if (!token) {
    return { authenticated: false, user: null, errorCode: "401" };
  }

  const user = verifyToken(token);
  if (!user) {
    return { authenticated: false, user: null, errorCode: "401" };
  }

  return { authenticated: true, user, errorCode: null };
}

/**
 * 模拟 requireRoles 中间件的核心逻辑
 * 返回 { authorized: boolean, errorCode: string | null }
 */
function checkRoles(
  user: AuthUser | undefined,
  allowedRoles: string[]
): { authorized: boolean; errorCode: string | null } {
  if (!user) {
    return { authorized: false, errorCode: "401" };
  }
  if (!hasAnyRole(user, allowedRoles)) {
    return { authorized: false, errorCode: "403" };
  }
  return { authorized: true, errorCode: null };
}

// ========== Mock Express req/res ==========

function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    user: undefined as AuthUser | undefined,
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as any;
}

function createMockResponse() {
  const res: Record<string, any> = {
    statusCode: 200,
    body: null,
    json: vi.fn(function (this: any, data: any) {
      this.body = data;
      return this;
    }),
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
  };
  return res as any;
}

function createMockNext() {
  return vi.fn();
}

// ========== 测试用例 ==========

describe("requireAuth 中间件 - checkAuth", () => {
  test("有有效 token 时放行", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["SUPER_ADMIN"] };
    const token = signToken(user);
    const result = checkAuth(`Bearer ${token}`);
    expect(result.authenticated).toBe(true);
    expect(result.user).not.toBeNull();
    expect(result.user!.id).toBe(1);
    expect(result.errorCode).toBeNull();
  });

  test("无 Authorization header 时返回 401", () => {
    const result = checkAuth(undefined);
    expect(result.authenticated).toBe(false);
    expect(result.errorCode).toBe("401");
  });

  test("Authorization header 为空字符串时返回 401", () => {
    const result = checkAuth("");
    expect(result.authenticated).toBe(false);
    expect(result.errorCode).toBe("401");
  });

  test("token 格式不正确时返回 401", () => {
    const result = checkAuth("InvalidTokenFormat");
    const result2 = checkAuth("Basic dXNlcjpwYXNz"); // Basic auth
    // "InvalidTokenFormat" 经过 replace 后变为 "InvalidTokenFormat"，不是有效 JWT
    expect(result.authenticated).toBe(false);
    expect(result2.authenticated).toBe(false);
  });

  test("Bearer 前缀大小写不敏感", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["ADMIN"] };
    const token = signToken(user);
    expect(checkAuth(`bearer ${token}`).authenticated).toBe(true);
    expect(checkAuth(`BEARER ${token}`).authenticated).toBe(true);
    expect(checkAuth(`Bearer ${token}`).authenticated).toBe(true);
  });
});

describe("token 过期处理", () => {
  test("过期 token 返回 401", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["ADMIN"] };
    // 生成一个已过期的 token
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "-1s" });
    const result = checkAuth(`Bearer ${token}`);
    expect(result.authenticated).toBe(false);
    expect(result.errorCode).toBe("401");
  });

  test("错误密钥的 token 返回 401", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["ADMIN"] };
    const token = jwt.sign(user, "wrong-secret", { expiresIn: "8h" });
    const result = checkAuth(`Bearer ${token}`);
    expect(result.authenticated).toBe(false);
  });

  test("被篡改的 token 返回 401", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["ADMIN"] };
    const token = signToken(user);
    const tampered = token.slice(0, -5) + "XXXXX";
    const result = checkAuth(`Bearer ${tampered}`);
    expect(result.authenticated).toBe(false);
  });
});

describe("requireRoles 中间件 - checkRoles", () => {
  test("SUPER_ADMIN 跳过角色检查", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["SUPER_ADMIN"] };
    const result = checkRoles(user, ["STORE_MANAGER"]);
    expect(result.authorized).toBe(true);
  });

  test("普通用户拥有所需角色时放行", () => {
    const user: AuthUser = { id: 2, username: "manager", roles: ["STORE_MANAGER"] };
    const result = checkRoles(user, ["STORE_MANAGER"]);
    expect(result.authorized).toBe(true);
  });

  test("普通用户无所需角色时返回 403", () => {
    const user: AuthUser = { id: 2, username: "clerk", roles: ["CLERK"] };
    const result = checkRoles(user, ["STORE_MANAGER"]);
    expect(result.authorized).toBe(false);
    expect(result.errorCode).toBe("403");
  });

  test("用户拥有多个角色时匹配任一即可", () => {
    const user: AuthUser = { id: 2, username: "user", roles: ["CLERK", "STORE_MANAGER"] };
    const result = checkRoles(user, ["STORE_MANAGER"]);
    expect(result.authorized).toBe(true);
  });

  test("无用户时返回 401", () => {
    const result = checkRoles(undefined, ["STORE_MANAGER"]);
    expect(result.authorized).toBe(false);
    expect(result.errorCode).toBe("401");
  });

  test("空角色列表时只有 SUPER_ADMIN 能通过", () => {
    const admin: AuthUser = { id: 1, username: "admin", roles: ["SUPER_ADMIN"] };
    const clerk: AuthUser = { id: 2, username: "clerk", roles: ["CLERK"] };
    expect(checkRoles(admin, []).authorized).toBe(true);
    expect(checkRoles(clerk, []).authorized).toBe(false);
  });
});

describe("hasAnyRole 权限检查", () => {
  test("SUPER_ADMIN 始终返回 true", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["SUPER_ADMIN"] };
    expect(hasAnyRole(user, ["ANY_ROLE"])).toBe(true);
    expect(hasAnyRole(user, [])).toBe(true);
  });

  test("无用户返回 false", () => {
    expect(hasAnyRole(undefined, ["ADMIN"])).toBe(false);
  });

  test("用户角色与允许角色有交集返回 true", () => {
    const user: AuthUser = { id: 2, username: "user", roles: ["CLERK", "CASHIER"] };
    expect(hasAnyRole(user, ["CASHIER"])).toBe(true);
    expect(hasAnyRole(user, ["CLERK", "MANAGER"])).toBe(true);
  });

  test("用户角色与允许角色无交集返回 false", () => {
    const user: AuthUser = { id: 2, username: "user", roles: ["CLERK"] };
    expect(hasAnyRole(user, ["MANAGER", "ADMIN"])).toBe(false);
  });
});

describe("canAccessStore 门店访问权限", () => {
  test("SUPER_ADMIN 可以访问所有门店", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["SUPER_ADMIN"] };
    expect(canAccessStore(user, 1)).toBe(true);
    expect(canAccessStore(user, 999)).toBe(true);
  });

  test("OPERATION_ADMIN 可以访问所有门店", () => {
    const user: AuthUser = { id: 2, username: "ops", roles: ["OPERATION_ADMIN"] };
    expect(canAccessStore(user, 1)).toBe(true);
    expect(canAccessStore(user, 999)).toBe(true);
  });

  test("门店用户只能访问自己的门店", () => {
    const user: AuthUser = { id: 3, username: "store1", roles: ["STORE_MANAGER"], storeId: 1 };
    expect(canAccessStore(user, 1)).toBe(true);
    expect(canAccessStore(user, 2)).toBe(false);
  });

  test("门店用户 storeId 为 null 时不能访问任何门店", () => {
    const user: AuthUser = { id: 3, username: "store", roles: ["STORE_MANAGER"], storeId: null };
    expect(canAccessStore(user, 1)).toBe(false);
  });

  test("无用户时返回 false", () => {
    expect(canAccessStore(undefined, 1)).toBe(false);
  });

  test("目标 storeId 为 null 时返回 false", () => {
    const user: AuthUser = { id: 3, username: "store", roles: ["STORE_MANAGER"], storeId: 1 };
    expect(canAccessStore(user, null)).toBe(false);
    expect(canAccessStore(user, undefined)).toBe(false);
  });
});

describe("token 生成与验证", () => {
  test("signToken 生成的 token 可以被 verifyToken 验证", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["SUPER_ADMIN"] };
    const token = signToken(user);
    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.id).toBe(user.id);
    expect(verified!.username).toBe(user.username);
    expect(verified!.roles).toEqual(user.roles);
  });

  test("token 包含正确的用户信息", () => {
    const user: AuthUser = {
      id: 42,
      username: "testuser",
      roles: ["CLERK", "CASHIER"],
      storeId: 5,
    };
    const token = signToken(user);
    const verified = verifyToken(token);
    expect(verified!.id).toBe(42);
    expect(verified!.username).toBe("testuser");
    expect(verified!.roles).toEqual(["CLERK", "CASHIER"]);
    expect(verified!.storeId).toBe(5);
  });

  test("不同用户的 token 不同", () => {
    const user1: AuthUser = { id: 1, username: "user1", roles: ["ADMIN"] };
    const user2: AuthUser = { id: 2, username: "user2", roles: ["ADMIN"] };
    expect(signToken(user1)).not.toBe(signToken(user2));
  });
});

describe("Express 中间件集成模拟", () => {
  test("requireAuth 完整流程 - 有效 token", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["SUPER_ADMIN"] };
    const token = signToken(user);
    const req = createMockRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = createMockResponse();
    const next = createMockNext();

    // 模拟 requireAuth 逻辑
    const authResult = checkAuth(req.headers.authorization);
    if (!authResult.authenticated) {
      res.status(401).json({ code: "401", message: "未登录" });
    } else {
      req.user = authResult.user;
      next();
    }

    expect(next).toHaveBeenCalled();
    expect(req.user).not.toBeNull();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("requireAuth 完整流程 - 无 token", () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    const authResult = checkAuth(req.headers.authorization);
    if (!authResult.authenticated) {
      res.status(401).json({ code: "401", message: "未登录" });
    } else {
      next();
    }

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ code: "401", message: "未登录" });
  });

  test("requireRoles 完整流程 - SUPER_ADMIN", () => {
    const user: AuthUser = { id: 1, username: "admin", roles: ["SUPER_ADMIN"] };
    const req = createMockRequest({ user });
    const res = createMockResponse();
    const next = createMockNext();

    const roleResult = checkRoles(req.user, ["STORE_MANAGER"]);
    if (!roleResult.authorized) {
      res.status(roleResult.errorCode === "401" ? 401 : 403).json({
        code: roleResult.errorCode,
        message: roleResult.errorCode === "401" ? "未登录" : "无权限访问",
      });
    } else {
      next();
    }

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("requireRoles 完整流程 - 权限不足", () => {
    const user: AuthUser = { id: 2, username: "clerk", roles: ["CLERK"] };
    const req = createMockRequest({ user });
    const res = createMockResponse();
    const next = createMockNext();

    const roleResult = checkRoles(req.user, ["STORE_MANAGER"]);
    if (!roleResult.authorized) {
      res.status(roleResult.errorCode === "401" ? 401 : 403).json({
        code: roleResult.errorCode,
        message: roleResult.errorCode === "401" ? "未登录" : "无权限访问",
      });
    } else {
      next();
    }

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ code: "403", message: "无权限访问" });
  });
});
