import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export async function listReviews(params: {
  tenantId: string; storeId?: number; platform?: string;
  rating?: number; status?: string; page?: number; pageSize?: number;
}) {
  const { tenantId, storeId, platform, rating, status, page = 1, pageSize = 20 } = params;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (storeId) { conditions.push("EXISTS (SELECT 1 FROM retail_order ro WHERE ro.id = retail_review.order_id AND ro.store_id = ?)"); values.push(storeId); }
  if (platform) { conditions.push("platform = ?"); values.push(platform); }
  if (rating) { conditions.push("rating = ?"); values.push(rating); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM retail_review ${where}`, values, tenantId);
  const rows = await queryWithTenant<any>(
    `SELECT * FROM retail_review ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize], tenantId
  );
  return { list: rows, total: Number(total?.cnt ?? 0), page, pageSize };
}

export async function getReviewDetail(id: number, tenantId: string) {
  return queryOneWithTenant<any>("SELECT * FROM retail_review WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
}

export async function replyReview(id: number, reply: string, tenantId: string) {
  await queryWithTenant(
    "UPDATE retail_review SET reply = ?, reply_at = NOW() WHERE id = ? AND tenant_id = ?",
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
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM retail_review ${where}`, values, tenantId);
  const avgRating = await queryOneWithTenant<any>(`SELECT AVG(rating) AS avgRating FROM retail_review ${where}`, values, tenantId);
  const goodRating = await queryOneWithTenant<any>(`SELECT COUNT(*) AS cnt FROM retail_review ${where} AND rating >= 4`, values, tenantId);
  return {
    totalCount: Number(total?.cnt ?? 0),
    avgRating: Math.round(Number(avgRating?.avgRating ?? 0) * 10) / 10,
    goodRate: Number(total?.cnt ?? 0) > 0 ? Math.round((Number(goodRating?.cnt ?? 0) / Number(total.cnt)) * 10000) / 100 : 0,
  };
}