import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { ok } from "../shared/response.js";
import * as marketingAssetService from "../services/admin/marketing-asset.service.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const marketingAssetRouter = Router();

marketingAssetRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await marketingAssetService.getMarketingAssets((req as { tenantId?: number }).tenantId as any, req.query); res.json(ok(data));
}));
marketingAssetRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await marketingAssetService.createMarketingAsset(req.body); res.json(ok(data));
}));
marketingAssetRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await marketingAssetService.updateMarketingAsset(Number(req.params.id), req.body); res.json(ok(data));
}));
marketingAssetRouter.delete("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const data = await marketingAssetService.deleteMarketingAsset(Number(req.params.id)); res.json(ok(data));
}));