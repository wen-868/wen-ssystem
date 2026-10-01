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
  const { openingCash, remark, startTime, operatorName, shiftType } = req.body || {};
  const result = await shiftService.createShift(
    req.tenantId!,
    req.user?.storeId ?? 1,
    req.user?.id ?? 1,
    // 用户填写的操作员优先，未填才回落到当前登录用户（S3-145：原先恒取登录用户，前端填了不生效）
    operatorName || req.user?.realName || req.user?.username || "",
    {
      // 用户选定的开始时间（S3-145：原先被静默忽略，恒取 DB 默认 CURRENT_TIMESTAMP）
      startTime: startTime || undefined,
      // 用户选定的班次类型（S3-147：合法值才落库，非法值由服务层抛 400）
      shiftType: shiftType || undefined,
      openingCash: Number(openingCash) || 0,
      remark: remark || undefined,
    }
  );
  res.json(ok(result));
});

/**
 * 交接班列表（S3-145：与详情/统计/盘点同源，读 t_shift）
 * 说明：查询参数 `shiftType` 由服务层按 resolveShiftType（落库值优先、空值回落派生）筛选。
 */
export const getShiftList = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const date = (req.query.date as string) || undefined;
  const shiftType = (req.query.shiftType as string) || undefined;
  const result = await shiftService.getShiftList(req.tenantId!, req.user?.storeId ?? 1, {
    page,
    pageSize,
    date,
    shiftType,
  });
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

/**
 * 关闭交接班（S3-146：「完成交接」的真实写路径）
 * 返回落库后的交接班详情（status=CLOSED、endTime 为服务端时间）；未知单号/跨门店 ⇒ 404，
 * 重复关闭 ⇒ 409（由 service 抛 AppError，errorHandler 统一转成业务码 + 中文文案）。
 */
export const closeShift = asyncHandler(async (req, res) => {
  const result = await shiftService.closeShift(
    req.tenantId!,
    req.user?.storeId ?? 1,
    String(req.params.shiftNo)
  );
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
