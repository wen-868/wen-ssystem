import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import { creditAdjustService } from "../../services/admin/credit-adjust.service.js";
import type { ServiceContext } from "../../types/index.js";

function getServiceContext(req: any): ServiceContext {
  return {
    tenantId: req.tenantId!,
    userId: req.user!.id,
    username: req.user!.username,
    storeId: req.user!.storeId,
  };
}

export const adjustLimit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  const body = z.object({
    creditLimit: z.number().min(0),
    reason: z.string().max(255).default("调整授信额度")
  }).parse(req.body);

  try {
    const result = await creditAdjustService.adjustLimit(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const adjustTerm = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  const body = z.object({
    paymentTerm: z.enum(["COD", "NET_7", "NET_15", "NET_30", "NET_60", "NET_90"]),
    reason: z.string().max(255).default("调整账期")
  }).parse(req.body);

  try {
    const result = await creditAdjustService.adjustTerm(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const getOperationLogs = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);

  const result = await creditAdjustService.getOperationLogs(customerId, page, pageSize, ctx);
  res.json(ok(result));
});
