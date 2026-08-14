import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/daily-settlement.service";

export const createDailySettlement = asyncHandler(async (req, res) => {
  const result = await service.createDailySettlement({
    settleDate: req.body.settleDate,
    tenantId: req.tenantId!,
    operatorId: req.user!.id ?? 0
  });
  res.json(ok(result));
});

export const listDailySettlements = asyncHandler(async (req, res) => {
  const result = await service.listDailySettlements({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined
  });
  res.json(ok(result));
});

export const getDailySettlementDetail = asyncHandler(async (req, res) => {
  const result = await service.getDailySettlementDetail(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});