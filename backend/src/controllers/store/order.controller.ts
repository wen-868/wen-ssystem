import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as orderService from "../../services/store/order.service";

export const listOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listOrders({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    storeId: req.user?.storeId ?? null,
    status: req.query.status ? String(req.query.status) : null,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderDetail(req.params.orderNo, req.tenantId!);
  if (!order) { res.status(404).json(fail("订单不存在", "404")); return; }
  res.json(ok(order));
});

export const acceptOrder = asyncHandler(async (req, res) => {
  const result = await orderService.acceptOrder(req.params.orderNo, req.tenantId!);
  if (!result) { res.status(404).json(fail("订单不存在", "404")); return; }
  res.json(ok(result));
});

export const startDelivery = asyncHandler(async (req, res) => {
  const result = await orderService.startDelivery(req.params.orderNo, req.tenantId!, req.user!.id ?? null, req.user!.username ?? "系统用户");
  if (!result) { res.status(400).json(fail("订单不存在或状态不允许开始配送", "400")); return; }
  res.json(ok(result));
});

export const completeDelivery = asyncHandler(async (req, res) => {
  const result = await orderService.completeDelivery(req.params.orderNo, req.user!.id ?? null);
  res.json(ok(result));
});

export const rejectOrder = asyncHandler(async (req, res) => {
  res.json(ok(await orderService.rejectOrder(req.params.orderNo, req.user!.id ?? null, req.tenantId!)));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  res.json(ok(await orderService.cancelOrder(req.params.orderNo, req.user!.id ?? null, req.tenantId!)));
});