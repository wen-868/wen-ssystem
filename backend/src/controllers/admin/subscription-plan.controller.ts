import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as subscriptionPlanService from "../../services/admin/subscription-plan.service";

export const listPlans = asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const result = await subscriptionPlanService.listPlans(status);
  res.json(ok(result));
});

export const getPlan = asyncHandler(async (req, res) => {
  const planId = Number(req.params.planId);
  const record = await subscriptionPlanService.getPlan(planId);
  if (!record) {
    res.status(404).json(fail("套餐不存在", "404"));
    return;
  }
  res.json(ok(record));
});

export const createPlan = asyncHandler(async (req, res) => {
  const body = z.object({
    planCode: z.string().min(1).max(32),
    planName: z.string().min(1).max(64),
    planType: z.enum(["MONTHLY", "YEARLY", "PERMANENT"]),
    price: z.number().min(0),
    originalPrice: z.number().min(0).optional(),
    durationDays: z.number().int().min(1),
    maxUsers: z.number().int().min(1).default(5),
    maxStores: z.number().int().min(1).default(1),
    maxCustomers: z.number().int().min(1).default(1000),
    maxProducts: z.number().int().min(1).default(500),
    maxStorageMb: z.number().int().min(1).default(1024),
    features: z.any().optional(),
    moduleAccess: z.any().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().default(0),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  }).parse(req.body);

  const result = await subscriptionPlanService.createPlan(body);
  res.json(ok(result));
});

export const updatePlan = asyncHandler(async (req, res) => {
  const planId = Number(req.params.planId);
  const body = z.object({
    planName: z.string().min(1).max(64).optional(),
    planType: z.enum(["MONTHLY", "YEARLY", "PERMANENT"]).optional(),
    price: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    durationDays: z.number().int().min(1).optional(),
    maxUsers: z.number().int().min(1).optional(),
    maxStores: z.number().int().min(1).optional(),
    maxCustomers: z.number().int().min(1).optional(),
    maxProducts: z.number().int().min(1).optional(),
    maxStorageMb: z.number().int().min(1).optional(),
    features: z.any().optional(),
    moduleAccess: z.any().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }).parse(req.body);

  const result = await subscriptionPlanService.updatePlan(planId, body);
  if (!result) {
    res.status(404).json(fail("套餐不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const deletePlan = asyncHandler(async (req, res) => {
  const planId = Number(req.params.id);
  const result = await subscriptionPlanService.deletePlan(planId);
  if (!result) {
    res.status(404).json(fail("套餐不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const updatePlanFeatures = asyncHandler(async (req, res) => {
  const planId = Number(req.params.id);
  const body = z.object({
    features: z.any().optional(),
    moduleAccess: z.any().optional(),
  }).parse(req.body);

  const result = await subscriptionPlanService.updatePlanFeatures(planId, body);
  if (!result) {
    res.status(404).json(fail("套餐不存在", "404"));
    return;
  }
  res.json(ok(result));
});
