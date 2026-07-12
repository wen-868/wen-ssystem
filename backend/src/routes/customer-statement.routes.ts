import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as ctrl from "../controllers/customer-statement.controller";

export const customerStatementRouter = Router();

customerStatementRouter.get("/", requireAuthWithTenant, ctrl.list);
customerStatementRouter.get("/:statementNo", requireAuthWithTenant, ctrl.getDetail);
customerStatementRouter.post("/", requireAuthWithTenant, ctrl.create);
customerStatementRouter.post("/:statementNo/confirm", requireAuthWithTenant, ctrl.confirm);
customerStatementRouter.post("/:statementNo/paid", requireAuthWithTenant, ctrl.markPaid);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/customer-statements",
  router: customerStatementRouter,
  auth: "requireAuthWithTenant",
};
