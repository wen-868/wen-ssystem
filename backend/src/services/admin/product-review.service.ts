import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";

export interface ProductReviewListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  reviewType?: string;
  submitterId?: number;
}

export interface ProductReviewCreateData {
  productId: number;
  productName: string;
  reviewType: string;
  changeContent?: unknown;
}

export interface ProductReviewApproveData {
  reviewComment?: string;
}

export interface ProductReviewRejectData {
  reviewComment: string;
}

/** 生成审核单号 */
function generateReviewNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `PR${dateStr}${random}`;
}

/** 审核列表 */
export async function listProductReviews(tenantId: string, params: ProductReviewListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.keyword) {
    conditions.push("(product_name LIKE ? OR review_no LIKE ?)");
    sqlParams.push(`%${params.keyword}%`, `%${params.keyword}%`);
  }
  if (params.status) {
    conditions.push("status = ?");
    sqlParams.push(params.status);
  }
  if (params.reviewType) {
    conditions.push("review_type = ?");
    sqlParams.push(params.reviewType);
  }
  if (params.submitterId) {
    conditions.push("submitter_id = ?");
    sqlParams.push(params.submitterId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_product_review ${where}`,
    sqlParams,
    tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<Record<string, unknown>>(
    `SELECT id, review_no AS reviewNo, product_id AS productId, product_name AS productName,
            submitter_id AS submitterId, submitter_name AS submitterName,
            review_type AS reviewType, change_content AS changeContent,
            status, reviewer_id AS reviewerId, reviewer_name AS reviewerName,
            review_comment AS reviewComment, reviewed_at AS reviewedAt,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_product_review ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

/** 审核详情 */
export async function getProductReview(tenantId: string, id: number) {
  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT id, review_no AS reviewNo, product_id AS productId, product_name AS productName,
            submitter_id AS submitterId, submitter_name AS submitterName,
            review_type AS reviewType, change_content AS changeContent,
            status, reviewer_id AS reviewerId, reviewer_name AS reviewerName,
            review_comment AS reviewComment, reviewed_at AS reviewedAt,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_product_review
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
  if (!record) {
    throw Object.assign(new Error("审核记录不存在"), { statusCode: 404 });
  }
  return record;
}

/** 提交商品审核 */
export async function createProductReview(
  tenantId: string,
  data: ProductReviewCreateData,
  submitterId: number,
  submitterName?: string
) {
  const reviewNo = generateReviewNo();
  const result = await queryWithTenant<Record<string, unknown>>(
    `INSERT INTO t_product_review (tenant_id, review_no, product_id, product_name, submitter_id, submitter_name, review_type, change_content, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      tenantId,
      reviewNo,
      data.productId,
      data.productName,
      submitterId,
      submitterName || null,
      data.reviewType,
      data.changeContent ? JSON.stringify(data.changeContent) : null,
    ],
    tenantId
  );
  const insertId = (result as unknown as Record<string, unknown>).insertId as number;
  return { id: insertId, reviewNo };
}

/** 审核通过 */
export async function approveProductReview(
  tenantId: string,
  id: number,
  reviewerId: number,
  reviewerName?: string,
  data?: ProductReviewApproveData
) {
  const existing = await queryOneWithTenant<{ id: number; status: string }>(
    "SELECT id, status FROM t_product_review WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("审核记录不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PENDING") {
    throw Object.assign(new Error("仅待审核状态的记录可审核"), { statusCode: 400 });
  }

  await queryWithTenant(
    `UPDATE t_product_review
     SET status = 'APPROVED', reviewer_id = ?, reviewer_name = ?, review_comment = ?, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [reviewerId, reviewerName || null, data?.reviewComment || null, id, tenantId],
    tenantId
  );
  return { id, status: "APPROVED" };
}

/** 审核驳回 */
export async function rejectProductReview(
  tenantId: string,
  id: number,
  reviewerId: number,
  reviewerName: string,
  data: ProductReviewRejectData
) {
  const existing = await queryOneWithTenant<{ id: number; status: string }>(
    "SELECT id, status FROM t_product_review WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("审核记录不存在"), { statusCode: 404 });
  }
  if (existing.status !== "PENDING") {
    throw Object.assign(new Error("仅待审核状态的记录可审核"), { statusCode: 400 });
  }
  if (!data.reviewComment || !data.reviewComment.trim()) {
    throw Object.assign(new Error("驳回原因不能为空"), { statusCode: 400 });
  }

  await queryWithTenant(
    `UPDATE t_product_review
     SET status = 'REJECTED', reviewer_id = ?, reviewer_name = ?, review_comment = ?, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [reviewerId, reviewerName || null, data.reviewComment, id, tenantId],
    tenantId
  );
  return { id, status: "REJECTED" };
}

/** 批量审核通过 */
export async function batchApproveProductReviews(
  tenantId: string,
  ids: number[],
  reviewerId: number,
  reviewerName?: string,
  reviewComment?: string
) {
  if (!ids || ids.length === 0) {
    throw Object.assign(new Error("审核ID列表不能为空"), { statusCode: 400 });
  }
  if (ids.length > 100) {
    throw Object.assign(new Error("批量审核不能超过100条"), { statusCode: 400 });
  }

  const placeholders = ids.map(() => "?").join(", ");
  const sqlParams: unknown[] = [reviewerId, reviewerName || null, reviewComment || null, ...ids, tenantId];

  const result = await queryWithTenant<Record<string, unknown>>(
    `UPDATE t_product_review
     SET status = 'APPROVED', reviewer_id = ?, reviewer_name = ?, review_comment = ?, reviewed_at = NOW(), updated_at = NOW()
     WHERE id IN (${placeholders}) AND tenant_id = ? AND status = 'PENDING'`,
    sqlParams,
    tenantId
  );

  const affectedRows = (result as unknown as Record<string, unknown>).affectedRows as number;
  return { successCount: affectedRows || 0, totalCount: ids.length };
}
