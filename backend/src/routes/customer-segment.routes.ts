import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as segmentController from "../controllers/admin/customer-segment.controller.js";

export const customerSegmentRouter = Router();
customerSegmentRouter.get("/", requireAuthWithTenant, segmentController.listSegments);
customerSegmentRouter.post("/", requireAuthWithTenant, segmentController.createSegment);
customerSegmentRouter.put("/:id", requireAuthWithTenant, segmentController.updateSegment);
customerSegmentRouter.delete("/:id", requireAuthWithTenant, segmentController.deleteSegment);
customerSegmentRouter.post("/:id/refresh", requireAuthWithTenant, segmentController.refreshSegmentMembers);
customerSegmentRouter.get("/:id/members", requireAuthWithTenant, segmentController.listSegmentMembers);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/segments",
  router: customerSegmentRouter,
  auth: "requireAuthWithTenant",
};
