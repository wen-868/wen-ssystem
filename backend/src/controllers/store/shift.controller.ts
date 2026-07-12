import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as shiftService from "../../services/store/shift.service";

export const getCurrentShift = asyncHandler(async (req, res) => {
  const result = await shiftService.getCurrentShift(req.tenantId!, req.user?.storeId ?? 1);
  res.json(ok(result));
});

export const settleShift = asyncHandler(async (req, res) => {
  const { actualAmount } = req.body;
  const result = await shiftService.settleShift(
    req.tenantId!,
    req.user?.storeId ?? 1,
    req.user?.id ?? 1,
    actualAmount ?? 0
  );
  res.json(ok(result));
});

export const getShiftHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const result = await shiftService.getShiftHistory(
    req.tenantId!,
    req.user?.storeId ?? 1,
    page,
    pageSize
  );
  res.json(ok(result));
});