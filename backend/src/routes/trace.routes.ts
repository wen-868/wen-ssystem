import { Router } from "express";

import * as traceConfigController from "../controllers/admin/trace-config.controller";
import * as traceRecordsController from "../controllers/admin/trace-records.controller";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";

// ========== Admin 追溯路由 ==========
export const adminTraceRouter = Router();

// 追溯配置
adminTraceRouter.get("/configs", traceConfigController.listConfigs);
// S3-198 批B2-2（库存/追溯域）：追溯管理与召回是管理面写动作，按台账 §三.12 建议码接线（全部 trace:code）。
// 持有者（仓库种子）= WAREHOUSE_STAFF（trace:*）/ SUPER_ADMIN、OPERATION_ADMIN（*）；
// 调用点 = admin-web/src/api/trace.ts 的写函数（全仓**零页面调用点**，仅 API 层导出）⇒ 无页面角色被 403。
// ⚠️ 本文件另有两处**本批不接**：POST /admin/trace/verify（app-mobile 溯源页无角色门禁）与
//    POST /api/miniapp/trace/c/verify（auth:"none" 的消费者端接口，台账判定有误，见回执 §四）。
adminTraceRouter.post("/configs", requirePermission("trace:code"), traceConfigController.createConfig);
adminTraceRouter.put("/configs/:id", requirePermission("trace:code"), traceConfigController.updateConfig);
adminTraceRouter.delete("/configs/:id", requirePermission("trace:code"), traceConfigController.deleteConfig);
adminTraceRouter.post("/configs/check", requirePermission("trace:code"), traceConfigController.checkSkuTrace);

// 追溯码管理
adminTraceRouter.post("/codes/generate", requirePermission("trace:code"), traceRecordsController.generateTraceCodes);
adminTraceRouter.get("/codes", traceRecordsController.listTraceCodes);
adminTraceRouter.get("/codes/:traceCode", traceRecordsController.getTraceCodeDetail);
adminTraceRouter.post("/codes/:traceCode/status", requirePermission("trace:code"), traceRecordsController.updateTraceCodeStatus);
adminTraceRouter.get("/codes/statistics", traceRecordsController.getTraceCodeStatistics);

// 追溯查询
adminTraceRouter.get("/query/:traceCode", traceRecordsController.queryTraceChain);
adminTraceRouter.post("/verify", traceRecordsController.verifyTraceCode);

// 召回管理
adminTraceRouter.post("/recalls", requirePermission("trace:code"), traceRecordsController.createRecall);
adminTraceRouter.get("/recalls", traceRecordsController.listRecalls);
adminTraceRouter.get("/recalls/:recallNo", traceRecordsController.getRecallDetail);
adminTraceRouter.post("/recalls/:recallNo/execute", requirePermission("trace:code"), traceRecordsController.executeRecall);
adminTraceRouter.put("/recalls/:recallNo/complete", requirePermission("trace:code"), traceRecordsController.completeRecall);

// ========== 小程序端追溯路由 ==========
export const miniappTraceRouter = Router();

miniappTraceRouter.get("/c/query/:traceCode", traceRecordsController.consumerQueryTrace);
miniappTraceRouter.post("/c/verify", traceRecordsController.consumerVerifyTraceCode);

// ========== 路由自动发现配置 ==========
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/admin/trace", router: adminTraceRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/miniapp/trace", router: miniappTraceRouter, auth: "none" },
];
