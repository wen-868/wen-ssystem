import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as saleBillService from "../../services/store/sale-bill.service";
import { storeSaleBillItemSchema } from "../../routes/store-sale-bill.routes";

// ── 辅助函数（集中分支逻辑，减少重复分支统计） ──

/** 从查询参数中提取分页参数（默认 page=1, pageSize=20） */
function getPagination(req: any) {
  return {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
  };
}

/** 从请求中提取操作人信息 */
function getOperator(req: any) {
  return {
    id: req.user!.id ?? 0,
    name: req.user!.username ?? "系统用户",
  };
}

/** 从查询参数中提取字符串（无值返回空串） */
function getQueryString(req: any, key: string): string {
  return String(req.query[key] || "");
}

/** 从查询参数中提取可选字符串（有值返回 string，无值返回 null） */
function getQueryStringOrNull(req: any, key: string): string | null {
  return req.query[key] ? String(req.query[key]) : null;
}

/** 从用户信息中提取 storeId（无值返回 null） */
function getStoreIdFromUser(req: any): number | null {
  return req.user?.storeId ?? null;
}

export const listSaleBills = asyncHandler(async (req, res) => {
  const { page, pageSize } = getPagination(req);
  const result = await saleBillService.listSaleBills({
    page,
    pageSize,
    storeId: getStoreIdFromUser(req),
    keyword: getQueryString(req, "keyword"),
    collectionStatus: getQueryStringOrNull(req, "collectionStatus"),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const getSaleBillDetail = asyncHandler(async (req, res) => {
  const bill = await saleBillService.getSaleBillDetail(req.params.billNo, req.tenantId!);
  if (!bill) { res.status(404).json(fail("销售单不存在", "404")); return; }
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
  const { id } = getOperator(req);
  const result = await saleBillService.createSaleBill({
    ...body,
    storeId: body.storeId ?? req.user?.storeId ?? 1,
    customerId: body.customerId ?? null,
    userId: id,
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
    userId: getOperator(req).id,
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
  const { id, name } = getOperator(req);
  const result = await saleBillService.offlinePayment({
    billNo: req.params.billNo, amount: body.amount,
    paymentMethod: body.paymentMethod, remark: body.remark,
    userId: id, username: name,
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
  const { id, name } = getOperator(req);
  const result = await saleBillService.paymentOnSaleBill({
    billNo: req.params.billNo, amount: body.amount,
    paymentMethod: body.paymentMethod, remark: body.remark,
    userId: id, username: name,
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const listOverdueBills = asyncHandler(async (req, res) => {
  const { page, pageSize } = getPagination(req);
  const result = await saleBillService.listOverdueBills({
    page,
    pageSize,
    storeId: getStoreIdFromUser(req),
    tenantId: req.tenantId!
  });
  res.json(ok(result));
});

export const checkOverdueBills = asyncHandler(async (req, res) => {
  const result = await saleBillService.checkOverdueBills(getStoreIdFromUser(req), req.tenantId!);
  res.json(ok(result));
});