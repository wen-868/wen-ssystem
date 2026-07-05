import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as reviewService from "../services/admin/platform-review.service.js";

export const platformReviewRouter = Router();

// ========== 审核列表（分页+筛选） ==========
platformReviewRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    platformName: z.string().optional(),
    reviewType: z.coerce.number().optional(),
    status: z.coerce.number().optional(),
  }).parse(req.query);
  const result = await reviewService.listReviews(tenantId, params);
  res.json(ok(result));
}));

// ========== 审核统计 ==========
platformReviewRouter.get("/stats", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await reviewService.getStats(tenantId);
  res.json(ok(result));
}));

// ========== 回复审核 ==========
platformReviewRouter.post("/:id/reply", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { replyContent } = z.object({ replyContent: z.string().min(1) }).parse(req.body);
  const result = await reviewService.replyReview(tenantId, id, replyContent);
  res.json(ok(result));
}));