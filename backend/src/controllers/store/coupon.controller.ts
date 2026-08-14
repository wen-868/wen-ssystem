import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { listCouponTemplates, getCouponTemplate } from "../../services/admin/marketing-coupon.service";
import * as couponVerifyService from "../../services/store/coupon-verify.service";
import { z } from "zod";

/** 门店优惠券列表（分页，复用优惠券模板数据源） */
export const listStoreCoupons = asyncHandler(async (req, res) => {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.string().optional(),
    keyword: z.string().optional(),
  }).parse(req.query);
  const result = await listCouponTemplates(
    params.page,
    params.pageSize,
    req.tenantId!,
    params.status,
    undefined,
    params.keyword
  );
  res.json(ok(result));
});

/** 门店优惠券详情 */
export const getStoreCoupon = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json(ok(await getCouponTemplate(id, req.tenantId!)));
});

/** 按券码核销优惠券（扫码/顾客出示券码） */
export const verifyCoupon = asyncHandler(async (req, res) => {
  const body = z.object({
    code: z.string().trim().min(1),
    orderNo: z.string().trim().optional(),
    orderAmount: z.coerce.number().min(0).optional(),
  }).parse(req.body);
  const result = await couponVerifyService.verifyCouponByCode({
    tenantId: req.tenantId!,
    code: body.code,
    orderNo: body.orderNo,
    orderAmount: body.orderAmount,
    operatorId: req.user?.id,
    operatorName: req.user?.realName ?? req.user?.username,
  });
  res.json(ok(result));
});

/** 手动核销优惠券（顾客报手机号/券码） */
export const manualVerifyCoupon = asyncHandler(async (req, res) => {
  const body = z.object({
    couponCode: z.string().trim().min(1),
    mobile: z.string().trim().optional(),
    saleBillNo: z.string().trim().optional(),
    orderAmount: z.coerce.number().min(0).optional(),
  }).parse(req.body);
  const result = await couponVerifyService.manualVerifyCoupon({
    tenantId: req.tenantId!,
    couponCode: body.couponCode,
    mobile: body.mobile,
    saleBillNo: body.saleBillNo,
    orderAmount: body.orderAmount,
    operatorId: req.user?.id,
    operatorName: req.user?.realName ?? req.user?.username,
  });
  res.json(ok(result));
});
