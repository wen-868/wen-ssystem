import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as service from "../../services/admin/order-timeout.service";
import { z } from "zod";

export const getConfigs = asyncHandler(async (req, res) => {
  const configs = await service.getConfigs(req.tenantId!);
  res.json(ok(configs));
});

export const createConfig = asyncHandler(async (req, res) => {
  const body = z.object({
    orderType: z.enum(["SALE", "PURCHASE", "TRANSFER"]),
    timeoutType: z.string().max(32),
    timeoutMinutes: z.number().int().positive(),
    action: z.string().max(32),
    enabled: z.boolean().optional().default(true),
    description: z.string().max(255).optional(),
  }).parse(req.body);

  const result = await service.createConfig(req.tenantId!, body);
  res.json(ok(result));
});

export const updateConfig = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = z.object({
    orderType: z.enum(["SALE", "PURCHASE", "TRANSFER"]).optional(),
    timeoutType: z.string().max(32).optional(),
    timeoutMinutes: z.number().int().positive().optional(),
    action: z.string().max(32).optional(),
    enabled: z.boolean().optional(),
    description: z.string().max(255).optional(),
  }).parse(req.body);

  const updated = await service.updateConfig(req.tenantId!, id, body);
  if (!updated) {
    res.status(400).json(fail("没有需要更新的字段", "400"));
    return;
  }
  res.json(ok({ message: "更新成功" }));
});

export const deleteConfig = asyncHandler(async (req, res) => {
  await service.deleteConfig(req.tenantId!, Number(req.params.id));
  res.json(ok({ message: "删除成功" }));
});

export const getLogs = asyncHandler(async (req, res) => {
  const result = await service.getLogs(req.tenantId!, {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    result: String(req.query.result || ""),
    dateStart: String(req.query.dateStart || ""),
    dateEnd: String(req.query.dateEnd || ""),
  });
  res.json(ok(result));
});

export const getStatistics = asyncHandler(async (req, res) => {
  const result = await service.getStatistics(req.tenantId!);
  res.json(ok(result));
});