import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as pointsMallController from "../controllers/admin/marketing-points-mall.controller";

export const marketingPointsMallRouter = Router();

// ==================== 积分商城 (Admin) ====================
marketingPointsMallRouter.post("/products", pointsMallController.createPointsProduct);
marketingPointsMallRouter.get("/products", pointsMallController.listPointsProducts);
marketingPointsMallRouter.get("/products/:id", pointsMallController.getPointsProductDetail);
marketingPointsMallRouter.put("/products/:id", pointsMallController.updatePointsProduct);
marketingPointsMallRouter.delete("/products/:id", pointsMallController.deletePointsProduct);
marketingPointsMallRouter.post("/products/:id/toggle", pointsMallController.togglePointsProduct);
marketingPointsMallRouter.get("/exchange-records", pointsMallController.listExchangeRecords);
marketingPointsMallRouter.get("/exchange-records/:id", pointsMallController.getExchangeRecordDetail);
marketingPointsMallRouter.post("/exchange", pointsMallController.exchangeProduct);
marketingPointsMallRouter.post("/exchange-records/:id/cancel", pointsMallController.cancelExchange);
marketingPointsMallRouter.post("/exchange-records/:id/confirm", pointsMallController.confirmExchange);
marketingPointsMallRouter.get("/stats", pointsMallController.getPointsMallStats);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/marketing/points-mall",
  router: marketingPointsMallRouter,
  auth: "requireAuthWithTenant",
};
