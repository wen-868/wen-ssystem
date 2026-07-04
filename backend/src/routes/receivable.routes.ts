import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as receivableController from "../controllers/admin/receivable.controller.js";

export const receivableRouter = Router();
receivableRouter.get("/", requireAuthWithTenant, receivableController.listReceivables);
receivableRouter.get("/aging", requireAuthWithTenant, receivableController.getReceivablesAging);
receivableRouter.get("/:id/detail", requireAuthWithTenant, receivableController.getReceivableDetail);
receivableRouter.get("/payables", requireAuthWithTenant, receivableController.listPayables);
receivableRouter.get("/payables/aging", requireAuthWithTenant, receivableController.getPayablesAging);
receivableRouter.get("/payables/:id/detail", requireAuthWithTenant, receivableController.getPayableDetail);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/receivables",
  router: receivableRouter,
  auth: "requireAuthWithTenant",
};
