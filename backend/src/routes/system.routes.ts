import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as systemService from "../services/admin/system.service.js";

export const systemRouter = Router();

// ========== 系统健康检查（无需认证） ==========
systemRouter.get("/health", asyncHandler(async (_req, res) => {
  const result = await systemService.getHealth();
  res.json(ok(result));
}));

// ========== 系统信息（需认证） ==========
systemRouter.get("/info", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await systemService.getSystemInfo(tenantId);
  res.json(ok(result));
}));