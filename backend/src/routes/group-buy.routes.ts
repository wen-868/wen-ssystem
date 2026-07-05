import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import * as groupBuyService from "../services/admin/group-buy.service.js";

export const groupBuyRouter = Router();

// 拼团活动
groupBuyRouter.get("/activities", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.getGroupBuyActivities((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
groupBuyRouter.post("/activities", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.createGroupBuyActivity(req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
groupBuyRouter.put("/activities/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.updateGroupBuyActivity(Number(req.params.id), req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
groupBuyRouter.delete("/activities/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.deleteGroupBuyActivity(Number(req.params.id)); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});

// 拼团记录
groupBuyRouter.get("/records", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.getGroupBuyRecords((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
groupBuyRouter.get("/records/:groupNo", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.getGroupBuyRecordDetail(req.params.groupNo); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
groupBuyRouter.put("/records/:groupNo/cancel", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.cancelGroupBuyRecord(req.params.groupNo); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
