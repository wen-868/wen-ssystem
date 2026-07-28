import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/user-session.controller";

export const userSessionRouter = Router();

userSessionRouter.get("/", asyncHandler(controller.getUserSessions));
userSessionRouter.delete("/:id", asyncHandler(controller.revokeSession));
userSessionRouter.delete("/user/:userId", asyncHandler(controller.revokeUserSessions));
userSessionRouter.get("/stats", asyncHandler(controller.getOnlineStats));

export const routeConfig: RouteConfig = {
  prefix: "/api/user-session",
  router: userSessionRouter,
  auth: "requireAuthWithTenant",
};
