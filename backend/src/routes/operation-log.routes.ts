import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as operationLogService from "../services/admin/operation-log.service.js";

export const operationLogRouter = Router();

// ========== 操作日志列表（分页+筛选） ==========
operationLogRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    module: z.string().optional(),
    action: z.string().optional(),
    operatorName: z.string().optional(),
    bizNo: z.string().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional(),
  }).parse(req.query);
  const result = await operationLogService.listLogs(tenantId, params);
  res.json(ok(result));
}));

// ========== 操作日志统计 ==========
operationLogRouter.get("/statistics", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await operationLogService.getStatistics(tenantId);
  res.json(ok(result));
}));