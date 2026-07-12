import { Router } from "express";
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

export default router;
