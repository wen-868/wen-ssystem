import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";

import * as ctrl from "../controllers/purchase-return.controller";

export const purchaseReturnRouter = Router();
purchaseReturnRouter.get("/", ctrl.list);
purchaseReturnRouter.get("/:returnNo", ctrl.getDetail);
// ⚠️ S3-214-B2 **本行不接线**：移动端「销售开单」采购页签无权限门 ⇒ 同 purchase.routes.ts 说明。
purchaseReturnRouter.post("/", ctrl.create);
purchaseReturnRouter.post("/:returnNo/approve", requirePermission("sale:return"), ctrl.approve);
purchaseReturnRouter.post("/:returnNo/void", requirePermission("sale:return"), ctrl.voidReturn);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-returns",
  router: purchaseReturnRouter,
  auth: "requireAuthWithTenant",
};
