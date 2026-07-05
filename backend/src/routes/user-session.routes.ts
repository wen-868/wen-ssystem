import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import * as userSessionService from "../services/admin/user-session.service.js";

export const userSessionRouter = Router();

userSessionRouter.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await userSessionService.getUserSessions((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
userSessionRouter.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await userSessionService.revokeSession(Number(req.params.id)); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
userSessionRouter.delete("/user/:userId", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const sessions = await userSessionService.getUserSessions((req as { tenantId?: number }).tenantId as any, { userId });
    for (const s of (sessions as { records?: unknown[] }).records || []) {
      await userSessionService.revokeSession((s as any).id);
    }
    res.json(ok({ success: true }));
  } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
userSessionRouter.get("/stats", requireAuthWithTenant, async (_req: Request, res: Response) => {
  try { const data = await userSessionService.getOnlineStats(); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
