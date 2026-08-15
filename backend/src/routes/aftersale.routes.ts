import { Router } from "express";
import { requireAuthWithTenant } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import * as ctrl from "../controllers/admin/aftersale.controller";
import {
  createAftersaleSchema,
  returnLogisticsSchema,
  rateAftersaleSchema,
  rejectAftersaleSchema,
  inspectAftersaleSchema,
  completeAftersaleSchema,
} from "../schemas/aftersale";
import type { RouteConfig } from "../shared/auto-routes";

export const miniappAftersaleRouter = Router();
export const adminAftersaleRouter = Router();

miniappAftersaleRouter.post("/aftersales", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  req.body = createAftersaleSchema.parse(req.body);
  await ctrl.miniappCreateAftersale(req, res, _next);
}));

miniappAftersaleRouter.get("/aftersales/mine", requireAuthWithTenant, ctrl.miniappListMyAftersales);
miniappAftersaleRouter.get("/aftersales/:aftersaleNo", requireAuthWithTenant, ctrl.miniappGetAftersaleDetail);
miniappAftersaleRouter.post("/aftersales/:aftersaleNo/cancel", requireAuthWithTenant, ctrl.miniappCancelAftersale);

miniappAftersaleRouter.post("/aftersales/:aftersaleNo/return-logistics", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  req.body = returnLogisticsSchema.parse(req.body);
  await ctrl.miniappSubmitReturnLogistics(req, res, _next);
}));

miniappAftersaleRouter.post("/aftersales/:aftersaleNo/rate", requireAuthWithTenant, asyncHandler(async (req, res, _next) => {
  req.body = rateAftersaleSchema.parse(req.body);
  await ctrl.miniappRateAftersale(req, res, _next);
}));

adminAftersaleRouter.get("/aftersales", ctrl.adminListAftersales);
adminAftersaleRouter.get("/aftersales/statistics", ctrl.adminGetStatistics);
adminAftersaleRouter.get("/aftersales/:id", ctrl.adminGetAftersaleDetail);
adminAftersaleRouter.post("/aftersales/:id/approve", ctrl.adminApproveAftersale);

adminAftersaleRouter.post("/aftersales/:id/reject", asyncHandler(async (req, res, _next) => {
  req.body = rejectAftersaleSchema.parse(req.body);
  await ctrl.adminRejectAftersale(req, res, _next);
}));

adminAftersaleRouter.post("/aftersales/:id/confirm-receipt", ctrl.adminConfirmReceipt);

adminAftersaleRouter.post("/aftersales/:id/inspect", asyncHandler(async (req, res, _next) => {
  req.body = inspectAftersaleSchema.parse(req.body);
  await ctrl.adminInspectAftersale(req, res, _next);
}));

adminAftersaleRouter.post("/aftersales/:id/complete", asyncHandler(async (req, res, _next) => {
  req.body = completeAftersaleSchema.parse(req.body);
  await ctrl.adminCompleteAftersale(req, res, _next);
}));

export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/miniapp", router: miniappAftersaleRouter, auth: "none" },
  { prefix: "/api/admin", router: adminAftersaleRouter, auth: "requireAuthWithTenant" },
];
