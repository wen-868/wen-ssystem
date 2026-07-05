import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import * as pointsMallService from "../services/admin/points-mall.service.js";

export const pointsMallRouter = Router();

// 积分商城商品
pointsMallRouter.get("/items", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await pointsMallService.getPointsMallItems((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
pointsMallRouter.post("/items", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await pointsMallService.createPointsMallItem(req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
pointsMallRouter.put("/items/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await pointsMallService.updatePointsMallItem(Number(req.params.id), req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
pointsMallRouter.delete("/items/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await pointsMallService.deletePointsMallItem(Number(req.params.id)); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
pointsMallRouter.put("/items/:id/status", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await pointsMallService.updatePointsMallItem(Number(req.params.id), req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});

// 积分兑换订单
pointsMallRouter.get("/orders", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await pointsMallService.getPointsMallOrders((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
pointsMallRouter.put("/orders/:id/deliver", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await pointsMallService.deliverPointsMallOrder(Number(req.params.id), req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
pointsMallRouter.put("/orders/:id/cancel", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await pointsMallService.cancelPointsMallOrder(Number(req.params.id)); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
