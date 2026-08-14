import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/purchase-return.controller";

export const purchaseReturnRouter = Router();
purchaseReturnRouter.get("/", ctrl.list);
purchaseReturnRouter.get("/:returnNo", ctrl.getDetail);
purchaseReturnRouter.post("/", ctrl.create);
purchaseReturnRouter.post("/:returnNo/approve", ctrl.approve);
purchaseReturnRouter.post("/:returnNo/void", ctrl.voidReturn);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-returns",
  router: purchaseReturnRouter,
  auth: "requireAuthWithTenant",
};
