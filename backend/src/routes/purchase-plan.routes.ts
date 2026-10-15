import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as purchasePlanController from "../controllers/admin/purchase-plan.controller";

export const purchasePlanRouter = Router();

purchasePlanRouter.get("/suggest", purchasePlanController.suggestPurchasePlan);
// ⚠️ S3-214-B2 **本文件 2 行不接线**（登记「待授权模型定案」，见缺口清单 §十一）：
//    采购计划页真实使用者含 STORE_MANAGER（admin-web/src/router/index.ts:131），而生产店长不持任何 `purchase:*`；
//    挂 purchase:create 会把店长打成 403，又找不到店长已持有的采购计划语义码 ⇒ 本批不动，待授权模型定案。
purchasePlanRouter.post("/", purchasePlanController.createPurchasePlan);
purchasePlanRouter.get("/", purchasePlanController.listPurchasePlans);
purchasePlanRouter.post("/:planNo/convert", purchasePlanController.convertPurchasePlan);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/purchase-plans",
  router: purchasePlanRouter,
  auth: "requireAuthWithTenant",
};
