import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as subscriptionService from "../../services/saas/subscription.service";

export const listSubscriptions = asyncHandler(async (req, res) => {
  const { tenantId, status, planId, keyword, page = 1, pageSize = 20 } = req.query;
  const result = await subscriptionService.listSubscriptions({
    tenantId: tenantId ? Number(tenantId) : undefined,
    status: status as string | undefined,
    planId: planId ? Number(planId) : undefined,
    keyword: keyword as string | undefined,
    page: Number(page),
    pageSize: Number(pageSize),
  });
  res.json(ok(result));
});

export const getSubscriptionDetail = asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const result = await subscriptionService.getSubscriptionDetail(subscriptionId);
  if (!result) {
    res.status(404).json(fail("订阅不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const createSubscription = asyncHandler(async (req, res) => {
  const body = z.object({
    tenantId: z.number().int().positive(),
    planId: z.number().int().positive(),
    planName: z.string().min(1).max(64),
    planType: z.enum(["MONTHLY", "YEARLY", "PERMANENT"]),
    durationDays: z.number().int().positive(),
    price: z.number().positive(),
    startDate: z.string().optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await subscriptionService.createSubscription({
    ...body,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
  });
  res.json(ok(result));
});

export const renewSubscription = asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const body = z.object({
    durationDays: z.number().int().positive(),
    price: z.number().positive().optional(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await subscriptionService.renewSubscription(subscriptionId, body);
  if (!result) {
    res.status(404).json(fail("订阅不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const upgradeSubscription = asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const body = z.object({
    newPlanId: z.number().int().positive(),
    remark: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await subscriptionService.upgradeSubscription(subscriptionId, body);
  if (!result) {
    res.status(404).json(fail("订阅不存在或套餐不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const subscriptionId = Number(req.params.id);
  const body = z.object({
    cancelReason: z.string().max(255).optional(),
  }).parse(req.body);

  const result = await subscriptionService.cancelSubscription(subscriptionId, body);
  if (!result) {
    res.status(404).json(fail("订阅不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const getSubscriptionStatistics = asyncHandler(async (req, res) => {
  const result = await subscriptionService.getSubscriptionStatistics();
  res.json(ok(result));
});
