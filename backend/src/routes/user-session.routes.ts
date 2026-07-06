import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import * as userSessionService from "../services/admin/user-session.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const userSessionRouter = Router();

userSessionRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await userSessionService.getUserSessions((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data));
}));
userSessionRouter.delete("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await userSessionService.revokeSession(Number(req.params.id)); res.json(ok(data));
}));
userSessionRouter.delete("/user/:userId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const sessions = await userSessionService.getUserSessions((req as { tenantId?: number }).tenantId as any, { userId });
  for (const s of (sessions as { records?: unknown[] }).records || []) {
    await userSessionService.revokeSession((s as any).id);
  }
  res.json(ok({ success: true }));
}));
userSessionRouter.get("/stats", requireAuthWithTenant, asyncHandler(async (_req, res) => {
  const data = await userSessionService.getOnlineStats(); res.json(ok(data));
}));