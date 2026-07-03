import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as groupBuyService from "../services/admin/group-buy.service.js";

export const groupBuyRouter = Router();

// 拼团活动
groupBuyRouter.get("/activities", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.getGroupBuyActivities((req as any).tenantId, req.query); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
groupBuyRouter.post("/activities", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.createGroupBuyActivity(req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
groupBuyRouter.put("/activities/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.updateGroupBuyActivity(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
groupBuyRouter.delete("/activities/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.deleteGroupBuyActivity(Number(req.params.id)); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});

// 拼团记录
groupBuyRouter.get("/records", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.getGroupBuyRecords((req as any).tenantId, req.query); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
groupBuyRouter.get("/records/:groupNo", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.getGroupBuyDetail(req.params.groupNo); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
groupBuyRouter.put("/records/:groupNo/cancel", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await groupBuyService.cancelGroupBuy(req.params.groupNo); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
