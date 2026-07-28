import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/customer-statement.controller";

export const customerStatementRouter = Router();

customerStatementRouter.get("/", ctrl.list);
customerStatementRouter.get("/:statementNo", ctrl.getDetail);
customerStatementRouter.post("/", ctrl.create);
customerStatementRouter.post("/:statementNo/confirm", ctrl.confirm);
customerStatementRouter.post("/:statementNo/paid", ctrl.markPaid);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/store/customer-statements",
  router: customerStatementRouter,
  auth: "requireAuthWithTenant",
};
