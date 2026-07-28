import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/group-buy.controller";

export const groupBuyRouter = Router();

// 拼团活动
groupBuyRouter.get("/activities", asyncHandler(controller.getGroupBuyActivities));
groupBuyRouter.post("/activities", asyncHandler(controller.createGroupBuyActivity));
groupBuyRouter.put("/activities/:id", asyncHandler(controller.updateGroupBuyActivity));
groupBuyRouter.delete("/activities/:id", asyncHandler(controller.deleteGroupBuyActivity));
// 拼团记录
groupBuyRouter.get("/records", asyncHandler(controller.getGroupBuyRecords));
groupBuyRouter.get("/records/:groupNo", asyncHandler(controller.getGroupBuyRecordDetail));
groupBuyRouter.put("/records/:groupNo/cancel", asyncHandler(controller.cancelGroupBuyRecord));

export const routeConfig: RouteConfig = {
  prefix: "/api/group-buy",
  router: groupBuyRouter,
  auth: "requireAuthWithTenant",
};
