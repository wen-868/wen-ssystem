import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as segmentController from "../controllers/admin/customer-segment.controller";

export const customerSegmentRouter = Router();
customerSegmentRouter.get("/", segmentController.listSegments);
customerSegmentRouter.post("/", segmentController.createSegment);
customerSegmentRouter.put("/:id", segmentController.updateSegment);
customerSegmentRouter.delete("/:id", segmentController.deleteSegment);
customerSegmentRouter.post("/:id/refresh", segmentController.refreshSegmentMembers);
customerSegmentRouter.get("/:id/members", segmentController.listSegmentMembers);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/members/segments",
  router: customerSegmentRouter,
  auth: "requireAuthWithTenant",
};
