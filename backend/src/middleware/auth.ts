import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../shared/env";
import { tenantMiddleware } from "./tenant";

import { fail } from "../shared/response";
export type AuthUser = {
  id: number;
  username: string;
  realName?: string;
  roles: string[];
  storeId?: number | null;
  tenantId: string;
};

export type AccessMode = "ADMIN" | "CASHIER";

export type UserAccessInfo = {
  accessModes: AccessMode[];
  defaultMode: AccessMode;
};

const ADMIN_ROLES = ["SUPER_ADMIN", "OPERATION_ADMIN", "WAREHOUSE_ADMIN", "FINANCE_ADMIN"];
const CASHIER_ROLES = ["STORE_MANAGER", "STORE_OPERATOR", "CASHIER", "SALES"];

export function getUserAccessInfo(user: AuthUser): UserAccessInfo {
  const hasAdminRole = user.roles.some(r => ADMIN_ROLES.includes(r));
  const hasCashierRole = user.roles.some(r => CASHIER_ROLES.includes(r));

  const accessModes: AccessMode[] = [];
  if (hasAdminRole) accessModes.push("ADMIN");
  if (hasCashierRole || hasAdminRole) accessModes.push("CASHIER");

  if (accessModes.length === 0) {
    accessModes.push("CASHIER");
  }

  const defaultMode: AccessMode = hasAdminRole ? "ADMIN" : "CASHIER";

  return { accessModes, defaultMode };
}

export function hasAnyRole(user: AuthUser | undefined, allowedRoles: string[]) {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return allowedRoles.some((role) => user.roles.includes(role));
}

export function canAccessStore(user: AuthUser | undefined, storeId: number | null | undefined) {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN") || user.roles.includes("OPERATION_ADMIN")) return true;
  if (!storeId) return false;
  return Number(user.storeId) === Number(storeId);
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// JWT issuer / audience 常量
// 商家与平台使用不同的 issuer，从根本上隔离两类 JWT，防止跨域冒充
export const MERCHANT_JWT_ISSUER = "zhixiang-system";
export const MERCHANT_JWT_AUDIENCE = "zhixiang-client";
export const PLATFORM_JWT_ISSUER = "zhixiang-platform";
export const PLATFORM_JWT_AUDIENCE = "zhixiang-platform-client";

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "4h",
    issuer: MERCHANT_JWT_ISSUER,
    audience: MERCHANT_JWT_AUDIENCE,
  });
}

/**
 * 签发平台管理员 JWT（独立 issuer/audience，与商家 JWT 严格隔离）
 */
export function signPlatformToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "8h",
    issuer: PLATFORM_JWT_ISSUER,
    audience: PLATFORM_JWT_AUDIENCE,
  });
}

export function requireRoles(allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    if (!hasAnyRole(req.user, allowedRoles)) {
      res.status(403).json(fail("无权限访问", "403"));
      return;
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }
  try {
    req.user = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "zhixiang-system",
      audience: "zhixiang-client",
    }) as AuthUser;
    next();
  } catch {
    res.status(401).json(fail("登录已失效", "401"));
  }
};

export const requireAuthWithTenant = [requireAuth, tenantMiddleware] as RequestHandler[];

// 平台总后台认证：验证 platform_admin JWT
// 同时校验 issuer/audience，确保只有平台签发的 JWT 才能通过
// 商家 JWT（issuer=zhixiang-system）即使伪造 type=platform_admin 也会被拒绝
export const requirePlatformAuth: RequestHandler = (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: PLATFORM_JWT_ISSUER,
      audience: PLATFORM_JWT_AUDIENCE,
    }) as { type?: string; id?: number; tenantId?: number };
    if (decoded.type !== "platform_admin") {
      res.status(403).json(fail("无权限", "403"));
      return;
    }
    req.user = decoded as any as AuthUser;
    next();
  } catch {
    res.status(401).json(fail("登录已失效", "401"));
  }
};