import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/sync.controller";

const router = Router();

// ==================== 价格同步 ====================
router.get("/check", asyncHandler(controller.getPriceChanges));
router.get("/prices", asyncHandler(controller.getPricesByIds));
router.post("/price", asyncHandler(controller.syncPrices));
router.get("/price/status", asyncHandler(controller.getPriceSyncStatus));
router.get("/price/last", asyncHandler(controller.getPriceLastSync));

// ==================== 商品同步 ====================
router.post("/product", asyncHandler(controller.syncProducts));
router.get("/product/status", asyncHandler(controller.getProductSyncStatus));
router.get("/product/last", asyncHandler(controller.getProductLastSync));

// ==================== R51-04 增量同步（App 离线能力） ====================
// 增量商品变更（含 SKU/SPU/价格/库存联合查询）
router.get("/products/delta", asyncHandler(controller.getProductsDelta));
// 增量库存变更
router.get("/inventory/delta", asyncHandler(controller.getInventoryDelta));
// 增量客户变更
router.get("/members/delta", asyncHandler(controller.getMembersDelta));
// 批量提交离线销售单（错误隔离 + 事务原子性）
router.post("/offline-orders", asyncHandler(controller.submitOfflineOrders));

export default router;

export const routeConfig: RouteConfig = {
  prefix: "/api/sync",
  router,
  auth: "requireAuthWithTenant",
};
