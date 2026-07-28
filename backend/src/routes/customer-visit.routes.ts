import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as customerVisitController from "../controllers/admin/customer-visit.controller";

export const customerVisitRouter = Router();

// 拜访列表
customerVisitRouter.get("/", customerVisitController.listVisits);

// 拜访详情
customerVisitRouter.get("/:visitNo", customerVisitController.getVisitDetail);

// 创建拜访
customerVisitRouter.post("/", customerVisitController.createVisit);

// 更新拜访
customerVisitRouter.put("/:visitNo", customerVisitController.updateVisit);

// 签到
customerVisitRouter.post("/:visitNo/checkin", customerVisitController.checkin);

// 签退
customerVisitRouter.post("/:visitNo/checkout", customerVisitController.checkout);

// 取消拜访
customerVisitRouter.post("/:visitNo/cancel", customerVisitController.cancelVisit);

// 待跟进列表
customerVisitRouter.get("/follow-up/pending", customerVisitController.listPendingFollowUps);

// 拜访统计
customerVisitRouter.get("/statistics", customerVisitController.getVisitStatistics);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/customer-visits",
  router: customerVisitRouter,
  auth: "requireAuthWithTenant",
};
