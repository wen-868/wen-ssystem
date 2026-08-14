/**
 * 商品营销标签字典服务
 *
 * 管理商品营销标签（新品/爆款/推荐/限量/清仓），
 * 区别于商品属性标签（product_tag：香型/产区/场景/年份）
 * 商品 product_spu.marketing_tags JSON 字段引用此处定义的 tag_code
 */
import { query, queryOne } from "../../shared/db";

export interface ProductMarketingTag {
  id: number;
  tagCode: string;
  tagName: string;
  color: string;
  sortNo: number;
  status: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 标签ID行（用于存在性校验） */
interface TagIdRow {
  id: number;
}

/** 标签租户行（用于权限校验） */
interface TagTenantRow {
  id: number;
  tenantId: string;
}

/**
 * 标签列表（包含平台通用标签 + 当前租户自定义标签）
 */
export async function listTags(tenantId: string, status?: number) {
  const conditions: string[] = ["(tenant_id = ? OR tenant_id = '')"];
  const params: unknown[] = [tenantId];

  if (status !== undefined) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.join(" AND ");

  const records = await query<ProductMarketingTag>(
    `SELECT id, tag_code AS tagCode, tag_name AS tagName, color,
            sort_no AS sortNo, status, tenant_id AS tenantId,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_product_marketing_tag
     WHERE ${where}
     ORDER BY sort_no ASC, id ASC`,
    params
  );

  return { total: records.length, records };
}

/**
 * 创建标签（租户自定义）
 */
export async function createTag(body: {
  tagCode: string;
  tagName: string;
  color?: string;
  sortNo?: number;
  tenantId: string;
}) {
  // 校验同一租户下编码唯一（含通用标签）
  const existing = await queryOne<TagIdRow>(
    "SELECT id FROM t_product_marketing_tag WHERE tag_code = ? AND (tenant_id = ? OR tenant_id = '')",
    [body.tagCode, body.tenantId]
  );
  if (existing) {
    throw Object.assign(new Error("标签编码已存在"), { statusCode: 400 });
  }

  await query(
    `INSERT INTO t_product_marketing_tag (tag_code, tag_name, color, sort_no, status, tenant_id)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [
      body.tagCode,
      body.tagName,
      body.color || "#409EFF",
      body.sortNo ?? 0,
      body.tenantId
    ]
  );

  const record = await queryOne<ProductMarketingTag>(
    `SELECT id, tag_code AS tagCode, tag_name AS tagName, color,
            sort_no AS sortNo, status, tenant_id AS tenantId,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_product_marketing_tag
     WHERE tag_code = ? AND tenant_id = ?`,
    [body.tagCode, body.tenantId]
  );

  return record;
}

/**
 * 更新标签（仅可更新当前租户自定义标签）
 */
export async function updateTag(id: number, body: {
  tagName?: string;
  color?: string;
  sortNo?: number;
  status?: number;
}, tenantId: string) {
  const existing = await queryOne<TagTenantRow>(
    "SELECT id, tenant_id AS tenantId FROM t_product_marketing_tag WHERE id = ?",
    [id]
  );
  if (!existing) {
    return null;
  }
  // 平台通用标签（tenant_id 为空）不允许租户修改
  if (existing.tenantId === "" || existing.tenantId === null) {
    if (existing.tenantId !== tenantId) {
      throw Object.assign(new Error("平台通用标签不可修改"), { statusCode: 403 });
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.tagName !== undefined) { updates.push("tag_name = ?"); params.push(body.tagName); }
  if (body.color !== undefined) { updates.push("color = ?"); params.push(body.color); }
  if (body.sortNo !== undefined) { updates.push("sort_no = ?"); params.push(body.sortNo); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    params.push(id);
    await query(
      `UPDATE t_product_marketing_tag SET ${updates.join(", ")} WHERE id = ?`,
      params
    );
  }

  const record = await queryOne<ProductMarketingTag>(
    `SELECT id, tag_code AS tagCode, tag_name AS tagName, color,
            sort_no AS sortNo, status, tenant_id AS tenantId,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_product_marketing_tag WHERE id = ?`,
    [id]
  );
  return record;
}

/**
 * 删除标签（仅可删除当前租户自定义标签）
 */
export async function deleteTag(id: number, tenantId: string) {
  const existing = await queryOne<TagTenantRow>(
    "SELECT id, tenant_id AS tenantId FROM t_product_marketing_tag WHERE id = ?",
    [id]
  );
  if (!existing) {
    return null;
  }
  // 平台通用标签不允许删除
  if ((existing.tenantId === "" || existing.tenantId === null) && existing.tenantId !== tenantId) {
    throw Object.assign(new Error("平台通用标签不可删除"), { statusCode: 403 });
  }

  await query("DELETE FROM t_product_marketing_tag WHERE id = ?", [id]);
  return { id, deleted: true };
}