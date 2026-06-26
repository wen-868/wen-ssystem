import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/stock-check.controller.js";

// ==================== Admin 盘点路由 ====================
export const adminStockCheckRouter = Router();

adminStockCheckRouter.use(requireAuthWithTenant);

adminStockCheckRouter.post("/", ctrl.create);
adminStockCheckRouter.get("/statistics", ctrl.getStatistics);
adminStockCheckRouter.get("/", ctrl.list);
adminStockCheckRouter.get("/:id", ctrl.getDetail);
adminStockCheckRouter.put("/:id", ctrl.update);
adminStockCheckRouter.post("/:id/start", ctrl.start);
adminStockCheckRouter.post("/:id/complete", ctrl.complete);
adminStockCheckRouter.post("/:id/cancel", ctrl.cancel);
adminStockCheckRouter.post("/:id/handle-diff", ctrl.handleDiff);

// ==================== Store 盘点路由 ====================
export const storeStockCheckRouter = Router();

storeStockCheckRouter.get("/my", ctrl.getMyList);
storeStockCheckRouter.get("/:id", ctrl.getDetail);
storeStockCheckRouter.put("/:id/items/:itemId", ctrl.updateItem);
storeStockCheckRouter.post("/:id/submit", ctrl.submit);