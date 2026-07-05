import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ok, fail } from "../../shared/response.js";
import * as subscriptionService from "../../services/admin/subscription.service.js";

export const listSubscriptions = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const {
    tenantId: tenantIdQuery, status, paymentStatus, page = 1, pageSize = 20
  } = req.query;

  const result = await subscriptionService.listSubscriptions(tenantId, {
    tenantIdQuery: tenantIdQuery as string | undefined,
    status: status as string | undefined,
    paymentStatus: paymentStatus as string | undefined,
    page: Number(page),
    pageSize: Number(pageSize),
  });
  res.json(ok(result));
});

export const getSubscription = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const subscriptionId = Number(req.params.subscriptionId);
  const result = await subscriptionService.getSubscription(subscriptionId, tenantId);
  if (!result) {
    res.status(404).json(fail("订阅不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const createSubscription = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    tenantId: z.number().int().positive(),
    planId: z.number().int().positive(),
    startDate: z.string(),
    paymentMethod: z.enum(["WECHAT", "ALIPAY", "BANK_TRANSFER", "CASH"]).optional(),
    autoRenew: z.number().int().min(0).max(1).default(0),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await subscriptionService.createSubscription(
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

export const changePlan = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const subscriptionId = Number(req.params.subscriptionId);
  const body = z.object({
    newPlanId: z.number().int().positive(),
    paymentMethod: z.enum(["WECHAT", "ALIPAY", "BANK_TRANSFER", "CASH"]).optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await subscriptionService.changePlan(
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

export const cancelSubscription = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const subscriptionId = Number(req.params.subscriptionId);
  const body = z.object({
    reason: z.string().max(255).optional(),
  }).parse(req.body);

  const result = await subscriptionService.cancelSubscription(
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

export const paySubscription = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const subscriptionId = Number(req.params.subscriptionId);
  const body = z.object({
    paymentMethod: z.enum(["WECHAT", "ALIPAY", "BANK_TRANSFER", "CASH"]),
    transactionNo: z.string().max(128).optional(),
  }).parse(req.body);

  const result = await subscriptionService.paySubscription(
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
