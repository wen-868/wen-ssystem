import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";
import { tenantMiddleware, type TenantRequest } from "./tenant.js";

export type AuthUser = {
  id: number;
  username: string;
  realName?: string;
  roles: string[];
  storeId?: number | null;
  tenantId: string;
};

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

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "8h" });
}

export function requireRoles(allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ code: "401", message: "未登录" });
      return;
    }
    if (!hasAnyRole(req.user, allowedRoles)) {
      res.status(403).json({ code: "403", message: "无权限访问" });
      return;
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ code: "401", message: "未登录" });
    return;
  }
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    next();
  } catch {
    res.status(401).json({ code: "401", message: "登录已失效" });
  }
};

export const requireAuthWithTenant = [requireAuth, tenantMiddleware] as RequestHandler[];
