import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as billingConfigService from "../../services/platform/billing-config.service";

/**
 * R101-S2-02 组2：账单类配置端点（04 账单计费）
 *
 * 落库：t_platform_config（platform='SAAS'、config_key='billing:arrears_policy' / 'billing:addon_price'）
 * 口径 X：不新建业务表、零 DDL；zod 校验 + version + _unconfigured 元字段（护栏③④）。
 */

export const getArrearsPolicy = asyncHandler(async (_req, res) => {
  const result = await billingConfigService.getArrearsPolicy();
  res.json(ok(result));
});

export const updateArrearsPolicy = asyncHandler(async (req, res) => {
  const body = z.record(z.string(), z.unknown()).default({}).parse(req.body ?? {});
  const operator = req.user?.username ?? "system";
  const result = await billingConfigService.updateArrearsPolicy(body, operator);
  res.json(ok(result));
});

export const getAddonPrice = asyncHandler(async (_req, res) => {
  const result = await billingConfigService.getAddonPrice();
  res.json(ok(result));
});

export const updateAddonPrice = asyncHandler(async (req, res) => {
  const body = z.record(z.string(), z.unknown()).default({}).parse(req.body ?? {});
  const operator = req.user?.username ?? "system";
  const result = await billingConfigService.updateAddonPrice(body, operator);
  res.json(ok(result));
});
