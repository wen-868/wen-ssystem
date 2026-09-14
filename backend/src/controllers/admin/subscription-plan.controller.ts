import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as subscriptionPlanService from "../../services/admin/subscription-plan.service";
import * as planPolicyService from "../../services/platform/plan-policy.service";
import {
  PLAN_STATUSES,
  PLAN_TYPES,
  planFeaturesSchema,
} from "../../schemas/plan.schema";

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
    planType: z.enum(PLAN_TYPES),
    price: z.number().min(0),
    originalPrice: z.number().min(0).optional(),
    durationDays: z.number().int().min(1),
    maxUsers: z.number().int().min(1).default(5),
    maxStores: z.number().int().min(1).default(1),
    maxCustomers: z.number().int().min(1).default(1000),
    maxProducts: z.number().int().min(1).default(500),
    maxStorageMb: z.number().int().min(1).default(1024),
    features: planFeaturesSchema.nullable().optional(),
    moduleAccess: z.any().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().default(0),
    status: z.enum(PLAN_STATUSES).default("ACTIVE"),
  }).parse(req.body);

  const result = await subscriptionPlanService.createPlan(body);
  res.json(ok(result));
});

export const updatePlan = asyncHandler(async (req, res) => {
  const planId = Number(req.params.planId);
  const body = z.object({
    planName: z.string().min(1).max(64).optional(),
    planType: z.enum(PLAN_TYPES).optional(),
    price: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    durationDays: z.number().int().min(1).optional(),
    maxUsers: z.number().int().min(1).optional(),
    maxStores: z.number().int().min(1).optional(),
    maxCustomers: z.number().int().min(1).optional(),
    maxProducts: z.number().int().min(1).optional(),
    maxStorageMb: z.number().int().min(1).optional(),
    features: planFeaturesSchema.nullable().optional(),
    moduleAccess: z.any().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().optional(),
    status: z.enum(PLAN_STATUSES).optional(),
  }).parse(req.body);

  const result = await subscriptionPlanService.updatePlan(planId, body);
  if (!result) {
    res.status(404).json(fail("套餐不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const deletePlan = asyncHandler(async (req, res) => {
  // R101-S2-01 修复：本文件所有路由（platform-plans.routes.ts / subscription.routes.ts）
  // 声明的参数名均为 :planId，此处原写 req.params.id → undefined → Number(undefined) = NaN，
  // 导致「删除套餐」恒返回 404「套餐不存在」。兼容两种参数名，向后安全。
  const planId = Number(req.params.planId ?? req.params.id);
  const result = await subscriptionPlanService.deletePlan(planId);
  if (!result) {
    res.status(404).json(fail("套餐不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const updatePlanFeatures = asyncHandler(async (req, res) => {
  // R101-S2-01 修复：同上，路由参数名为 :planId，原 req.params.id 恒为 NaN
  const planId = Number(req.params.planId ?? req.params.id);
  const body = z.object({
    features: planFeaturesSchema.nullable().optional(),
    moduleAccess: z.any().optional(),
  }).parse(req.body);

  const result = await subscriptionPlanService.updatePlanFeatures(planId, body);
  if (!result) {
    res.status(404).json(fail("套餐不存在", "404"));
    return;
  }
  res.json(ok(result));
});

/**
 * R101-S2-02 组1：套餐策略配置（升级 / 降级 / 续费 / 扩展额度 / 限时活动）
 *
 * 这些项在 t_subscription_plan 无对应列，按凌舟裁定「口径 X」不新建表、
 * 不复用 features 列（该列为功能特性码数组且被公开端点透出），
 * 改落 t_platform_config：platform='SAAS', config_key='plan_policy:<planId>'。
 */
export const getPlanPolicy = asyncHandler(async (req, res) => {
  const planId = Number(req.params.planId ?? req.params.id);
  if (!Number.isFinite(planId) || planId <= 0) {
    res.status(400).json(fail("套餐ID非法", "400"));
    return;
  }
  const result = await planPolicyService.getPlanPolicy(planId);
  res.json(ok(result));
});

export const updatePlanPolicy = asyncHandler(async (req, res) => {
  const planId = Number(req.params.planId ?? req.params.id);
  if (!Number.isFinite(planId) || planId <= 0) {
    res.status(400).json(fail("套餐ID非法", "400"));
    return;
  }
  // 请求体整包接收后再由 service 做 zod 校验与元字段清理（护栏③④）
  const body = z.record(z.string(), z.unknown()).default({}).parse(req.body ?? {});
  const operator = req.user?.username ?? "system";
  const result = await planPolicyService.updatePlanPolicy(planId, body, operator);
  res.json(ok(result));
});
