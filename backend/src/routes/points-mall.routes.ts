import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as pointsMallService from "../services/admin/points-mall.service.js";

export const pointsMallRouter = Router();

// 积分商城商品
pointsMallRouter.get("/items", requireAuthWithTenant, async (req, res) => {
  try { const data = await pointsMallService.getPointsMallItems((req as any).tenantId, req.query); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
pointsMallRouter.post("/items", requireAuthWithTenant, async (req, res) => {
  try { const data = await pointsMallService.createPointsMallItem(req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
pointsMallRouter.put("/items/:id", requireAuthWithTenant, async (req, res) => {
  try { const data = await pointsMallService.updatePointsMallItem(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
pointsMallRouter.delete("/items/:id", requireAuthWithTenant, async (req, res) => {
  try { const data = await pointsMallService.deletePointsMallItem(Number(req.params.id)); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
pointsMallRouter.put("/items/:id/status", requireAuthWithTenant, async (req, res) => {
  try { const data = await pointsMallService.updatePointsMallItem(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});

// 积分兑换订单
pointsMallRouter.get("/orders", requireAuthWithTenant, async (req, res) => {
  try { const data = await pointsMallService.getPointsMallOrders((req as any).tenantId, req.query); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
pointsMallRouter.put("/orders/:id/deliver", requireAuthWithTenant, async (req, res) => {
  try { const data = await pointsMallService.deliverPointsMallOrder(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
pointsMallRouter.put("/orders/:id/cancel", requireAuthWithTenant, async (req, res) => {
  try { const data = await pointsMallService.cancelPointsMallOrder(Number(req.params.id)); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});