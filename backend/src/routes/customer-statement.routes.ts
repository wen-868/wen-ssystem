import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as controller from "../controllers/admin/customer-statement.controller.js";

export const customerStatementRouter = Router();

customerStatementRouter.get("/", requireAuthWithTenant, controller.list);
customerStatementRouter.get("/:statementNo", requireAuthWithTenant, controller.getDetail);
customerStatementRouter.post("/", requireAuthWithTenant, controller.create);
customerStatementRouter.post("/:statementNo/confirm", requireAuthWithTenant, controller.confirm);
customerStatementRouter.post("/:statementNo/paid", requireAuthWithTenant, controller.markPaid);