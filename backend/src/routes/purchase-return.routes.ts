import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/purchase-return.controller.js";

export const purchaseReturnRouter = Router();
purchaseReturnRouter.get("/", requireAuthWithTenant, ctrl.list);
purchaseReturnRouter.get("/:returnNo", requireAuthWithTenant, ctrl.getDetail);
purchaseReturnRouter.post("/", requireAuthWithTenant, ctrl.create);
purchaseReturnRouter.post("/:returnNo/approve", requireAuthWithTenant, ctrl.approve);
purchaseReturnRouter.post("/:returnNo/void", requireAuthWithTenant, ctrl.voidReturn);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-returns",
  router: purchaseReturnRouter,
  auth: "requireAuthWithTenant",
};
