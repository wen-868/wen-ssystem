import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：落地码 = 台账 §三.2 建议码；页面 `customer-segments`
//（router/index.ts:158，roles = SUPER_ADMIN）持有 `*` ⇒ 零回归。
import { requirePermission } from "../middleware/rbac-auth";

import * as segmentController from "../controllers/admin/customer-segment.controller";

export const customerSegmentRouter = Router();
customerSegmentRouter.get("/", segmentController.listSegments);
customerSegmentRouter.post("/", requirePermission("customer:create"), segmentController.createSegment);
customerSegmentRouter.put("/:id", requirePermission("customer:edit"), segmentController.updateSegment);
customerSegmentRouter.delete("/:id", requirePermission("customer:edit"), segmentController.deleteSegment);
customerSegmentRouter.post("/:id/refresh", requirePermission("customer:create"), segmentController.refreshSegmentMembers);
customerSegmentRouter.get("/:id/members", segmentController.listSegmentMembers);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/segments",
  router: customerSegmentRouter,
  auth: "requireAuthWithTenant",
};
