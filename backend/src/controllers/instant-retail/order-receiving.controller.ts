import { asyncHandler } from "../../middleware/async-handler.js";
import { ok, fail } from "../../shared/response.js";
import * as orderReceivingService from "../../services/instant-retail/order-receiving.service.js";

export const listOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const storeId = req.user?.storeId ? String(req.user.storeId) : null;
  const platform = req.query.platform ? String(req.query.platform) : null;
  const result = await orderReceivingService.listOrders(page, pageSize, storeId, platform, tenantId);
  res.json(ok(result));
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await orderReceivingService.getOrderDetail(req.params.platformOrderId, tenantId);
  if (!result) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  res.json(ok(result));
});

export const confirmOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await orderReceivingService.confirmOrder(req.params.platformOrderId, tenantId);
  if (!result.found) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  if (!result.configFound) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await orderReceivingService.cancelOrder(
    req.params.platformOrderId,
    req.body.reason,
    tenantId
  );
  if (!result.found) {
    res.status(404).json(fail("订单不存在", "404"));
    return;
  }
  if (!result.configFound) {
    res.status(404).json(fail("平台配置不存在", "404"));
    return;
  }
  res.json(ok({ platformOrderId: result.platformOrderId, success: result.success, status: result.status }));
});
