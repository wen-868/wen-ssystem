import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as seckillService from "../services/admin/seckill.service.js";

export const seckillRouter = Router();

seckillRouter.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await seckillService.getSeckillProducts((req as any).tenantId, req.query); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
seckillRouter.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await seckillService.createSeckillProduct(req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
seckillRouter.put("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await seckillService.updateSeckillProduct(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
seckillRouter.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await seckillService.deleteSeckillProduct(Number(req.params.id)); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
