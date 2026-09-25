import { z } from "zod";
import { ok, fail } from "../../shared/response";
import * as reviewService from "../../services/admin/platform-review.service";

/**
 * 审核列表（分页+筛选）
 *
 * t_platform_review 是平台级表（无 tenant_id），故不读 req.tenantId；
 * 入参以真实列为准：platform（平台标识）、rating（评分）。
 */
export async function listReviews(req: any, res: any) {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    platform: z.string().optional(),
    rating: z.coerce.number().optional(),
  }).parse(req.query);
  const result = await reviewService.listReviews(params);
  res.json(ok(result));
}

/** 审核统计 */
export async function getReviewStats(_req: any, res: any) {
  const result = await reviewService.getStats();
  res.json(ok(result));
}

/** 回复评价：写 reply_content + replied_at */
export async function replyReview(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { replyContent } = z.object({ replyContent: z.string().min(1) }).parse(req.body);
  const result = await reviewService.replyReview(id, replyContent);
  res.json(ok(result));
}

/**
 * 评价审核 / 批量审核：真实表 t_platform_review 无 status / review_result / review_at 列，
 * 审核状态没有载体 ⇒ 不造列、不造值，也不做"提交即成功"的假成功，统一 501 明确拒绝。
 * （前端 saas-admin 未调用这两个端点；能力若要落地需先立 DDL 单，本单红线禁止改表结构。）
 */
const REVIEW_APPROVAL_UNSUPPORTED_MSG =
  "真实表 t_platform_review 无审核状态字段（status/review_result），平台评价审核能力不可用";

/** 评价审核（无载体） */
export async function reviewApproval(_req: any, res: any) {
  res.status(501).json(fail(REVIEW_APPROVAL_UNSUPPORTED_MSG, "501"));
}

/** 批量审核（无载体） */
export async function batchReviewApproval(_req: any, res: any) {
  res.status(501).json(fail(REVIEW_APPROVAL_UNSUPPORTED_MSG, "501"));
}

/** 获取评价详情 */
export async function getReviewById(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await reviewService.getReviewById(id);
  res.json(ok(result));
}
