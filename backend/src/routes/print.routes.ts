/**
 * 打印记录路由
 *
 * 用途：App 端蓝牙打印小票留痕审计 API
 * 路由前缀：/api/admin/print
 * 认证：requireAuthWithTenant（认证 + 租户隔离 + CSRF 防护）
 *
 * 路由列表：
 *   POST /records          保存打印记录
 *   GET  /records          查询打印记录（支持 bill_type/bill_no/store_id/status/operatorId/startDate/endDate 筛选 + 分页）
 *   GET  /records/:id      查询单条详情
 *   POST /records/:id/reprint  重打（生成新记录，关联原记录 original_id）
 *
 * 关联任务：R51-03 后端打印记录 API
 */

import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as printController from "../controllers/admin/print.controller";

export const printRouter = Router();

printRouter.use(requireAuthWithTenant);

// ==================== 打印记录路由 ====================

// 保存打印记录
printRouter.post("/records", printController.createRecord);

// 查询打印记录列表（支持筛选 + 分页）
printRouter.get("/records", printController.listRecords);

// 查询单条打印记录详情
printRouter.get("/records/:id", printController.getRecordDetail);

// 重打（生成新记录，关联原记录 original_id）
printRouter.post("/records/:id/reprint", printController.reprint);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
    prefix: "/api/admin/print",
    router: printRouter,
    auth: "requireAuthWithTenant",
};
