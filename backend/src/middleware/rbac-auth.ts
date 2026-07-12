import type { RequestHandler } from "express";
import { requireAuthWithTenant, type AuthUser } from "./auth";
import { checkUserPermission as checkUserPermissionService } from "../services/admin/rbac.service";
import { fail } from "../shared/response";

export function requirePermission(permCode: string): RequestHandler {
  return (req: any, res: any, next: any) => {
    const user = req.user as AuthUser | undefined;
    const tenantId = (req as { tenantId?: number }).tenantId as any as number | undefined;
    if (!user) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    if (user.roles.includes("SUPER_ADMIN")) {
      next();
      return;
    }
    checkUserPermissionService(user.id, tenantId || 0, permCode).then((hasPermission) => {
      if (hasPermission) {
        next();
      } else {
        res.status(403).json(fail(`无权限执行此操作，需要权限: ${permCode}`, "403"));
      }
    }).catch(() => {
      res.status(500).json(fail("权限检查失败", "500"));
    });
  };
}

export async function checkUserPermission(userId: number, tenantId: number, permCode: string): Promise<boolean> {
  return checkUserPermissionService(userId, tenantId, permCode);
}
