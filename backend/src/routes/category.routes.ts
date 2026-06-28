import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/category.service.js";

export const categoryRouter = Router();

// 分类列表
categoryRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const pid = req.query.pid !== undefined ? Number(req.query.pid) : undefined;
  const rows = await service.list({ pid, tenantId: req.tenantId! });
  res.json(ok(rows));
}));

// 新增分类
categoryRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(64),
    parentId: z.number().int().nullable().optional(),
    sortNo: z.number().int().default(0),
    icon: z.string().max(255).optional(),
    code: z.string().max(64).optional(),
  }).parse(req.body);
  const result = await service.create(body, req.tenantId!);
  res.json(ok(result));
}));

// 编辑分类
categoryRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(64).optional(),
      parentId: z.number().int().nullable().optional(),
      sortNo: z.number().int().optional(),
      icon: z.string().max(255).optional(),
      code: z.string().max(64).optional(),
    }).parse(req.body);
    const result = await service.update(Number(req.params.id), body, req.tenantId!);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
}));

// 删除分类
categoryRouter.delete("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  try {
    const result = await service.remove(Number(req.params.id), req.tenantId!);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
}));

// 分类排序 (PUT /:id/sort)
categoryRouter.put("/:id/sort", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    sortNo: z.number().int(),
  }).parse(req.body);
  const result = await service.sort(
    [{ id: Number(req.params.id), sortNo: body.sortNo }],
    req.tenantId!
  );
  res.json(ok(result));
}));