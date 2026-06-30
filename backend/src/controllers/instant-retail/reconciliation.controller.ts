import { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/instant-retail/reconciliation.service.js";

export const getReconciliationSummary = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, platform, storeId } = req.query as any;
  const result = await svc.getReconciliationSummary({
    tenantId: req.tenantId!, startDate, endDate, platform,
    storeId: storeId ? Number(storeId) : undefined,
  });
  res.json(ok(result));
});

export const listReconciliationRecords = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, platform, startDate, endDate, storeId } = req.query as any;
  const result = await svc.listReconciliationRecords({
    tenantId: req.tenantId!,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
    platform, startDate, endDate,
    storeId: storeId ? Number(storeId) : undefined,
  });
  res.json(ok(result));
});