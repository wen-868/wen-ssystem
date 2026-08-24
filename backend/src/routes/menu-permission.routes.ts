import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/menu-permission.controller";

export const menuPermissionRouter = Router();

// GET /api/admin/menus/tree —— 全量菜单树
menuPermissionRouter.get("/tree", ctrl.getMenuTree);
// GET /api/admin/menus/user —— 当前用户可见菜单（按角色过滤；超管全量）
menuPermissionRouter.get("/user", ctrl.getUserMenus);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/menus",
  router: menuPermissionRouter,
  auth: "requireAuthWithTenant",
};
