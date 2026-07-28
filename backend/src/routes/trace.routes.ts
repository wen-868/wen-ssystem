import { Router } from "express";

import * as traceConfigController from "../controllers/admin/trace-config.controller";
import * as traceRecordsController from "../controllers/admin/trace-records.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ========== Admin 追溯路由 ==========
export const adminTraceRouter = Router();

// 追溯配置
adminTraceRouter.get("/configs", traceConfigController.listConfigs);
adminTraceRouter.post("/configs", traceConfigController.createConfig);
adminTraceRouter.put("/configs/:id", traceConfigController.updateConfig);
adminTraceRouter.delete("/configs/:id", traceConfigController.deleteConfig);
adminTraceRouter.post("/configs/check", traceConfigController.checkSkuTrace);

// 追溯码管理
adminTraceRouter.post("/codes/generate", traceRecordsController.generateTraceCodes);
adminTraceRouter.get("/codes", traceRecordsController.listTraceCodes);
adminTraceRouter.get("/codes/:traceCode", traceRecordsController.getTraceCodeDetail);
adminTraceRouter.post("/codes/:traceCode/status", traceRecordsController.updateTraceCodeStatus);
adminTraceRouter.get("/codes/statistics", traceRecordsController.getTraceCodeStatistics);

// 追溯查询
adminTraceRouter.get("/query/:traceCode", traceRecordsController.queryTraceChain);
adminTraceRouter.post("/verify", traceRecordsController.verifyTraceCode);

// 召回管理
adminTraceRouter.post("/recalls", traceRecordsController.createRecall);
adminTraceRouter.get("/recalls", traceRecordsController.listRecalls);
adminTraceRouter.get("/recalls/:recallNo", traceRecordsController.getRecallDetail);
adminTraceRouter.post("/recalls/:recallNo/execute", traceRecordsController.executeRecall);
adminTraceRouter.put("/recalls/:recallNo/complete", traceRecordsController.completeRecall);

// ========== 小程序端追溯路由 ==========
export const miniappTraceRouter = Router();

miniappTraceRouter.get("/c/query/:traceCode", traceRecordsController.consumerQueryTrace);
miniappTraceRouter.post("/c/verify", traceRecordsController.consumerVerifyTraceCode);

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/trace", router: adminTraceRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/miniapp/trace", router: miniappTraceRouter, auth: "none" },
];