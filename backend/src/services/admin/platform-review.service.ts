import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export interface ReviewListParams {
  page: number;
  pageSize: number;
  platformName?: string;
  reviewType?: number;
  status?: number;
}

export async function listReviews(tenantId: string, params: ReviewListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.platformName) { conditions.push("platform_name LIKE ?"); sqlParams.push(`%${params.platformName}%`); }
  if (params.reviewType !== undefined) { conditions.push("review_type = ?"); sqlParams.push(params.reviewType); }
  if (params.status !== undefined) { conditions.push("status = ?"); sqlParams.push(params.status); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM platform_review ${where}`, sqlParams, tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<any>(
    `SELECT id, platform_no AS platformNo, platform_name AS platformName,
            review_type AS reviewType, status, review_result AS reviewResult,
            review_at AS reviewAt, created_at AS createdAt, updated_at AS updatedAt
     FROM platform_review ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function replyReview(tenantId: string, id: number, replyContent: string) {
  await queryWithTenant(
    "UPDATE platform_review SET review_result = CONCAT(IFNULL(review_result, ''), ?), review_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [`\n[回复] ${replyContent}`, id, tenantId],
    tenantId
  );
  return { id };
}

export async function getStats(tenantId: string) {
  const stats = await queryWithTenant<{ platformName: string; cnt: number }>(
    `SELECT platform_name AS platformName, COUNT(*) AS cnt
     FROM platform_review WHERE tenant_id = ?
     GROUP BY platform_name ORDER BY cnt DESC`,
    [tenantId],
    tenantId
  );
  return { stats };
}

// ========== 评价审核 ==========
export async function reviewApproval(tenantId: string, id: number, status: number, reviewResult?: string) {
  const updates: string[] = [];
  const params: unknown[] = [];

  updates.push("status = ?");
  params.push(status);

  if (reviewResult) {
    updates.push("review_result = ?");
    params.push(reviewResult);
  }

  updates.push("review_at = NOW()");
  updates.push("updated_at = NOW()");

  params.push(id);
  params.push(tenantId);

  await queryWithTenant(
    `UPDATE platform_review SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
    params,
    tenantId
  );

  return { id, status };
}

export async function batchReviewApproval(tenantId: string, ids: number[], status: number) {
  const placeholders = ids.map(() => "?").join(",");
  await queryWithTenant(
    `UPDATE platform_review SET status = ?, review_at = NOW(), updated_at = NOW() 
     WHERE id IN (${placeholders}) AND tenant_id = ?`,
    [status, ...ids, tenantId],
    tenantId
  );

  return { success: true, count: ids.length };
}

export async function getReviewById(tenantId: string, id: number) {
  return queryOneWithTenant<any>(
    `SELECT id, platform_no AS platformNo, platform_name AS platformName,
            review_type AS reviewType, status, review_result AS reviewResult,
            review_at AS reviewAt, created_at AS createdAt, updated_at AS updatedAt
     FROM platform_review WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
    tenantId
  );
}