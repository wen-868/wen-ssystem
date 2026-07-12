import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as couponService from "../../services/admin/marketing-coupon.service";

export const createCouponTemplate = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128),
    type: z.enum(["FIXED", "PERCENT", "SHIPPING", "FREE_GIFT"]),
    value: z.number().min(0),
    minAmount: z.number().min(0).default(0),
    maxDiscount: z.number().min(0).nullable().default(null),
    applicableScope: z.enum(["ALL", "CATEGORY", "BRAND", "SKU"]).default("ALL"),
    applicableIds: z.array(z.number().int()).nullable().default(null),
    totalCount: z.number().int().min(0).default(0),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    description: z.string().max(512).default("")
  }).parse(req.body);

  const result = await couponService.createCouponTemplate(body, req.tenantId!);
  res.json(ok(result));
});

export const listCouponTemplates = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;
  const type = req.query.type as string | undefined;
  const keyword = req.query.keyword as string | undefined;

  const result = await couponService.listCouponTemplates(page, pageSize, req.tenantId!, status, type, keyword);
  res.json(ok(result));
});

export const getCouponTemplate = asyncHandler(async (req, res) => {
  const result = await couponService.getCouponTemplate(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const updateCouponTemplate = asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(128).optional(),
    type: z.enum(["FIXED", "PERCENT", "SHIPPING", "FREE_GIFT"]).optional(),
    value: z.number().min(0).optional(),
    minAmount: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).nullable().optional(),
    applicableScope: z.enum(["ALL", "CATEGORY", "BRAND", "SKU"]).optional(),
    applicableIds: z.array(z.number().int()).nullable().optional(),
    totalCount: z.number().int().min(0).optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().min(1).optional(),
    description: z.string().max(512).optional()
  }).parse(req.body);

  const result = await couponService.updateCouponTemplate(Number(req.params.id), body, req.tenantId!);
  res.json(ok(result));
});

export const deleteCouponTemplate = asyncHandler(async (req, res) => {
  const result = await couponService.deleteCouponTemplate(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const activateCouponTemplate = asyncHandler(async (req, res) => {
  const result = await couponService.activateCouponTemplate(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const pauseCouponTemplate = asyncHandler(async (req, res) => {
  const result = await couponService.pauseCouponTemplate(Number(req.params.id), req.tenantId!);
  res.json(ok(result));
});

export const listUserCoupons = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const templateId = req.query.templateId ? Number(req.query.templateId) : undefined;

  const result = await couponService.listUserCoupons(page, pageSize, req.tenantId!, status, userId, templateId);
  res.json(ok(result));
});

export const getCouponStatistics = asyncHandler(async (req, res) => {
  const result = await couponService.getCouponStatistics(req.tenantId!);
  res.json(ok(result));
});

export const listAvailableCoupons = asyncHandler(async (req, res) => {
  const result = await couponService.listAvailableCoupons(req.tenantId!);
  res.json(ok(result));
});

export const claimCoupon = asyncHandler(async (req, res) => {
  const templateId = Number(req.params.templateId);
  const userId = Number(req.user?.id || req.body.userId || req.query.userId || 0);
  if (!userId) {
    res.status(400).json(fail("缺少用户ID", "400"));
    return;
  }
  const result = await couponService.claimCoupon(templateId, userId, req.tenantId!);
  res.json(ok(result));
});

export const listMyCoupons = asyncHandler(async (req, res) => {
  const userId = Number(req.user?.id || req.query.userId || 0);
  if (!userId) {
    res.status(400).json(fail("缺少用户ID", "400"));
    return;
  }
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;

  const result = await couponService.listMyCoupons(userId, page, pageSize, req.tenantId!, status);
  res.json(ok(result));
});
