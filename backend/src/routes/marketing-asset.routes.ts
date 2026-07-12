import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/marketing-asset.controller";

export const marketingAssetRouter = Router();

marketingAssetRouter.get("/", requireAuthWithTenant, asyncHandler(controller.getMarketingAssets));
marketingAssetRouter.post("/", requireAuthWithTenant, asyncHandler(controller.createMarketingAsset));
marketingAssetRouter.put("/:id", requireAuthWithTenant, asyncHandler(controller.updateMarketingAsset));
marketingAssetRouter.delete("/:id", requireAuthWithTenant, asyncHandler(controller.deleteMarketingAsset));
