import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuthWithTenant } from "../middleware/auth";
import { listSysUsers, createSysUser, getSysUser, updateSysUser, resetSysUserPassword, deleteSysUser } from "../controllers/admin/sys-user.controller";

export const sysUserRouter = Router();

sysUserRouter.get("/", requireAuthWithTenant, asyncHandler(listSysUsers));
sysUserRouter.post("/", requireAuthWithTenant, asyncHandler(createSysUser));
sysUserRouter.get("/:id", requireAuthWithTenant, asyncHandler(getSysUser));
sysUserRouter.put("/:id", requireAuthWithTenant, asyncHandler(updateSysUser));
sysUserRouter.post("/:id/reset-password", requireAuthWithTenant, asyncHandler(resetSysUserPassword));
sysUserRouter.delete("/:id", requireAuthWithTenant, asyncHandler(deleteSysUser));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/sys-users",
  router: sysUserRouter,
  auth: "requireAuthWithTenant",
};
