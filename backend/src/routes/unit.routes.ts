import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/unit.service.js";

export const unitRouter = Router();

// 单位列表
unitRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const rows = await service.list({
    keyword: req.query.keyword as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(rows));
}));

// 新增单位
unitRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(32),
    code: z.string().min(1).max(32),
    type: z.enum(["BASE", "BOX"]).default("BASE"),
    sortNo: z.number().int().default(0),
  }).parse(req.body);
  const result = await service.create(body, req.tenantId!);
  res.json(ok(result));
}));

// 编辑单位
unitRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(32).optional(),
      code: z.string().min(1).max(32).optional(),
      type: z.enum(["BASE", "BOX"]).optional(),
      sortNo: z.number().int().optional(),
    }).parse(req.body);
    const result = await service.update(Number(req.params.id), body, req.tenantId!);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
}));

// 删除单位
unitRouter.delete("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  try {
    const result = await service.remove(Number(req.params.id), req.tenantId!);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
}));