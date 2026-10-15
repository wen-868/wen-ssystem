import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { requirePermission } from "../middleware/rbac-auth";

import * as supplierStatementController from "../controllers/admin/supplier-statement.controller";

export const supplierStatementRouter = Router();

supplierStatementRouter.post("/generate", requirePermission("report:finance"), supplierStatementController.generateSupplierStatement);
supplierStatementRouter.get("/", supplierStatementController.listSupplierStatements);
supplierStatementRouter.get("/:statementNo", supplierStatementController.getSupplierStatementDetail);
supplierStatementRouter.post("/:statementNo/confirm", requirePermission("report:finance"), supplierStatementController.confirmSupplierStatement);
supplierStatementRouter.post("/:statementNo/dispute", requirePermission("report:finance"), supplierStatementController.disputeSupplierStatement);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/supplier-statements",
  router: supplierStatementRouter,
  auth: "requireAuthWithTenant",
};
