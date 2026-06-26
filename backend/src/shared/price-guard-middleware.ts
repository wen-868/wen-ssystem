/**
 * 越权拦截中间件
 * 用于 Express 路由的越权访问拦截
 */
import { Request, Response, NextFunction } from "express";
import type { AuthUser } from "./auth.js";
import { canAccessPriceField, canAccessPriceLevel, logUnauthorizedAccess, filterPriceFields, filterPriceFieldsBatch } from "./price-guard.js";

/** 扩展 Express Request 类型 */
interface AuthRequest extends Request {
  user?: AuthUser;
  tenantId?: string;
}

/**
 * 价格字段访问拦截中间件
 * @param fieldNames 需要检查的字段名列表
 */
export function requirePriceFieldAccess(...fieldNames: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "未登录" });
    }

    const user = req.user;
    const blocked = fieldNames.filter(field => !canAccessPriceField(user, field));

    if (blocked.length > 0) {
      // 记录越权访问
      logUnauthorizedAccess(
        user,
        "PRICE_FIELD_ACCESS_DENIED",
        `用户尝试访问敏感价格字段: ${blocked.join(", ")}`,
        req.originalUrl,
        req.tenantId || "unknown"
      );

      return res.status(403).json({
        error: "越权访问",
        message: `无权访问以下价格字段: ${blocked.join(", ")}`,
        code: "PRICE_FIELD_ACCESS_DENIED"
      });
    }

    next();
  };
}

/**
 * 价格等级访问拦截中间件
 * 检查用户是否有权访问请求的价格等级
 * @param codeParam 请求参数中价格等级编码的字段名（默认 levelCode）
 */
export function requirePriceLevelAccess(codeParam: string = "levelCode") {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "未登录" });
    }

    const user = req.user;
    const levelCode = (req.query as any)[codeParam] || (req.body as any)?.[codeParam];

    if (levelCode) {
      const allowed = await canAccessPriceLevel(user, levelCode as string, req.tenantId || "unknown");
      if (!allowed) {
        await logUnauthorizedAccess(
          user,
          "PRICE_LEVEL_ACCESS_DENIED",
          `用户尝试访问价格等级: ${levelCode}`,
          req.originalUrl,
          req.tenantId || "unknown"
        );

        return res.status(403).json({
          error: "越权访问",
          message: `无权访问价格等级: ${levelCode}`,
          code: "PRICE_LEVEL_ACCESS_DENIED"
        });
      }
    }

    next();
  };
}

/**
 * 价格管理操作权限中间件
 * 检查用户是否有权执行价格管理操作（创建/编辑/删除价格）
 */
export function requirePriceManagementAccess() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "未登录" });
    }

    const allowedRoles = ["SUPER_ADMIN", "STORE_MANAGER"];
    const user = req.user;
    const hasAccess = allowedRoles.some(role => user.roles.includes(role));

    if (!hasAccess) {
      logUnauthorizedAccess(
        user,
        "PRICE_MANAGEMENT_DENIED",
        "用户尝试执行价格管理操作",
        req.originalUrl,
        req.tenantId || "unknown"
      );

      return res.status(403).json({
        error: "越权访问",
        message: "仅管理员和门店店长可执行价格管理操作",
        code: "PRICE_MANAGEMENT_DENIED"
      });
    }

    next();
  };
}

/**
 * 价格变更日志查看权限中间件
 */
export function requirePriceChangeLogAccess() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "未登录" });
    }

    const allowedRoles = ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_STAFF"];
    const user = req.user;
    const hasAccess = allowedRoles.some(role => user.roles.includes(role));

    if (!hasAccess) {
      return res.status(403).json({
        error: "越权访问",
        message: "仅管理员、店长和财务可查看价格变更日志",
        code: "PRICE_CHANGE_LOG_DENIED"
      });
    }

    next();
  };
}

/**
 * 响应价格字段过滤中间件
 * 拦截 res.json() 调用，自动过滤响应中的敏感价格字段
 * 使用方式：放在路由中间件链的最后，自动过滤所有响应
 */
export function priceResponseFilter() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.roles.includes("SUPER_ADMIN")) {
      return next();
    }

    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      if (!body || typeof body !== "object") {
        return originalJson(body);
      }

      const user = req.user!;

      try {
        // 过滤 data 字段
        if (body.data) {
          if (Array.isArray(body.data)) {
            const result = filterPriceFieldsBatch(user, body.data);
            body.data = result.filtered;
          } else if (typeof body.data === "object") {
            const result = filterPriceFields(user, body.data);
            body.data = result.filtered;
          }
        }

        // 过滤 records 字段（列表响应）
        if (body.records && Array.isArray(body.records)) {
          const result = filterPriceFieldsBatch(user, body.records);
          body.records = result.filtered;
        }
      } catch {
        // 过滤失败时原样返回，不阻断响应
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * 过滤单个对象中的敏感价格字段
 * 用于 Service 层手动调用
 */
export function filterPriceResponse(user: AuthUser, data: any): any {
  if (user.roles.includes("SUPER_ADMIN")) return data;

  if (Array.isArray(data)) {
    return filterPriceFieldsBatch(user, data).filtered;
  }
  if (data && typeof data === "object") {
    return filterPriceFields(user, data).filtered;
  }
  return data;
}