import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { ok, fail } from "../shared/response.js";
import * as platformService from "../services/platform.service.js";

export const platformRouter = Router();

// GET /api/platform/overview - 平台总览
platformRouter.get("/overview", asyncHandler(async (_req, res) => {
  try {
    const result = await platformService.getOverview();
    res.json(ok(result));
  } catch (err: any) {
    res.status(500).json(fail(err.message || "服务器错误"));
  }
}));

// GET /api/platform/tenants - 平台租户列表
platformRouter.get("/tenants", asyncHandler(async (_req, res) => {
  try {
    const result = await platformService.getTenants();
    res.json(ok(result));
  } catch (err: any) {
    res.status(500).json(fail(err.message || "服务器错误"));
  }
}));

// GET /api/platform/health - 平台健康检查
platformRouter.get("/health", asyncHandler(async (_req, res) => {
  const result = await platformService.getHealth();
  res.json(ok(result));
}));