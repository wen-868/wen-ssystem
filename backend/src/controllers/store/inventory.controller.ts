import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as inventoryService from "../../services/store/inventory.service.js";

export const listInventory = asyncHandler(async (req, res) => {
  const result = await inventoryService.listInventory({
    keyword: String(req.query.keyword || ""),
    storeId: req.query.storeId ? Number(req.query.storeId) : req.user?.storeId,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const adjustInventory = asyncHandler(async (req, res) => {
  const body = z.object({
    storeId: z.number().optional(),
    skuId: z.number(),
    stockType: z.enum(["ONLINE", "OFFLINE"]).default("OFFLINE"),
    change: z.number(),
    remark: z.string().optional()
  }).parse(req.body);
  const result = await inventoryService.adjustInventory({
    storeId: body.storeId ?? req.user?.storeId ?? 1,
    skuId: body.skuId,
    stockType: body.stockType,
    change: body.change,
    remark: body.remark,
    userId: req.user!.id ?? 0,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listInventoryLogs = asyncHandler(async (req, res) => {
  const result = await inventoryService.listInventoryLogs({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    storeId: req.query.storeId ? Number(req.query.storeId) : req.user?.storeId,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listInventoryAlerts = asyncHandler(async (req, res) => {
  const result = await inventoryService.listInventoryAlerts(
    req.query.storeId ? Number(req.query.storeId) : req.user?.storeId ?? null,
    req.tenantId!
  );
  res.json(ok(result));
});