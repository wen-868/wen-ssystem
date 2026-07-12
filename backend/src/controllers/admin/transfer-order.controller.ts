import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import { z } from "zod";
import * as transferOrderService from "../../services/transfer-order.service";

export const createTransferOrder = asyncHandler(async (req, res) => {
  const body = z.object({
    fromStoreId: z.number().int().positive(),
    toStoreId: z.number().int().positive(),
    expectedDate: z.string().optional(),
    remark: z.string().default(""),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative()
    })).min(1)
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const result = await transferOrderService.createTransferOrder({
    tenantId,
    userId: userId ?? null,
    fromStoreId: body.fromStoreId,
    toStoreId: body.toStoreId,
    expectedDate: body.expectedDate,
    remark: body.remark,
    items: body.items
  });
  res.json(ok(result));
});

export const listTransferOrders = asyncHandler(async (req, res) => {
  const params = z.object({
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(20),
    status: z.enum(["DRAFT", "PENDING", "APPROVED", "TRANSIT", "RECEIVED", "CANCELLED"]).optional(),
    storeId: z.coerce.number().optional(),
    dateStart: z.string().optional(),
    dateEnd: z.string().optional()
  }).parse(req.query);

  const tenantId = req.tenantId!;

  const result = await transferOrderService.listTransferOrders({
    tenantId,
    page: params.page,
    pageSize: params.pageSize,
    status: params.status,
    storeId: params.storeId,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd
  });

  res.json(ok(result));
});

export const getTransferStatistics = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await transferOrderService.getTransferStatistics(tenantId);
  res.json(ok(result));
});

export const getTransferOrderDetail = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const tenantId = req.tenantId!;

  const result = await transferOrderService.getTransferOrderDetail(id, tenantId);
  res.json(ok(result));
});

export const updateTransferOrder = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const body = z.object({
    expectedDate: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      skuName: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative()
    })).optional()
  }).parse(req.body);

  const tenantId = req.tenantId!;

  const result = await transferOrderService.updateTransferOrder(id, tenantId, {
    expectedDate: body.expectedDate,
    remark: body.remark,
    items: body.items
  });
  res.json(ok(result));
});

export const submitTransferOrder = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const tenantId = req.tenantId!;

  const result = await transferOrderService.submitTransferOrder(id, tenantId);
  res.json(ok(result));
});

export const approveTransferOrder = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const result = await transferOrderService.approveTransferOrder(id, tenantId, userId ?? null);
  res.json(ok(result));
});

export const rejectTransferOrder = asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const tenantId = req.tenantId!;

  const result = await transferOrderService.rejectTransferOrder(id, tenantId);
  res.json(ok(result));
});
