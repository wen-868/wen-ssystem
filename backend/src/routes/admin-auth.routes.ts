import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuthWithTenant } from "../middleware/auth";
import {
  login,
  getMe,
  getSettings,
  updateSettings,
  changePassword,
} from "../controllers/admin/auth.controller";

export const adminAuthRouter = Router();

// 登录接口不需要鉴权
adminAuthRouter.post("/login", asyncHandler(login));

// 以下接口需要鉴权
adminAuthRouter.get("/me", requireAuthWithTenant, asyncHandler(getMe));
adminAuthRouter.get("/settings", requireAuthWithTenant, asyncHandler(getSettings));
adminAuthRouter.put("/settings", requireAuthWithTenant, asyncHandler(updateSettings));
adminAuthRouter.post("/change-password", requireAuthWithTenant, asyncHandler(changePassword));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/auth",
  router: adminAuthRouter,
  auth: "none",
};
