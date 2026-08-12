/**
 * 打印记录路由
 *
 * 用途：App 端蓝牙打印小票留痕审计 API
 * 路由前缀：/api/admin/print
 * 认证：requireAuthWithTenant（认证 + 租户隔离 + CSRF 防护，由 auto-routes 统一添加）
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
import * as printController from "../controllers/admin/print.controller";

export const printRouter = Router();

// ==================== 打印记录路由 ====================

// 保存打印记录
printRouter.post("/records", printController.createRecord);

// 查询打印记录列表（支持筛选 + 分页）
printRouter.get("/records", printController.listRecords);

// 查询单条打印记录详情
printRouter.get("/records/:id", printController.getRecordDetail);

// 重打（生成新记录，关联原记录 original_id）
printRouter.post("/records/:id/reprint", printController.reprint);

// ==================== 打印模板管理路由 ====================

// 枚举元数据（单据类型/纸张类型）
printRouter.get("/meta", printController.getPrintMeta);

// 模板列表（首次访问自动初始化默认模板）
printRouter.get("/templates", printController.listTemplates);

// 模板详情
printRouter.get("/templates/:id", printController.getTemplate);

// 新建模板
printRouter.post("/templates", printController.createTemplate);

// 更新模板
printRouter.put("/templates/:id", printController.updateTemplate);

// 删除模板
printRouter.delete("/templates/:id", printController.deleteTemplate);

// 重置为系统默认模板
printRouter.post("/templates/:id/reset", printController.resetTemplate);

// 设为默认模板（同单据类型仅一个默认启用）
printRouter.post("/templates/:id/set-default", printController.setDefaultTemplate);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
    prefix: "/api/admin/print",
    router: printRouter,
    auth: "requireAuthWithTenant",
};
