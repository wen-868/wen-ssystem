import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as inventoryLossOrderService from "../../services/admin/inventory-loss-order.service";

// 报损单列表
export const listLossOrders = asyncHandler(async (req, res) => {
  const result = await inventoryLossOrderService.listLossOrders({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    storeId: req.query.storeId !== undefined ? Number(req.query.storeId) : undefined,
    status: req.query.status as string | undefined,
    lossType: req.query.lossType as string | undefined,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined,
    keyword: req.query.keyword as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 报损单详情
export const getLossOrderDetail = asyncHandler(async (req, res) => {
  const result = await inventoryLossOrderService.getLossOrderDetail(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// 创建报损单
export const createLossOrder = asyncHandler(async (req, res) => {
  const result = await inventoryLossOrderService.createLossOrder({
    storeId: Number(req.body.storeId),
    storeName: req.body.storeName,
    lossType: req.body.lossType || "NORMAL",
    reason: req.body.reason,
    remark: req.body.remark,
    operatorId: req.user!.id,
    operatorName: req.body.operatorName,
    items: req.body.items || [],
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 审核通过报损单
export const approveLossOrder = asyncHandler(async (req, res) => {
  const result = await inventoryLossOrderService.approveLossOrder(
    Number(req.params.id),
    {
      auditorId: req.user!.id,
      auditorName: req.body.auditorName,
      tenantId: req.tenantId!,
    }
  );
  res.json(ok(result));
});

// 审核驳回报损单
export const rejectLossOrder = asyncHandler(async (req, res) => {
  const result = await inventoryLossOrderService.rejectLossOrder(
    Number(req.params.id),
    {
      auditorId: req.user!.id,
      auditorName: req.body.auditorName,
      rejectReason: req.body.rejectReason,
      tenantId: req.tenantId!,
    }
  );
  res.json(ok(result));
});
