import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as userSessionService from "../services/admin/user-session.service.js";

export const userSessionRouter = Router();

userSessionRouter.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await userSessionService.getUserSessions((req as { tenantId?: number }).tenantId, req.query); res.json({ code: "0", data }); } catch (e: unknown) { res.status(500).json({ code: "1", message: e.message }); }
});
userSessionRouter.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await userSessionService.revokeSession(Number(req.params.id)); res.json({ code: "0", data }); } catch (e: unknown) { res.status(500).json({ code: "1", message: e.message }); }
});
userSessionRouter.delete("/user/:userId", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const sessions = await userSessionService.getUserSessions((req as { tenantId?: number }).tenantId, { userId });
    for (const s of (sessions as { records?: unknown[] }).records || []) {
      await userSessionService.revokeSession(s.id);
    }
    res.json({ code: "0", data: { success: true } });
  } catch (e: unknown) { res.status(500).json({ code: "1", message: e.message }); }
});
userSessionRouter.get("/stats", requireAuthWithTenant, async (_req: Request, res: Response) => {
  try { const data = await userSessionService.getOnlineStats(); res.json({ code: "0", data }); } catch (e: unknown) { res.status(500).json({ code: "1", message: e.message }); }
});
