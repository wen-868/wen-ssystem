import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/marketing-asset.controller";

export const marketingAssetRouter = Router();

marketingAssetRouter.get("/", asyncHandler(controller.getMarketingAssets));
marketingAssetRouter.post("/", asyncHandler(controller.createMarketingAsset));
marketingAssetRouter.put("/:id", asyncHandler(controller.updateMarketingAsset));
marketingAssetRouter.delete("/:id", asyncHandler(controller.deleteMarketingAsset));

export const routeConfig: RouteConfig = {
  prefix: "/api/marketing-asset",
  router: marketingAssetRouter,
  auth: "requireAuthWithTenant",
};
