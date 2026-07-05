import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import type { RequestHandler } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/rbac.controller.js";
import { checkUserPermission as checkUserPermissionService } from "../services/admin/rbac.service.js";
import type { AuthUser } from "../shared/auth.js";

export const rbacRouter = Router();

// ========== 权限验证中间件 ==========

export function requirePermission(permCode: string): RequestHandler {
  return (req: any, res: any, next: any) => {
    const user = req.user as AuthUser | undefined;
    const tenantId = (req as { tenantId?: number }).tenantId as number | undefined;
    if (!user) {
      res.status(401).json({ code: "401", message: "未登录" });
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
        res.status(403).json({ code: "403", message: `无权限执行此操作，需要权限: ${permCode}` });
      }
    }).catch(() => {
      res.status(500).json({ code: "500", message: "权限检查失败" });
    });
  };
}

export async function checkUserPermission(userId: number, tenantId: number, permCode: string): Promise<boolean> {
  return checkUserPermissionService(userId, tenantId, permCode);
}

// ========== 角色管理 ==========

rbacRouter.get("/", requireAuthWithTenant, ctrl.listRoles);
rbacRouter.post("/", requireAuthWithTenant, ctrl.createRole);
rbacRouter.get("/:id", requireAuthWithTenant, ctrl.getRoleDetail);
rbacRouter.put("/:id", requireAuthWithTenant, ctrl.updateRole);
rbacRouter.delete("/:id", requireAuthWithTenant, ctrl.deleteRole);

// ========== 用户角色分配 ==========

rbacRouter.get("/users/:userId/roles", requireAuthWithTenant, ctrl.getUserRoles);
rbacRouter.put("/users/:userId/roles", requireAuthWithTenant, ctrl.setUserRoles);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/roles",
  router: rbacRouter,
  auth: "requireAuthWithTenant",
};
