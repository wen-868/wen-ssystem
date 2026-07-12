import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/group-buy.controller";

export const groupBuyRouter = Router();

// 拼团活动
groupBuyRouter.get("/activities", requireAuthWithTenant, asyncHandler(controller.getGroupBuyActivities));
groupBuyRouter.post("/activities", requireAuthWithTenant, asyncHandler(controller.createGroupBuyActivity));
groupBuyRouter.put("/activities/:id", requireAuthWithTenant, asyncHandler(controller.updateGroupBuyActivity));
groupBuyRouter.delete("/activities/:id", requireAuthWithTenant, asyncHandler(controller.deleteGroupBuyActivity));
// 拼团记录
groupBuyRouter.get("/records", requireAuthWithTenant, asyncHandler(controller.getGroupBuyRecords));
groupBuyRouter.get("/records/:groupNo", requireAuthWithTenant, asyncHandler(controller.getGroupBuyRecordDetail));
groupBuyRouter.put("/records/:groupNo/cancel", requireAuthWithTenant, asyncHandler(controller.cancelGroupBuyRecord));
