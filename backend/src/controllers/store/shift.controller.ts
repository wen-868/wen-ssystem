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

/** 创建交接班 */
export const createShift = asyncHandler(async (req, res) => {
  const { openingCash, remark } = req.body || {};
  const result = await shiftService.createShift(
    req.tenantId!,
    req.user?.storeId ?? 1,
    req.user?.id ?? 1,
    req.user?.realName || req.user?.username || "",
    { openingCash: Number(openingCash) || 0, remark: remark || undefined }
  );
  res.json(ok(result));
});

/** 交接班详情 */
export const getShiftDetail = asyncHandler(async (req, res) => {
  const result = await shiftService.getShiftDetail(req.tenantId!, String(req.params.shiftNo));
  res.json(ok(result));
});

/** 交接班销售统计 */
export const getShiftSalesStats = asyncHandler(async (req, res) => {
  const result = await shiftService.getShiftSalesStats(req.tenantId!, String(req.params.shiftNo));
  res.json(ok(result));
});

/** 交接班盘点（库存快照） */
export const getShiftStockCheck = asyncHandler(async (req, res) => {
  const result = await shiftService.getShiftStockCheck(req.tenantId!, req.user?.storeId ?? 1);
  res.json(ok(result));
});

/** 提交交接班盘点 */
export const submitShiftStockCheck = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    res.status(400).json({ success: false, code: "400", message: "盘点明细不能为空" });
    return;
  }
  const result = await shiftService.submitShiftStockCheck(
    req.tenantId!,
    String(req.params.shiftNo),
    items
  );
  res.json(ok(result));
});
