import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as supplierStatementController from "../controllers/admin/supplier-statement.controller.js";

export const supplierStatementRouter = Router();

supplierStatementRouter.post("/generate", requireAuthWithTenant, supplierStatementController.generateSupplierStatement);
supplierStatementRouter.get("/", requireAuthWithTenant, supplierStatementController.listSupplierStatements);
supplierStatementRouter.get("/:statementNo", requireAuthWithTenant, supplierStatementController.getSupplierStatementDetail);
supplierStatementRouter.post("/:statementNo/confirm", requireAuthWithTenant, supplierStatementController.confirmSupplierStatement);
supplierStatementRouter.post("/:statementNo/dispute", requireAuthWithTenant, supplierStatementController.disputeSupplierStatement);