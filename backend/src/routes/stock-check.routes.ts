import { Router } from "express";
import * as ctrl from "../controllers/admin/stock-check.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ==================== Admin 盘点路由 ====================
export const adminStockCheckRouter = Router();

adminStockCheckRouter.post("/", ctrl.create);
adminStockCheckRouter.get("/statistics", ctrl.getStatistics);
adminStockCheckRouter.get("/", ctrl.list);
adminStockCheckRouter.get("/:id", ctrl.getDetail);
adminStockCheckRouter.put("/:id", ctrl.update);
adminStockCheckRouter.post("/:id/start", ctrl.start);
adminStockCheckRouter.post("/:id/complete", ctrl.complete);
adminStockCheckRouter.post("/:id/cancel", ctrl.cancel);
adminStockCheckRouter.post("/:id/handle-diff", ctrl.handleDiff);
adminStockCheckRouter.post("/:id/items", ctrl.recordItems);

// ==================== Store �̵�·�� ====================
export const storeStockCheckRouter = Router();

storeStockCheckRouter.get("/my", ctrl.getMyList);
storeStockCheckRouter.get("/:id", ctrl.getDetail);
storeStockCheckRouter.put("/:id/items/:itemId", ctrl.updateItem);
storeStockCheckRouter.post("/:id/submit", ctrl.submit);

// ========== ·���Զ��������� ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/stock-checks", router: adminStockCheckRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/stock-checks", router: storeStockCheckRouter, auth: "requireAuthWithTenant" },
];