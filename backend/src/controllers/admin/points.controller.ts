import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as pointsService from "../../services/admin/points.service";
import { z } from "zod";

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
  const { levelName, minPoints, maxPoints, discountRate, benefits, status } = req.body;
  res.json(ok(await pointsService.createLevelConfig({ levelName, minPoints, maxPoints, discountRate, benefits, status, tenantId: req.tenantId! })));
});
export const updateLevelConfig = asyncHandler(async (req, res) => {
  const { levelName, minPoints, maxPoints, discountRate, benefits, status } = req.body;
  res.json(ok(await pointsService.updateLevelConfig(Number(req.params.id), { levelName, minPoints, maxPoints, discountRate, benefits, status, tenantId: req.tenantId! })));
});
/** 启用/停用会员等级 */
export const updateLevelConfigStatus = asyncHandler(async (req, res) => {
  const { status } = z.object({
    status: z.enum(["active", "disabled", "inactive"]),
  }).parse(req.body);
  res.json(ok(await pointsService.updateLevelConfigStatus(Number(req.params.id), status, req.tenantId!)));
});
/** 删除会员等级 */
export const deleteLevelConfig = asyncHandler(async (req, res) => {
  res.json(ok(await pointsService.deleteLevelConfig(Number(req.params.id), req.tenantId!)));
});
