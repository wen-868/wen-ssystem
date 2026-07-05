import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok } from "../../shared/response.js";
import * as subscriptionRenewalService from "../../services/admin/subscription-renewal.service.js";

export const renewSubscription = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const subscriptionId = Number(req.params.subscriptionId);
  const body = z.object({
    planId: z.number().int().positive().optional(),
    paymentMethod: z.enum(["WECHAT", "ALIPAY", "BANK_TRANSFER", "CASH"]).optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await subscriptionRenewalService.renewSubscription(
    subscriptionId,
    body,
    req.user!.id,
    req.user!.username,
    tenantId
  );
  if ((result as any).code) {
    res.status(Number((result as any).code)).json(result);
    return;
  }
  res.json(ok(result));
});

export const listExpiring = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const days = Number(req.query.days || 7);
  const result = await subscriptionRenewalService.listExpiring(days, tenantId);
  res.json(ok(result));
});

export const listExpired = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await subscriptionRenewalService.listExpired(tenantId);
  res.json(ok(result));
});
