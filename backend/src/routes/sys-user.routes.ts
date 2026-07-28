import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";

import { listSysUsers, createSysUser, getSysUser, updateSysUser, resetSysUserPassword, deleteSysUser } from "../controllers/admin/sys-user.controller";

export const sysUserRouter = Router();

sysUserRouter.get("/", asyncHandler(listSysUsers));
sysUserRouter.post("/", asyncHandler(createSysUser));
sysUserRouter.get("/:id", asyncHandler(getSysUser));
sysUserRouter.put("/:id", asyncHandler(updateSysUser));
sysUserRouter.post("/:id/reset-password", asyncHandler(resetSysUserPassword));
sysUserRouter.delete("/:id", asyncHandler(deleteSysUser));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/sys-users",
  router: sysUserRouter,
  auth: "requireAuthWithTenant",
};
