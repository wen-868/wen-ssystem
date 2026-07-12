import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/user-session.controller";

export const userSessionRouter = Router();

userSessionRouter.get("/", requireAuthWithTenant, asyncHandler(controller.getUserSessions));
userSessionRouter.delete("/:id", requireAuthWithTenant, asyncHandler(controller.revokeSession));
userSessionRouter.delete("/user/:userId", requireAuthWithTenant, asyncHandler(controller.revokeUserSessions));
userSessionRouter.get("/stats", requireAuthWithTenant, asyncHandler(controller.getOnlineStats));
