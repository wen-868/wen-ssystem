import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as aiBillingConfigService from "../../services/platform/ai-billing-config.service";

/**
 * R101-S2-02 组3：AI 类配置端点（AI 计费与积分抵扣配置）
 *
 * 落库：t_platform_config（platform='SAAS'、config_key='ai:billing_strategy' / 'ai:free_grant' /
 * 'ai:quota_pack' / 'ai:points_rate'）
 * 口径 X：不新建业务表、零 DDL；zod 校验 + version + _unconfigured 元字段（护栏③④）。
 */

export const getBillingStrategy = asyncHandler(async (_req, res) => {
  const result = await aiBillingConfigService.getBillingStrategy();
  res.json(ok(result));
});

export const updateBillingStrategy = asyncHandler(async (req, res) => {
  const body = z.record(z.string(), z.unknown()).default({}).parse(req.body ?? {});
  const operator = req.user?.username ?? "system";
  const result = await aiBillingConfigService.updateBillingStrategy(body, operator);
  res.json(ok(result));
});

export const getFreeGrant = asyncHandler(async (_req, res) => {
  const result = await aiBillingConfigService.getFreeGrant();
  res.json(ok(result));
});

export const updateFreeGrant = asyncHandler(async (req, res) => {
  const body = z.record(z.string(), z.unknown()).default({}).parse(req.body ?? {});
  const operator = req.user?.username ?? "system";
  const result = await aiBillingConfigService.updateFreeGrant(body, operator);
  res.json(ok(result));
});

export const getQuotaPacks = asyncHandler(async (_req, res) => {
  const result = await aiBillingConfigService.getQuotaPacks();
  res.json(ok(result));
});

export const updateQuotaPacks = asyncHandler(async (req, res) => {
  const body = z.record(z.string(), z.unknown()).default({}).parse(req.body ?? {});
  const operator = req.user?.username ?? "system";
  const result = await aiBillingConfigService.updateQuotaPacks(body, operator);
  res.json(ok(result));
});

export const getPointsRate = asyncHandler(async (_req, res) => {
  const result = await aiBillingConfigService.getPointsRate();
  res.json(ok(result));
});

export const updatePointsRate = asyncHandler(async (req, res) => {
  const body = z.record(z.string(), z.unknown()).default({}).parse(req.body ?? {});
  const operator = req.user?.username ?? "system";
  const result = await aiBillingConfigService.updatePointsRate(body, operator);
  res.json(ok(result));
});
