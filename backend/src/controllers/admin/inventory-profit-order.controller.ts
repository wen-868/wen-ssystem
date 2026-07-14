import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as inventoryProfitOrderService from "../../services/admin/inventory-profit-order.service";

// 报溢单列表
export const listProfitOrders = asyncHandler(async (req, res) => {
  const result = await inventoryProfitOrderService.listProfitOrders({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    storeId: req.query.storeId !== undefined ? Number(req.query.storeId) : undefined,
    status: req.query.status as string | undefined,
    profitType: req.query.profitType as string | undefined,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined,
    keyword: req.query.keyword as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 报溢单详情
export const getProfitOrderDetail = asyncHandler(async (req, res) => {
  const result = await inventoryProfitOrderService.getProfitOrderDetail(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// 创建报溢单
export const createProfitOrder = asyncHandler(async (req, res) => {
  const result = await inventoryProfitOrderService.createProfitOrder({
    storeId: Number(req.body.storeId),
    storeName: req.body.storeName,
    profitType: req.body.profitType || "NORMAL",
    reason: req.body.reason,
    remark: req.body.remark,
    operatorId: req.user!.id,
    operatorName: req.body.operatorName,
    items: req.body.items || [],
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// 审核通过报溢单
export const approveProfitOrder = asyncHandler(async (req, res) => {
  const result = await inventoryProfitOrderService.approveProfitOrder(
    Number(req.params.id),
    {
      auditorId: req.user!.id,
      auditorName: req.body.auditorName,
      tenantId: req.tenantId!,
    }
  );
  res.json(ok(result));
});

// 审核驳回报溢单
export const rejectProfitOrder = asyncHandler(async (req, res) => {
  const result = await inventoryProfitOrderService.rejectProfitOrder(
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
