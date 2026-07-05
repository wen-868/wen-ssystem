import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/brand.service.js";

export const brandRouter = Router();

// 品牌列表
brandRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const rows = await service.list({
    keyword: req.query.keyword as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(rows));
}));

// 新增品牌
brandRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(64),
    logo: z.string().max(512).optional(),
    description: z.string().max(255).optional(),
    sortNo: z.number().int().default(0),
  }).parse(req.body);
  const result = await service.create(body, req.tenantId!);
  res.json(ok(result));
}));

// 编辑品牌
brandRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(64).optional(),
      logo: z.string().max(512).optional(),
      description: z.string().max(255).optional(),
      sortNo: z.number().int().optional(),
    }).parse(req.body);
    const result = await service.update(Number(req.params.id), body, req.tenantId!);
    res.json(ok(result));
  } catch (e: unknown) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
}));

// 删除品牌
brandRouter.delete("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  try {
    const result = await service.remove(Number(req.params.id), req.tenantId!);
    res.json(ok(result));
  } catch (e: unknown) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
}));
// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/brands",
  router: brandRouter,
  auth: "requireAuthWithTenant",
};
