import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { priceResponseFilter } from "../middleware/price-guard.js";
import * as ctrl from "../controllers/miniapp.controller.js";

export const miniappRouter = Router();
miniappRouter.use(priceResponseFilter());
miniappRouter.post("/login", ctrl.devLogin);
miniappRouter.post("/auth/login", ctrl.devAuthLogin);
miniappRouter.get("/profile", requireAuthWithTenant, ctrl.getProfile);
miniappRouter.get("/products", requireAuthWithTenant, ctrl.getProducts);
miniappRouter.post("/orders", requireAuthWithTenant, ctrl.createOrder);
miniappRouter.get("/orders", requireAuthWithTenant, ctrl.getOrders);
miniappRouter.get("/orders/:orderNo", requireAuthWithTenant, ctrl.getOrderDetail);
miniappRouter.post("/orders/:orderNo/confirm-receipt", requireAuthWithTenant, ctrl.confirmReceipt);
miniappRouter.get("/statements", requireAuthWithTenant, ctrl.getStatements);
miniappRouter.get("/statements/:id", requireAuthWithTenant, ctrl.getStatementDetail);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp",
  router: miniappRouter,
  auth: "none",
};
