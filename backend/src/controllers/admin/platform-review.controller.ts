import { z } from "zod";
import { ok } from "../../shared/response";
import * as reviewService from "../../services/admin/platform-review.service";

/** 审核列表（分页+筛选） */
export async function listReviews(req: any, res: any) {
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
}

/** 审核统计 */
export async function getReviewStats(req: any, res: any) {
  const tenantId = req.tenantId!;
  const result = await reviewService.getStats(tenantId);
  res.json(ok(result));
}

/** 回复审核 */
export async function replyReview(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { replyContent } = z.object({ replyContent: z.string().min(1) }).parse(req.body);
  const result = await reviewService.replyReview(tenantId, id, replyContent);
  res.json(ok(result));
}
