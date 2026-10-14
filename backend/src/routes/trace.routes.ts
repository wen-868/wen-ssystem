import { Router } from "express";

import * as traceConfigController from "../controllers/admin/trace-config.controller";
import * as traceRecordsController from "../controllers/admin/trace-records.controller";
import type { RouteConfig } from "../shared/auto-routes";

// ========== Admin 追溯路由 ==========
export const adminTraceRouter = Router();

// 追溯配置
adminTraceRouter.get("/configs", traceConfigController.listConfigs);
// ==========================================================================
// S3-198 批B2-2（库存/追溯域）· 本文件写端点**本批不接线**（凌舟裁定，2026-10-14）
//   依据：生产 `t_sys_role.permissions` 实测 —— STORE_MANAGER =
//   ["store:*","sale:*","customer:*","inventory:*","report:*","dashboard:*",...]，**不含 trace:***；
//   `t_sys_role_permission` 关联表对 trace 码 0 命中 ⇒ 挂 `trace:code` 会给门店端制造 403。
//   「追溯是否授权门店端」属产品授权口径 ⇒ 先退不接，待另立「补授权」单（含角色种子 + 生产存量订正迁移）。
//   ⚠️ 复核提示：本域写端点因此**仍全部登记在** backend/scripts/rbac-wiring-baseline.json 里，
//      台账标注「待补授权（trace:* 未被任何门店角色持有）」。
//   另：POST /api/miniapp/trace/c/verify 属**消费者端免鉴权**（下方 routeConfigs 的 auth:"none"），
//      台账原判「管理面/是」已订正为「公开端点（免鉴权）」，不接。
// ==========================================================================
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
