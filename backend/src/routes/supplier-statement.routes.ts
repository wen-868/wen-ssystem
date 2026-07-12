import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as supplierStatementController from "../controllers/admin/supplier-statement.controller";

export const supplierStatementRouter = Router();

supplierStatementRouter.post("/generate", requireAuthWithTenant, supplierStatementController.generateSupplierStatement);
supplierStatementRouter.get("/", requireAuthWithTenant, supplierStatementController.listSupplierStatements);
supplierStatementRouter.get("/:statementNo", requireAuthWithTenant, supplierStatementController.getSupplierStatementDetail);
supplierStatementRouter.post("/:statementNo/confirm", requireAuthWithTenant, supplierStatementController.confirmSupplierStatement);
supplierStatementRouter.post("/:statementNo/dispute", requireAuthWithTenant, supplierStatementController.disputeSupplierStatement);
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/supplier-statements",
  router: supplierStatementRouter,
  auth: "requireAuthWithTenant",
};
