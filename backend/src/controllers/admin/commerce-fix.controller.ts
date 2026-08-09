import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as commerceFixService from "../../services/admin/commerce-fix.service";

const tenant = (req: any) => req.tenantId as string;
const num = (v: unknown) => (v === undefined ? undefined : Number(v));

/** 资金流水列表 */
export const listFundTransactions = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await commerceFixService.listFundTransactions(tenant(req), {
    page: num(q.page), pageSize: num(q.pageSize), transactionType: q.transactionType, dateStart: q.dateStart, dateEnd: q.dateEnd,
  });
  res.json(ok(result));
});

/** 资金统计 */
export const getFundStatistics = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await commerceFixService.getFundStatistics(tenant(req), { dateStart: q.dateStart, dateEnd: q.dateEnd });
  res.json(ok(result));
});

/** 提成统计 */
export const getCommissionStats = asyncHandler(async (req, res) => {
  const result = await commerceFixService.getCommissionStats(tenant(req));
  res.json(ok(result));
});

/** 后台收货地址列表 */
export const listConsumerAddresses = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await commerceFixService.listConsumerAddresses(tenant(req), {
    page: num(q.page), pageSize: num(q.pageSize), keyword: q.keyword,
  });
  res.json(ok(result));
});

/** 删除收货地址 */
export const deleteConsumerAddress = asyncHandler(async (req, res) => {
  const result = await commerceFixService.deleteConsumerAddress(tenant(req), Number(req.params.id));
  res.json(ok(result));
});

/** 票据列表 */
export const listBills = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await commerceFixService.listBills(tenant(req), {
    page: num(q.page), pageSize: num(q.pageSize), keyword: q.keyword, billType: q.billType,
    status: q.status, dateStart: q.dateStart, dateEnd: q.dateEnd,
  });
  res.json(ok(result));
});

/** 创建票据 */
export const createBill = asyncHandler(async (req, res) => {
  const body = z.object({
    billNo: z.string().optional(), billType: z.string(), amount: z.number(),
    issueDate: z.string().optional(), dueDate: z.string().optional(), remark: z.string().optional(),
  }).parse(req.body);
  const result = await commerceFixService.createBill(tenant(req), body);
  res.json(ok(result));
});

/** 更新票据 */
export const updateBill = asyncHandler(async (req, res) => {
  const body = z.object({
    billNo: z.string().optional(), billType: z.string().optional(), amount: z.number().optional(),
    issueDate: z.string().optional(), dueDate: z.string().optional(), remark: z.string().optional(),
  }).parse(req.body);
  const result = await commerceFixService.updateBill(tenant(req), Number(req.params.id), body);
  res.json(ok(result));
});

/** 删除票据 */
export const deleteBill = asyncHandler(async (req, res) => {
  const result = await commerceFixService.deleteBill(tenant(req), Number(req.params.id));
  res.json(ok(result));
});

/** 核销票据 */
export const verifyBill = asyncHandler(async (req, res) => {
  const result = await commerceFixService.verifyBill(tenant(req), Number(req.params.id));
  res.json(ok(result));
});

/** 作废票据 */
export const voidBill = asyncHandler(async (req, res) => {
  const result = await commerceFixService.voidBill(tenant(req), Number(req.params.id));
  res.json(ok(result));
});

/** 优惠券核销记录 */
export const listCouponVerifyRecords = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await commerceFixService.listCouponVerifyRecords(tenant(req), {
    page: num(q.page), pageSize: num(q.pageSize), status: q.status,
  });
  res.json(ok(result));
});
