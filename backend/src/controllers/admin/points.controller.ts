import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as pointsService from "../../services/admin/points.service";

export const listPointsRules = asyncHandler(async (req, res) => { res.json(ok(await pointsService.listPointsRules(req.tenantId!))); });
export const createPointsRule = asyncHandler(async (req, res) => {
  const { ruleName, earnType, earnRate, dailyLimit } = req.body;
  res.json(ok(await pointsService.createPointsRule({ ruleName, earnType, earnRate, dailyLimit, tenantId: req.tenantId! })));
});
export const updatePointsRule = asyncHandler(async (req, res) => {
  const { ruleName, earnRate, dailyLimit, enabled } = req.body;
  res.json(ok(await pointsService.updatePointsRule(Number(req.params.id), { ruleName, earnRate, dailyLimit, enabled, tenantId: req.tenantId! })));
});
export const adjustCustomerPoints = asyncHandler(async (req, res) => {
  const { points, type, remark } = req.body;
  res.json(ok(await pointsService.adjustCustomerPoints({ customerId: Number(req.params.id), points, type, remark, tenantId: req.tenantId! })));
});
export const getCustomerPointsRecords = asyncHandler(async (req, res) => {
  res.json(ok(await pointsService.getCustomerPointsRecords({
    customerId: Number(req.params.id), type: req.query.type as string | undefined,
    page: Number(req.query.page || 1), pageSize: Number(req.query.pageSize || 20), tenantId: req.tenantId!
  })));
});
export const listLevelConfigs = asyncHandler(async (req, res) => { res.json(ok(await pointsService.listLevelConfigs(req.tenantId!))); });
export const createLevelConfig = asyncHandler(async (req, res) => {
  const { levelName, minPoints, maxPoints, discountRate, benefits } = req.body;
  res.json(ok(await pointsService.createLevelConfig({ levelName, minPoints, maxPoints, discountRate, benefits, tenantId: req.tenantId! })));
});
export const updateLevelConfig = asyncHandler(async (req, res) => {
  const { levelName, minPoints, maxPoints, discountRate, benefits } = req.body;
  res.json(ok(await pointsService.updateLevelConfig(Number(req.params.id), { levelName, minPoints, maxPoints, discountRate, benefits, tenantId: req.tenantId! })));
});