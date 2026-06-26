import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as quotePushService from "../../services/admin/quote-push.service.js";

export const previewQuote = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    customerId: z.number().int().optional(),
    categoryId: z.number().int().optional(),
    brand: z.string().optional(),
    keyword: z.string().optional(),
    priceLevelId: z.number().int().optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    skuIds: z.array(z.number().int()).optional()
  }).parse(req.body);

  const result = await quotePushService.previewQuote(body, tenantId);
  res.json(ok(result));
});

export const createQuote = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const body = z.object({
    customerId: z.number().int().positive(),
    title: z.string().max(200),
    remark: z.string().max(500).optional(),
    validDays: z.number().int().min(1).max(365).default(7),
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      quotePrice: z.number().min(0),
      minQty: z.number().int().min(1).default(1)
    })).min(1)
  }).parse(req.body);

  const result = await quotePushService.createQuote(body, userId, tenantId);
  res.json(ok(result));
});

export const listQuotes = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
  const status = req.query.status as string | undefined;
  const keyword = req.query.keyword as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const result = await quotePushService.listQuotes(
    page,
    pageSize,
    tenantId,
    { customerId, status, keyword, startDate, endDate }
  );
  res.json(ok(result));
});

export const getQuoteDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const quoteId = Number(req.params.id);

  const result = await quotePushService.getQuoteDetail(quoteId, tenantId);
  if (!result) {
    res.status(404).json({ code: "404", message: "报价单不存在" });
    return;
  }
  res.json(ok(result));
});

export const pushQuote = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const quoteId = Number(req.params.id);
  const body = z.object({
    channels: z.array(z.enum(["sms", "miniapp", "email"])).min(1),
    notifyText: z.string().max(500).optional()
  }).parse(req.body);

  const result = await quotePushService.pushQuote(quoteId, body, tenantId);
  res.json(ok(result));
});

export const cancelQuote = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const quoteId = Number(req.params.id);

  const result = await quotePushService.cancelQuote(quoteId, tenantId);
  res.json(ok(result));
});

export const viewQuoteByToken = asyncHandler(async (req, res) => {
  const shareToken = req.params.token;

  const result = await quotePushService.viewQuoteByToken(shareToken);
  if (!result) {
    res.status(404).json({ code: "404", message: "报价单不存在或已过期" });
    return;
  }
  res.json(ok(result));
});
