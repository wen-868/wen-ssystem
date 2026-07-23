import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

/** t_retail_review 全字段行 */
interface RetailReviewRow {
  id: number; order_id: number; user_id: number; product_id: number | null;
  platform: string | null; platform_review_id: string | null;
  rating: number | string; review_content: string | null;
  review_images: string | null; review_tags: string | null;
  reply: string | null; reply_at: string | Date | null;
  is_anonymous: number; status: string; tenant_id: string;
  created_at: string | Date; updated_at: string | Date;
}

/** COUNT(*) AS cnt 聚合行 */
interface CountCntRow {
  cnt: number;
}

/** AVG(rating) AS avgRating 聚合行 */
interface ReviewAvgRatingRow {
  avgRating: number | string | null;
}

export async function listReviews(params: {
  tenantId: string; storeId?: number; platform?: string;
  rating?: number; status?: string; page?: number; pageSize?: number;
}) {
  const { tenantId, storeId, platform, rating, status, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("EXISTS (SELECT 1 FROM t_retail_order ro WHERE ro.id = retail_review.order_id AND ro.store_id = ?)"); values.push(storeId); }
  if (platform) { conditions.push("platform = ?"); values.push(platform); }
  if (rating) { conditions.push("rating = ?"); values.push(rating); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_retail_review ${where}`, values, tenantId);
  const rows = await queryWithTenant<RetailReviewRow>(
    `SELECT * FROM t_retail_review ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getReviewDetail(id: number, tenantId: string) {
  return queryOneWithTenant<RetailReviewRow>("SELECT * FROM t_retail_review WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function replyReview(id: number, reply: string, tenantId: string) {
  await queryWithTenant(
    "UPDATE t_retail_review SET reply = ?, reply_at = NOW() WHERE id = ? AND tenant_id = ?",
    [reply, id, tenantId], tenantId
  );
  return { id, replied: true };
}

export async function syncReviewsFromPlatform(platform: string, storeId: number, tenantId: string): Promise<number> {
  return 0;
}

export async function getReviewStats(params: { tenantId: string; storeId?: number; platform?: string }) {
  const { tenantId, storeId, platform } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (platform) { conditions.push("platform = ?"); values.push(platform); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_retail_review ${where}`, values, tenantId);
  const avgRating = await queryOneWithTenant<ReviewAvgRatingRow>(`SELECT AVG(rating) AS avgRating FROM t_retail_review ${where}`, values, tenantId);
  const goodRating = await queryOneWithTenant<CountCntRow>(`SELECT COUNT(*) AS cnt FROM t_retail_review ${where} AND rating >= 4`, values, tenantId);
  return {
    totalCount: Number(total?.cnt ?? 0),
    avgRating: Math.round(Number(avgRating?.avgRating ?? 0) * 10) / 10,
    goodRate: Number(total?.cnt ?? 0) > 0 ? Math.round((Number(goodRating?.cnt ?? 0) / Number(total?.cnt ?? 0)) * 10000) / 100 : 0,
  };
}