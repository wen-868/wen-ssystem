import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as marketingAssetService from "../services/admin/marketing-asset.service.js";

export const marketingAssetRouter = Router();

marketingAssetRouter.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await marketingAssetService.getMarketingAssets((req as { tenantId?: number }).tenantId, req.query); res.json({ code: "0", data }); } catch (e: unknown) { res.status(500).json({ code: "1", message: e.message }); }
});
marketingAssetRouter.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await marketingAssetService.createMarketingAsset(req.body); res.json({ code: "0", data }); } catch (e: unknown) { res.status(500).json({ code: "1", message: e.message }); }
});
marketingAssetRouter.put("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await marketingAssetService.updateMarketingAsset(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: unknown) { res.status(500).json({ code: "1", message: e.message }); }
});
marketingAssetRouter.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try { const data = await marketingAssetService.deleteMarketingAsset(Number(req.params.id)); res.json({ code: "0", data }); } catch (e: unknown) { res.status(500).json({ code: "1", message: e.message }); }
});
