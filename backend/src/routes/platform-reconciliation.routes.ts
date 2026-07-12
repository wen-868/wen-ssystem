import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/platform-reconciliation.controller";

export const platformReconciliationRouter = Router();

// ========== 对账列表（分页+筛选） ==========
platformReconciliationRouter.get("/", requireAuthWithTenant, asyncHandler(controller.listReconciliations));

// ========== 创建对账 ==========
platformReconciliationRouter.post("/", requireAuthWithTenant, asyncHandler(controller.createReconciliation));

// ========== 更新对账 ==========
platformReconciliationRouter.put("/:id", requireAuthWithTenant, asyncHandler(controller.updateReconciliation));

// ========== 对账详情 ==========
platformReconciliationRouter.get("/:id", requireAuthWithTenant, asyncHandler(controller.getReconciliationDetail));
