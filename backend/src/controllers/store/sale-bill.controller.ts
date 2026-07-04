import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as saleBillService from "../../services/store/sale-bill.service.js";
import { storeSaleBillItemSchema } from "../../routes/store-sale-bill.routes.js";

export const listSaleBills = asyncHandler(async (req, res) => {
  const result = await saleBillService.listSaleBills({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    storeId: req.user?.storeId ?? null,
    keyword: String(req.query.keyword || ""),
    collectionStatus: req.query.collectionStatus ? String(req.query.collectionStatus) : null,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getSaleBillDetail = asyncHandler(async (req, res) => {
  const bill = await saleBillService.getSaleBillDetail(req.params.billNo, req.tenantId!);
  if (!bill) { res.status(404).json({ code: "404", message: "销售单不存在" }); return; }
  res.json(ok(bill));
});

export const createSaleBill = asyncHandler(async (req, res) => {
  const body = z.object({
    storeId: z.number().optional(),
    customerId: z.number().nullable().optional(),
    customerName: z.string().optional(),
    customerMobile: z.string().optional(),
    discountAmount: z.number().default(0),
    roundingAmount: z.number().default(0),
    remark: z.string().optional(),
    internalRemark: z.string().optional(),
    saleType: z.enum(["CASH", "CREDIT"]).default("CASH"),
    dueDate: z.string().optional(),
    items: z.array(storeSaleBillItemSchema).min(1)
  }).parse(req.body);
  const result = await saleBillService.createSaleBill({
    ...body,
    storeId: body.storeId ?? req.user?.storeId ?? 1,
    customerId: body.customerId ?? null,
    userId: req.user!.id ?? 0,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const createCollectionLink = asyncHandler(async (req, res) => {
  const body = z.object({
    shareChannel: z.enum(["MINIAPP_CARD", "LINK", "IMAGE", "QR_CODE"]).default("LINK"),
    amount: z.number(),
    taxEnabled: z.boolean().default(false),
    taxRate: z.number().min(0).max(1).default(0),
    expireHours: z.number().default(72),
    remark: z.string().optional()
  }).parse(req.body);
  const result = await saleBillService.createCollectionLink({
    billNo: req.params.billNo,
    shareChannel: body.shareChannel,
    amount: body.amount,
    taxEnabled: body.taxEnabled,
    taxRate: body.taxRate,
    expireHours: body.expireHours,
    remark: body.remark,
    userId: req.user!.id ?? 0,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const offlinePayment = asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "OTHER_WECHAT", "ALIPAY"]),
    remark: z.string().optional()
  }).parse(req.body);
  const result = await saleBillService.offlinePayment({
    billNo: req.params.billNo, amount: body.amount,
    paymentMethod: body.paymentMethod, remark: body.remark,
    userId: req.user!.id ?? 0, username: req.user!.username ?? "系统用户",
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const paymentOnSaleBill = asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "OTHER_WECHAT", "ALIPAY"]),
    remark: z.string().optional()
  }).parse(req.body);
  const result = await saleBillService.paymentOnSaleBill({
    billNo: req.params.billNo, amount: body.amount,
    paymentMethod: body.paymentMethod, remark: body.remark,
    userId: req.user!.id ?? 0, username: req.user!.username ?? "系统用户",
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listOverdueBills = asyncHandler(async (req, res) => {
  const result = await saleBillService.listOverdueBills({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    storeId: req.user?.storeId ?? null,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const checkOverdueBills = asyncHandler(async (req, res) => {
  const result = await saleBillService.checkOverdueBills(req.user?.storeId ?? null, req.tenantId!);
  res.json(ok(result));
});