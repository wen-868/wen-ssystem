import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/platform/platform-role.controller";

/**
 * C6-2-T6：平台角色与权限点目录路由（7 条端点，路径由派单卡钉死，不得自拟/增减）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T6.md 交付物②
 * 三段前缀（同一条路径字面要求的自然拆分，全部挂 requirePlatformAuth，与既有平台路由同风格）：
 *   · /api/platform/admins/roles          —— 角色列表（前端 AdminPermissions.vue:189 字面期望）
 *   · /api/platform/permissions/catalog   —— 权限点目录（前端 :202）
 *   · /api/platform/roles[...]            —— 角色增删改 + 权限矩阵读写（前端 :277/#49 后续接线）
 * 注册顺序：/:id/permissions 的 GET/PUT 写在 /:id 之后不影响匹配（方法不同），但为可读性仍按
 * 具体→通配排列；本文件不写任何业务逻辑（分层规则：route 只注册）。
 */

/** /api/platform/admins/roles —— 平台角色列表 */
export const platformAdminsRouter = Router();
platformAdminsRouter.get("/roles", asyncHandler(controller.listRoles));

/** /api/platform/permissions/catalog —— 权限点目录 */
export const platformPermissionsRouter = Router();
platformPermissionsRouter.get("/catalog", asyncHandler(controller.getPermissionCatalog));

/** /api/platform/roles —— 角色增删改 + 权限矩阵读写 */
export const platformRolesRouter = Router();
platformRolesRouter.post("/", asyncHandler(controller.createRole));
platformRolesRouter.get("/:id/permissions", asyncHandler(controller.getRolePermissions));
platformRolesRouter.put("/:id/permissions", asyncHandler(controller.replaceRolePermissions));
platformRolesRouter.put("/:id", asyncHandler(controller.updateRole));
platformRolesRouter.delete("/:id", asyncHandler(controller.deleteRole));

export const routeConfigs: RouteConfig[] = [
  {
    prefix: "/api/platform/admins",
    router: platformAdminsRouter,
    auth: "requirePlatformAuth",
  },
  {
    prefix: "/api/platform/permissions",
    router: platformPermissionsRouter,
    auth: "requirePlatformAuth",
  },
  {
    prefix: "/api/platform/roles",
    router: platformRolesRouter,
    auth: "requirePlatformAuth",
  },
];
