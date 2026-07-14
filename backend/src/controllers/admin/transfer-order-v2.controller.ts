import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as transferOrderService from "../../services/admin/transfer-order.service";

// ========== 调拨单列表 ==========
export const listTransferOrders = asyncHandler(async (req, res) => {
  const result = await transferOrderService.listTransferOrders({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    status: req.query.status as string | undefined,
    fromStoreId: req.query.fromStoreId !== undefined ? Number(req.query.fromStoreId) : undefined,
    toStoreId: req.query.toStoreId !== undefined ? Number(req.query.toStoreId) : undefined,
    storeId: req.query.storeId !== undefined ? Number(req.query.storeId) : undefined,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined,
    keyword: req.query.keyword as string | undefined,
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// ========== 调拨单详情 ==========
export const getTransferOrderDetail = asyncHandler(async (req, res) => {
  const result = await transferOrderService.getTransferOrderDetail(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// ========== 创建调拨单 ==========
export const createTransferOrder = asyncHandler(async (req, res) => {
  const result = await transferOrderService.createTransferOrder({
    fromStoreId: Number(req.body.fromStoreId),
    fromStoreName: req.body.fromStoreName,
    toStoreId: Number(req.body.toStoreId),
    toStoreName: req.body.toStoreName,
    expectedDate: req.body.expectedDate,
    remark: req.body.remark,
    userId: req.user!.id,
    userName: req.body.userName,
    items: req.body.items || [],
    tenantId: req.tenantId!,
  });
  res.json(ok(result));
});

// ========== 更新调拨单 ==========
export const updateTransferOrder = asyncHandler(async (req, res) => {
  const result = await transferOrderService.updateTransferOrder(
    Number(req.params.id),
    req.tenantId!,
    {
      expectedDate: req.body.expectedDate,
      remark: req.body.remark,
      items: req.body.items,
    }
  );
  res.json(ok(result));
});

// ========== 删除调拨单 ==========
export const deleteTransferOrder = asyncHandler(async (req, res) => {
  const result = await transferOrderService.deleteTransferOrder(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// ========== 提交审核 ==========
export const submitTransferOrder = asyncHandler(async (req, res) => {
  const result = await transferOrderService.submitTransferOrder(
    Number(req.params.id),
    req.tenantId!
  );
  res.json(ok(result));
});

// ========== 审核通过 ==========
export const approveTransferOrder = asyncHandler(async (req, res) => {
  const result = await transferOrderService.approveTransferOrder(
    Number(req.params.id),
    req.tenantId!,
    {
      approverId: req.user!.id,
      approverName: req.body.approverName,
    }
  );
  res.json(ok(result));
});

// ========== 审核驳回 ==========
export const rejectTransferOrder = asyncHandler(async (req, res) => {
  const result = await transferOrderService.rejectTransferOrder(
    Number(req.params.id),
    req.tenantId!,
    {
      approverId: req.user!.id,
      approverName: req.body.approverName,
      rejectReason: req.body.rejectReason,
    }
  );
  res.json(ok(result));
});

// ========== 确认出库 ==========
export const confirmTransferOut = asyncHandler(async (req, res) => {
  const result = await transferOrderService.confirmTransferOut(
    Number(req.params.id),
    req.tenantId!,
    {
      operatorId: req.user!.id,
      operatorName: req.body.operatorName,
    }
  );
  res.json(ok(result));
});

// ========== 确认入库 ==========
export const confirmTransferIn = asyncHandler(async (req, res) => {
  const result = await transferOrderService.confirmTransferIn(
    Number(req.params.id),
    req.tenantId!,
    {
      operatorId: req.user!.id,
      operatorName: req.body.operatorName,
    }
  );
  res.json(ok(result));
});

// ========== 调拨统计 ==========
export const getTransferStats = asyncHandler(async (req, res) => {
  const result = await transferOrderService.getTransferStats(req.tenantId!);
  res.json(ok(result));
});
