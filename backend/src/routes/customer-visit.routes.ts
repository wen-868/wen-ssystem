import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：落地码 `customer:visit`（079:148 既有「客户拜访」码，台账 §三.2 建议码）；
// 页面 `customer-visits`（router/index.ts:156，roles = SUPER_ADMIN + STORE_MANAGER）持有 `*` / `customer:*` ⇒ 零回归；
// 签入/签退/取消三条全仓无调用方（`api/misc.ts` 有导出、无页面引用）。
import { requirePermission } from "../middleware/rbac-auth";

import * as customerVisitController from "../controllers/admin/customer-visit.controller";

export const customerVisitRouter = Router();

// 拜访列表
customerVisitRouter.get("/", customerVisitController.listVisits);

// 拜访详情
customerVisitRouter.get("/:visitNo", customerVisitController.getVisitDetail);

// 创建拜访
customerVisitRouter.post("/", requirePermission("customer:visit"), customerVisitController.createVisit);

// 更新拜访
customerVisitRouter.put("/:visitNo", requirePermission("customer:visit"), customerVisitController.updateVisit);

// 签到
customerVisitRouter.post("/:visitNo/checkin", requirePermission("customer:visit"), customerVisitController.checkin);

// 签退
customerVisitRouter.post("/:visitNo/checkout", requirePermission("customer:visit"), customerVisitController.checkout);

// 取消拜访
customerVisitRouter.post("/:visitNo/cancel", requirePermission("customer:visit"), customerVisitController.cancelVisit);

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
