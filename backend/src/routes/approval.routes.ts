import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../middleware/auth.js";
import * as approvalFlowController from "../controllers/admin/approval-flow.controller.js";
import * as approvalRecordsController from "../controllers/admin/approval-records.controller.js";

export const approvalRouter = Router();

approvalRouter.use(requireAuthWithTenant);

// 审批规则管理
approvalRouter.get("/rules", approvalFlowController.listRules);
approvalRouter.post("/rules", approvalFlowController.createRule);
approvalRouter.put("/rules/:id", approvalFlowController.updateRule);

// 审批实例
approvalRouter.get("/instances", approvalRecordsController.listInstances);
approvalRouter.post("/instances/submit", approvalRecordsController.submitApproval);
approvalRouter.get("/instances/:instanceNo", approvalRecordsController.getInstanceDetail);

// 审批任务
approvalRouter.get("/tasks", approvalRecordsController.listTasks);
approvalRouter.post("/tasks/:id/approve", approvalRecordsController.approveTask);
approvalRouter.post("/tasks/:id/reject", approvalRecordsController.rejectTask);

// 审批通知
approvalRouter.get("/notifications", approvalRecordsController.listNotifications);
approvalRouter.post("/notifications/:id/read", approvalRecordsController.markNotificationRead);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/approval",
  router: approvalRouter,
  auth: "requireAuthWithTenant",
};
