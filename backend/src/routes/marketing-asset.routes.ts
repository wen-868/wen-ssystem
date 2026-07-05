import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok, fail } from "../shared/response.js";
import * as marketingAssetService from "../services/admin/marketing-asset.service.js";

export const marketingAssetRouter = Router();

marketingAssetRouter.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await marketingAssetService.getMarketingAssets((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
marketingAssetRouter.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await marketingAssetService.createMarketingAsset(req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
marketingAssetRouter.put("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await marketingAssetService.updateMarketingAsset(Number(req.params.id), req.body); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
marketingAssetRouter.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await marketingAssetService.deleteMarketingAsset(Number(req.params.id)); res.json(ok(data)); } catch (e: any) { res.status(500).json(fail(e.message, "1")); }
});
