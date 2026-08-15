import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as couponService from "../../services/admin/marketing-new-coupon.service";
import * as promotionService from "../../services/admin/marketing-new-promotion.service";

export const listCouponTemplates = asyncHandler(async (req, res) => {
  const { status, type, keyword, page = 1, pageSize = 20 } = req.query;

  const result = await couponService.listCouponTemplates(
    Number(page),
    Number(pageSize),
    req.tenantId!,
    status as string | undefined,
    type as string | undefined,
    keyword as string | undefined
  );

  res.json(ok(result));
});

export const getCouponTemplate = asyncHandler(async (req, res) => {
  const templateId = Number(req.params.templateId);
  const result = await couponService.getCouponTemplate(templateId, req.tenantId!);
  res.json(ok(result));
});

export const createCouponTemplate = asyncHandler(async (req, res) => {
  const body = z.object({
    templateName: z.string().min(1).max(128),
    couponType: z.enum(["AMOUNT", "DISCOUNT", "GIFT"]),
    couponValue: z.number().min(0),
    minPurchase: z.number().min(0).default(0),
    maxDiscount: z.number().min(0).optional(),
    applicableScope: z.enum(["ALL", "CATEGORY", "PRODUCT", "STORE"]).default("ALL"),
    applicableIds: z.any().optional(),
    totalQuantity: z.number().int().min(0).default(0),
    perLimit: z.number().int().min(1).default(1),
    validType: z.enum(["FIXED", "DAYS"]),
    validStart: z.string().optional(),
    validEnd: z.string().optional(),
    validDays: z.number().int().min(1).optional(),
    description: z.string().max(500).optional(),
  }).parse(req.body);

  const result = await couponService.createCouponTemplate(
    body,
    req.tenantId!,
    req.user!.id,
    req.user!.username
  );

  res.json(ok(result));
});

export const updateCouponTemplate = asyncHandler(async (req, res) => {
  const templateId = Number(req.params.templateId);
  const body = z.object({
    templateName: z.string().min(1).max(128).optional(),
    couponValue: z.number().min(0).optional(),
    minPurchase: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).optional(),
    applicableScope: z.enum(["ALL", "CATEGORY", "PRODUCT", "STORE"]).optional(),
    applicableIds: z.any().optional(),
    totalQuantity: z.number().int().min(0).optional(),
    perLimit: z.number().int().min(1).optional(),
    validType: z.enum(["FIXED", "DAYS"]).optional(),
    validStart: z.string().optional(),
    validEnd: z.string().optional(),
    validDays: z.number().int().min(1).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  }).parse(req.body);

  const result = await couponService.updateCouponTemplate(
    templateId,
    body,
    req.tenantId!,
    req.user!.id,
    req.user!.username
  );

  res.json(ok(result));
});

export const issueCoupons = asyncHandler(async (req, res) => {
  const templateId = Number(req.params.templateId);
  const body = z.object({
    userIds: z.array(z.number().int().positive()).min(1),
  }).parse(req.body);

  const result = await couponService.issueCoupons(
    templateId,
    body.userIds,
    req.tenantId!,
    req.user!.id,
    req.user!.username
  );

  res.json(ok(result));
});

export const listUserCoupons = asyncHandler(async (req, res) => {
  const { userId, status, page = 1, pageSize = 20 } = req.query;

  const result = await couponService.listUserCoupons(
    Number(page),
    Number(pageSize),
    req.tenantId!,
    userId ? Number(userId) : undefined,
    status as string | undefined
  );

  res.json(ok(result));
});

export const deleteCouponTemplate = asyncHandler(async (req, res) => {
  const templateId = Number(req.params.templateId);
  res.json(ok(await couponService.deleteCouponTemplate(templateId, req.tenantId!)));
});

export const activateCouponTemplate = asyncHandler(async (req, res) => {
  const templateId = Number(req.params.templateId);
  res.json(ok(await couponService.activateCouponTemplate(templateId, req.tenantId!)));
});

export const pauseCouponTemplate = asyncHandler(async (req, res) => {
  const templateId = Number(req.params.templateId);
  res.json(ok(await couponService.pauseCouponTemplate(templateId, req.tenantId!)));
});

export const getCouponStatistics = asyncHandler(async (req, res) => {
  res.json(ok(await couponService.getCouponStatistics(req.tenantId!)));
});

export const listPromotions = asyncHandler(async (req, res) => {
  const { type, status, page = 1, pageSize = 20 } = req.query;

  const result = await promotionService.listPromotions(
    Number(page),
    Number(pageSize),
    req.tenantId!,
    type as string | undefined,
    status as string | undefined
  );

  res.json(ok(result));
});

export const createPromotion = asyncHandler(async (req, res) => {
  const body = z.object({
    activityName: z.string().min(1).max(128),
    activityType: z.enum(["FULL_REDUCTION", "SECKILL", "GROUP_BUY", "GIFT"]),
    activityDesc: z.string().max(500).optional(),
    startTime: z.string(),
    endTime: z.string(),
    applicableScope: z.enum(["ALL", "CATEGORY", "PRODUCT", "STORE"]).default("ALL"),
    applicableIds: z.any().optional(),
    rules: z.any(),
    maxParticipants: z.number().int().min(0).default(0),
    priority: z.number().int().default(0),
    stackable: z.number().int().min(0).max(1).default(0),
  }).parse(req.body);

  const result = await promotionService.createPromotion(
    body as any,
    req.tenantId!,
    req.user!.id,
    req.user!.username
  );

  res.json(ok(result));
});

export const updatePromotion = asyncHandler(async (req, res) => {
  const activityId = Number(req.params.activityId);
  const body = z.object({
    activityName: z.string().min(1).max(128).optional(),
    activityDesc: z.string().max(500).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    applicableScope: z.enum(["ALL", "CATEGORY", "PRODUCT", "STORE"]).optional(),
    applicableIds: z.any().optional(),
    rules: z.any().optional(),
    maxParticipants: z.number().int().min(0).optional(),
    priority: z.number().int().optional(),
    stackable: z.number().int().min(0).max(1).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).optional(),
  }).parse(req.body);

  const result = await promotionService.updatePromotion(
    activityId,
    body,
    req.tenantId!,
    req.user!.id,
    req.user!.username
  );

  res.json(ok(result));
});

export const calculateDiscount = asyncHandler(async (req, res) => {
  const body = z.object({
    userId: z.number().int().positive(),
    orderAmount: z.number().min(0),
    productIds: z.array(z.number().int().positive()),
    couponNo: z.string().optional(),
  }).parse(req.body);

  const result = await promotionService.calculateDiscount(body, req.tenantId!);
  res.json(ok(result));
});
