import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import type { RequestHandler } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as ctrl from "../controllers/rbac.controller.js";
import { checkUserPermission as checkUserPermissionService } from "../services/admin/rbac.service.js";
import type { AuthUser } from "../middleware/auth.js";

import { fail } from '../shared/response.js';
export const rbacRouter = Router();

// ========== 权限验证中间件 ==========

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
