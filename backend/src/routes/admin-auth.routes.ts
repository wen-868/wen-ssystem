import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import {
  getMe,
  getSettings,
  updateSettings,
  changePassword,
} from "../controllers/admin/auth.controller";

export const adminAuthRouter = Router();

// 登录接口由 server.ts 手动注册（带限流），此处不再注册 /login
// 以下接口需要鉴权（由 auto-routes 统一添加 requireAuthWithTenant + csrfMiddleware）
adminAuthRouter.get("/me", asyncHandler(getMe));
adminAuthRouter.get("/settings", asyncHandler(getSettings));
adminAuthRouter.put("/settings", asyncHandler(updateSettings));
adminAuthRouter.post("/change-password", asyncHandler(changePassword));

export const routeConfig: RouteConfig = {
  prefix: "/api/admin/auth",
  router: adminAuthRouter,
  auth: "requireAuthWithTenant",
};
