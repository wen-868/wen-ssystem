import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import { requirePlatformAuth } from "../middleware/auth";
import { platformLogin, getPlatformMe, createPlatformAdmin } from "../controllers/platform/platform-auth.controller";

export const platformAuthRouter = Router();

platformAuthRouter.post("/login", asyncHandler(platformLogin));
platformAuthRouter.get("/me", requirePlatformAuth, asyncHandler(getPlatformMe));
platformAuthRouter.post("/admin/create", requirePlatformAuth, asyncHandler(createPlatformAdmin));

export const routeConfig: RouteConfig = {
  prefix: "/api/platform/auth",
  router: platformAuthRouter,
  auth: "none",
};
