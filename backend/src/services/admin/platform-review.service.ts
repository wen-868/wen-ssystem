import { query, queryOne } from "../../shared/db";

/**
 * t_platform_review 评价行（别名对齐驼峰）
 *
 * 真实表结构（生产 information_schema 实测 2026-09-25，共 11 列）：
 *   id / platform / platform_review_id / order_no / rating / content /
 *   reply_content / replied_at / synced_at / created_at / updated_at
 *
 * 注意：本表是**平台级表**（既无 tenant_id，也无 platform_name / platform_no /
 * review_type / status / review_result / review_at）⇒ 不得对它做租户注入
 * （queryWithTenant / queryOneWithTenant），也不得引用上述不存在的列。
 * 同族判例：docs/踩坑日志.md [35]（平台级端点错挂租户鉴权/数据源）。
 */
interface PlatformReviewRow {
  id: number | string;
  platform: string;
  platformReviewId: string | null;
  orderNo: string;
  rating: number;
  content: string | null;
  replyContent: string | null;
  repliedAt: string | Date | null;
  syncedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** 真实表列清单（含别名）：所有 SELECT 共用一份，避免再次与表结构背离 */
const REVIEW_COLUMNS = [
  "id",
  "platform",
  "platform_review_id AS platformReviewId",
  "order_no AS orderNo",
  "rating",
  "content",
  "reply_content AS replyContent",
  "replied_at AS repliedAt",
  "synced_at AS syncedAt",
  "created_at AS createdAt",
  "updated_at AS updatedAt",
].join(", ");

export interface ReviewListParams {
  page: number;
  pageSize: number;
  /** 平台标识（真实列 platform，精确匹配） */
  platform?: string;
  /** 评分（真实列 rating） */
  rating?: number;
}

export async function listReviews(params: ReviewListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];

  if (params.platform) { conditions.push("platform = ?"); sqlParams.push(params.platform); }
  if (params.rating !== undefined) { conditions.push("rating = ?"); sqlParams.push(params.rating); }

  // 平台级表：无过滤条件时即全平台查询，不注入任何租户条件
  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_platform_review${whereClause}`,
    sqlParams
  );
  const total = totalRow?.total ?? 0;

  const records = await query<PlatformReviewRow>(
    `SELECT ${REVIEW_COLUMNS}
     FROM t_platform_review${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

/** 回复评价：真实表只有 reply_content + replied_at 两个回复载体 */
export async function replyReview(id: number, replyContent: string) {
  await query(
    "UPDATE t_platform_review SET reply_content = ?, replied_at = NOW(), updated_at = NOW() WHERE id = ?",
    [replyContent, id]
  );
  return { id };
}

/** 按平台分组的评价数统计（真实列 platform） */
export async function getStats() {
  const stats = await query<{ platform: string; cnt: number }>(
    `SELECT platform, COUNT(*) AS cnt
     FROM t_platform_review
     GROUP BY platform ORDER BY cnt DESC`
  );
  return { stats };
}

export async function getReviewById(id: number) {
  return queryOne<PlatformReviewRow>(
    `SELECT ${REVIEW_COLUMNS} FROM t_platform_review WHERE id = ?`,
    [id]
  );
}

// ========== 评价审核（无载体，不在此实现） ==========
// 真实表 t_platform_review 无 status / review_result / review_at 列 ⇒ 审核状态在数据模型上
// 没有载体。按本单红线"不得造列、不得造值、不得做提交即成功的假成功"，
// reviewApproval / batchReviewApproval 不写库，由控制器统一以 501 明确拒绝（见
// controllers/admin/platform-review.controller.ts）。
