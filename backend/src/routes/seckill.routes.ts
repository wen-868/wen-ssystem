import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import * as seckillService from "../services/admin/seckill.service.js";

export const seckillRouter = Router();

seckillRouter.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await seckillService.getSeckillProducts((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
seckillRouter.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await seckillService.createSeckillProduct(req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
seckillRouter.put("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await seckillService.updateSeckillProduct(Number(req.params.id), req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
seckillRouter.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await seckillService.deleteSeckillProduct(Number(req.params.id)); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
