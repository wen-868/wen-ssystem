import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as syncLogService from "../services/admin/miniapp-order-sync.service.js";

export const orderSyncLogRouter = Router();

// ========== 订单同步日志列表（分页+筛选） ==========
orderSyncLogRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    orderNo: z.string().optional(),
    status: z.coerce.number().optional(),
  }).parse(req.query);
  const result = await syncLogService.listSyncLogs(tenantId, params);
  res.json(ok(result));
}));

// ========== 重试同步 ==========
orderSyncLogRouter.post("/:orderNo/retry", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { orderNo } = z.object({ orderNo: z.string().min(1) }).parse(req.params);
  const result = await syncLogService.retrySync(tenantId, orderNo);
  res.json(ok(result));
}));