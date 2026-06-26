import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as creditController from "../controllers/admin/credit.controller.js";
import * as creditAdjustController from "../controllers/admin/credit-adjust.controller.js";

export const creditRouter = Router();

creditRouter.get("/credits", requireAuthWithTenant, creditController.getCreditList);
creditRouter.get("/credits/:customerId", requireAuthWithTenant, creditController.getCreditDetail);
creditRouter.post("/credits/:customerId", requireAuthWithTenant, creditController.initCredit);
creditRouter.get("/credits/:customerId/check", requireAuthWithTenant, creditController.checkCredit);
creditRouter.post("/credits/:customerId/occupy", requireAuthWithTenant, creditController.occupyCredit);
creditRouter.post("/credits/:customerId/release", requireAuthWithTenant, creditController.releaseCredit);
creditRouter.post("/credits/:customerId/freeze", requireAuthWithTenant, creditController.freezeCredit);
creditRouter.post("/credits/:customerId/unfreeze", requireAuthWithTenant, creditController.unfreezeCredit);

creditRouter.put("/credits/:customerId/limit", requireAuthWithTenant, creditAdjustController.adjustLimit);
creditRouter.put("/credits/:customerId/term", requireAuthWithTenant, creditAdjustController.adjustTerm);
creditRouter.get("/credits/:customerId/logs", requireAuthWithTenant, creditAdjustController.getOperationLogs);

creditRouter.get("/collections", requireAuthWithTenant, creditController.getCollectionList);
creditRouter.post("/collections", requireAuthWithTenant, creditController.createCollection);
creditRouter.put("/collections/:id", requireAuthWithTenant, creditController.updateCollection);
creditRouter.get("/collections/overdue", requireAuthWithTenant, creditController.getOverdueCustomers);
creditRouter.post("/collections/batch-remind", requireAuthWithTenant, creditController.batchRemind);
creditRouter.get("/collections/statistics", requireAuthWithTenant, creditController.getCollectionStatistics);

creditRouter.get("/risk-customers", requireAuthWithTenant, creditController.getRiskCustomers);
