import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as approvalFlowController from "../controllers/admin/approval-flow.controller.js";
import * as approvalRecordsController from "../controllers/admin/approval-records.controller.js";

export const approvalRouter = Router();

approvalRouter.use(requireAuthWithTenant);

approvalRouter.get("/rules", approvalFlowController.listRules);
approvalRouter.post("/rules", approvalFlowController.createRule);
approvalRouter.put("/rules/:id", approvalFlowController.updateRule);

approvalRouter.get("/instances", approvalRecordsController.listInstances);
approvalRouter.post("/instances/submit", approvalRecordsController.submitApproval);
approvalRouter.get("/instances/:instanceNo", approvalRecordsController.getInstanceDetail);

approvalRouter.get("/tasks", approvalRecordsController.listTasks);
approvalRouter.post("/tasks/:id/approve", approvalRecordsController.approveTask);
approvalRouter.post("/tasks/:id/reject", approvalRecordsController.rejectTask);

approvalRouter.get("/notifications", approvalRecordsController.listNotifications);
approvalRouter.post("/notifications/:id/read", approvalRecordsController.markNotificationRead);
