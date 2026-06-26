import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as menuPermissionController from "../controllers/admin/menu-permission.controller.js";

export const menuPermissionRouter = Router();

// 菜单树查询
menuPermissionRouter.get("/menu-tree", requireAuthWithTenant, menuPermissionController.getMenuTree);
menuPermissionRouter.get("/user-menus", requireAuthWithTenant, menuPermissionController.getUserMenus);

// 角色权限管理
menuPermissionRouter.get("/roles/:roleId/permissions", requireAuthWithTenant, menuPermissionController.getRolePermissions);
menuPermissionRouter.put("/roles/:roleId/menu-permissions", requireAuthWithTenant, menuPermissionController.setRoleMenuPermissions);
menuPermissionRouter.get("/roles/:roleId/data-permissions", requireAuthWithTenant, menuPermissionController.getDataPermissions);
menuPermissionRouter.put("/roles/:roleId/data-permissions", requireAuthWithTenant, menuPermissionController.setRoleDataPermissions);
menuPermissionRouter.get("/roles/:roleId/field-permissions", requireAuthWithTenant, menuPermissionController.getFieldPermissions);
menuPermissionRouter.put("/roles/:roleId/field-permissions", requireAuthWithTenant, menuPermissionController.setRoleFieldPermissions);