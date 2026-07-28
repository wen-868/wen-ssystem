import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as receivableController from "../controllers/admin/receivable.controller";

export const receivableRouter = Router();
receivableRouter.get("/", receivableController.listReceivables);
receivableRouter.get("/aging", receivableController.getReceivablesAging);
receivableRouter.get("/:id/detail", receivableController.getReceivableDetail);
receivableRouter.get("/payables", receivableController.listPayables);
receivableRouter.get("/payables/aging", receivableController.getPayablesAging);
receivableRouter.get("/payables/:id/detail", receivableController.getPayableDetail);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/receivables",
  router: receivableRouter,
  auth: "requireAuthWithTenant",
};
