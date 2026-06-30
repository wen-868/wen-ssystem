import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as pointsMallController from "../controllers/admin/marketing-points-mall.controller.js";

export const marketingPointsMallRouter = Router();

// ==================== 积分商城 (Admin) ====================
marketingPointsMallRouter.post("/products", requireAuthWithTenant, pointsMallController.createPointsProduct);
marketingPointsMallRouter.get("/products", requireAuthWithTenant, pointsMallController.listPointsProducts);
marketingPointsMallRouter.get("/products/:id", requireAuthWithTenant, pointsMallController.getPointsProductDetail);
marketingPointsMallRouter.put("/products/:id", requireAuthWithTenant, pointsMallController.updatePointsProduct);
marketingPointsMallRouter.delete("/products/:id", requireAuthWithTenant, pointsMallController.deletePointsProduct);
marketingPointsMallRouter.post("/products/:id/toggle", requireAuthWithTenant, pointsMallController.togglePointsProduct);
marketingPointsMallRouter.get("/exchange-records", requireAuthWithTenant, pointsMallController.listExchangeRecords);
marketingPointsMallRouter.get("/exchange-records/:id", requireAuthWithTenant, pointsMallController.getExchangeRecordDetail);
marketingPointsMallRouter.post("/exchange", requireAuthWithTenant, pointsMallController.exchangeProduct);
marketingPointsMallRouter.post("/exchange-records/:id/cancel", requireAuthWithTenant, pointsMallController.cancelExchange);
marketingPointsMallRouter.post("/exchange-records/:id/confirm", requireAuthWithTenant, pointsMallController.confirmExchange);