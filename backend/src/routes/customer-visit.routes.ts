import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as visitPlanController from "../controllers/admin/visit-plan.controller.js";
import * as visitRecordController from "../controllers/admin/visit-record.controller.js";

export const customerVisitRouter = Router();

customerVisitRouter.get("/", requireAuthWithTenant, visitRecordController.listVisitRecords);
customerVisitRouter.get("/statistics", requireAuthWithTenant, visitRecordController.getVisitStatistics);
customerVisitRouter.get("/follow-up/pending", requireAuthWithTenant, visitRecordController.listPendingFollowUps);
customerVisitRouter.get("/:visitNo", requireAuthWithTenant, visitRecordController.getVisitRecordDetail);
customerVisitRouter.post("/", requireAuthWithTenant, visitPlanController.createVisitPlan);
customerVisitRouter.put("/:visitNo", requireAuthWithTenant, visitPlanController.updateVisitPlan);
customerVisitRouter.post("/:visitNo/checkin", requireAuthWithTenant, visitRecordController.checkin);
customerVisitRouter.post("/:visitNo/checkout", requireAuthWithTenant, visitRecordController.checkout);
customerVisitRouter.post("/:visitNo/cancel", requireAuthWithTenant, visitPlanController.cancelVisitPlan);
