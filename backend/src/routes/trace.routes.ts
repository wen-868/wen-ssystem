import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as traceConfigController from "../controllers/admin/trace-config.controller.js";
import * as traceRecordsController from "../controllers/admin/trace-records.controller.js";

export const adminTraceRouter = Router();

adminTraceRouter.get("/configs", requireAuthWithTenant, traceConfigController.listConfigs);
adminTraceRouter.post("/configs", requireAuthWithTenant, traceConfigController.createConfig);
adminTraceRouter.put("/configs/:id", requireAuthWithTenant, traceConfigController.updateConfig);
adminTraceRouter.delete("/configs/:id", requireAuthWithTenant, traceConfigController.deleteConfig);
adminTraceRouter.post("/configs/check", requireAuthWithTenant, traceConfigController.checkSkuTrace);

adminTraceRouter.post("/codes/generate", requireAuthWithTenant, traceRecordsController.generateTraceCodes);
adminTraceRouter.get("/codes", requireAuthWithTenant, traceRecordsController.listTraceCodes);
adminTraceRouter.get("/codes/:traceCode", requireAuthWithTenant, traceRecordsController.getTraceCodeDetail);
adminTraceRouter.post("/codes/:traceCode/status", requireAuthWithTenant, traceRecordsController.updateTraceCodeStatus);
adminTraceRouter.get("/codes/statistics", requireAuthWithTenant, traceRecordsController.getTraceCodeStatistics);

adminTraceRouter.get("/query/:traceCode", requireAuthWithTenant, traceRecordsController.queryTraceChain);
adminTraceRouter.post("/verify", requireAuthWithTenant, traceRecordsController.verifyTraceCode);

adminTraceRouter.post("/recalls", requireAuthWithTenant, traceRecordsController.createRecall);
adminTraceRouter.get("/recalls", requireAuthWithTenant, traceRecordsController.listRecalls);
adminTraceRouter.get("/recalls/:recallNo", requireAuthWithTenant, traceRecordsController.getRecallDetail);
adminTraceRouter.post("/recalls/:recallNo/execute", requireAuthWithTenant, traceRecordsController.executeRecall);
adminTraceRouter.put("/recalls/:recallNo/complete", requireAuthWithTenant, traceRecordsController.completeRecall);

export const miniappTraceRouter = Router();

miniappTraceRouter.get("/c/query/:traceCode", traceRecordsController.consumerQueryTrace);
miniappTraceRouter.post("/c/verify", traceRecordsController.consumerVerifyTraceCode);
