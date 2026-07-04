import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as customerVisitController from "../controllers/admin/customer-visit.controller.js";

export const customerVisitRouter = Router();

// 拜访列表
customerVisitRouter.get("/", requireAuthWithTenant, customerVisitController.listVisits);

// 拜访详情
customerVisitRouter.get("/:visitNo", requireAuthWithTenant, customerVisitController.getVisitDetail);

// 创建拜访
customerVisitRouter.post("/", requireAuthWithTenant, customerVisitController.createVisit);

// 更新拜访
customerVisitRouter.put("/:visitNo", requireAuthWithTenant, customerVisitController.updateVisit);

// 签到
customerVisitRouter.post("/:visitNo/checkin", requireAuthWithTenant, customerVisitController.checkin);

// 签退
customerVisitRouter.post("/:visitNo/checkout", requireAuthWithTenant, customerVisitController.checkout);

// 取消拜访
customerVisitRouter.post("/:visitNo/cancel", requireAuthWithTenant, customerVisitController.cancelVisit);

// 待跟进列表
customerVisitRouter.get("/follow-up/pending", requireAuthWithTenant, customerVisitController.listPendingFollowUps);

// 拜访统计
customerVisitRouter.get("/statistics", requireAuthWithTenant, customerVisitController.getVisitStatistics);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/customer-visits",
  router: customerVisitRouter,
  auth: "requireAuthWithTenant",
};
