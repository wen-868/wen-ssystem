import { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as svc from "../../services/instant-retail/review.service.js";

export const listReviews = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, platform, rating, status, storeId } = req.query as any;
  const result = await svc.listReviews({
    tenantId: req.tenantId!,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
    platform, rating: rating ? Number(rating) : undefined, status,
    storeId: storeId ? Number(storeId) : undefined,
  });
  res.json(ok(result));
});

export const getReviewDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.getReviewDetail(Number(req.params.id), req.tenantId!);
  if (!result) { res.status(404).json({ code: "404", message: "评价不存在" }); return; }
  res.json(ok(result));
});

export const replyReview = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.replyReview(Number(req.params.id), req.body.reply, req.tenantId!);
  res.json(ok(result));
});

export const syncReviews = asyncHandler(async (req: Request, res: Response) => {
  const { platform, storeId } = req.body;
  const count = await svc.syncReviewsFromPlatform(platform, Number(storeId), req.tenantId!);
  res.json(ok({ platform, synced: count }));
});

export const getReviewStats = asyncHandler(async (req: Request, res: Response) => {
  const { platform, storeId } = req.query as any;
  const result = await svc.getReviewStats({ tenantId: req.tenantId!, platform, storeId: storeId ? Number(storeId) : undefined });
  res.json(ok(result));
});