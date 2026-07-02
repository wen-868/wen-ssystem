import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as marketingAssetService from "../services/admin/marketing-asset.service.js";

export const marketingAssetRouter = Router();

marketingAssetRouter.get("/", requireAuthWithTenant, async (req, res) => {
  try { const data = await marketingAssetService.getMarketingAssets((req as any).tenantId, req.query); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
marketingAssetRouter.post("/", requireAuthWithTenant, async (req, res) => {
  try { const data = await marketingAssetService.createMarketingAsset(req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
marketingAssetRouter.put("/:id", requireAuthWithTenant, async (req, res) => {
  try { const data = await marketingAssetService.updateMarketingAsset(Number(req.params.id), req.body); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});
marketingAssetRouter.delete("/:id", requireAuthWithTenant, async (req, res) => {
  try { const data = await marketingAssetService.deleteMarketingAsset(Number(req.params.id)); res.json({ code: "0", data }); } catch (e: any) { res.status(500).json({ code: "1", message: e.message }); }
});