import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/miniapp-order-sync.controller";

export const orderSyncLogRouter = Router();

// ========== 订单同步日志列表（分页+筛选） ==========
orderSyncLogRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listSyncLogs));

// ========== 重试同步 ==========
orderSyncLogRouter.post("/:orderNo/retry", requireAuthWithTenant, asyncHandler(controller.retrySync));
