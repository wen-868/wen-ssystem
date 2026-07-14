import { z } from "zod";
import { ok } from "../../shared/response";
import * as productReviewService from "../../services/admin/product-review.service";

/** 提交商品审核 */
export async function createProductReview(req: any, res: any) {
  const tenantId = req.tenantId!;
  const submitterId = req.user?.id;
  const submitterName = req.user?.name || req.user?.username;
  const data = z.object({
    productId: z.number().int().positive(),
    productName: z.string().min(1).max(200),
    reviewType: z.string().min(1).max(50),
    changeContent: z.any().optional(),
  }).parse(req.body);
  const result = await productReviewService.createProductReview(
    tenantId, data, submitterId, submitterName
  );
  res.json(ok(result));
}

/** 审核列表 */
export async function listProductReviews(req: any, res: any) {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
    status: z.string().optional(),
    reviewType: z.string().optional(),
    submitterId: z.coerce.number().int().optional(),
  }).parse(req.query);
  const result = await productReviewService.listProductReviews(tenantId, params);
  res.json(ok(result));
}

/** 审核详情 */
export async function getProductReview(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await productReviewService.getProductReview(tenantId, id);
  res.json(ok(result));
}

/** 审核通过 */
export async function approveProductReview(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const reviewerId = req.user?.id;
  const reviewerName = req.user?.name || req.user?.username;
  const data = z.object({
    reviewComment: z.string().optional(),
  }).parse(req.body || {});
  const result = await productReviewService.approveProductReview(tenantId, id, reviewerId, reviewerName, data);
  res.json(ok(result));
}

/** 审核驳回 */
export async function rejectProductReview(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const reviewerId = req.user?.id;
  const reviewerName = req.user?.name || req.user?.username;
  const data = z.object({
    reviewComment: z.string().min(1),
  }).parse(req.body);
  const result = await productReviewService.rejectProductReview(tenantId, id, reviewerId, reviewerName, data);
  res.json(ok(result));
}

/** 批量审核通过 */
export async function batchApproveProductReviews(req: any, res: any) {
  const tenantId = req.tenantId!;
  const reviewerId = req.user?.id;
  const reviewerName = req.user?.name || req.user?.username;
  const data = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(100),
    reviewComment: z.string().optional(),
  }).parse(req.body);
  const result = await productReviewService.batchApproveProductReviews(
    tenantId, data.ids, reviewerId, reviewerName, data.reviewComment
  );
  res.json(ok(result));
}
