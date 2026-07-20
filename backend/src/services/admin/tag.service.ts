import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";

// ==================== 标签组管理 ====================

interface TagGroupRow {
  id: number; name: string; code: string; sort_no: number;
  is_multiple: number; status: number;
}

export async function listGroups(tenantId: string) {
  return queryWithTenant<TagGroupRow>(
    "SELECT id, name, code, sort_no, is_multiple, status, created_at, updated_at FROM t_product_tag_group ORDER BY sort_no ASC, id ASC",
    [], tenantId
  );
}

export async function createGroup(body: {
  name: string; code: string; sortNo?: number; isMultiple?: boolean;
}, tenantId: string) {
  const result = await queryWithTenant<{ insertId: number }>(
    `INSERT INTO t_product_tag_group (name, code, sort_no, is_multiple) VALUES (?, ?, ?, ?)`,
    [body.name, body.code, body.sortNo ?? 0, body.isMultiple !== false ? 1 : 0],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateGroup(id: number, body: {
  name?: string; code?: string; sortNo?: number; isMultiple?: boolean;
}, tenantId: string) {
  const existing = await queryOneWithTenant<TagGroupRow>(
    "SELECT id FROM t_product_tag_group WHERE id = ?", [id], tenantId
  );
  if (!existing) throw Object.assign(new Error("标签组不存在"), { statusCode: 404 });

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.code !== undefined) { sets.push("code = ?"); params.push(body.code); }
  if (body.sortNo !== undefined) { sets.push("sort_no = ?"); params.push(body.sortNo); }
  if (body.isMultiple !== undefined) { sets.push("is_multiple = ?"); params.push(body.isMultiple ? 1 : 0); }
  if (sets.length === 0) return { id };

  params.push(id);
  await queryWithTenant(
    `UPDATE t_product_tag_group SET ${sets.join(", ")} WHERE id = ?`,
    params, tenantId
  );
  return { id };
}

export async function deleteGroup(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<TagGroupRow>(
    "SELECT id FROM t_product_tag_group WHERE id = ?", [id], tenantId
  );
  if (!existing) throw Object.assign(new Error("标签组不存在"), { statusCode: 404 });

  // 检查是否有标签引用
  const tagRows = (await queryWithTenant<any>(
    "SELECT COUNT(*) AS cnt FROM t_product_tag WHERE group_id = ?", [id], tenantId
  ) as any[])[0];
  if ((tagRows as any)?.[0]?.cnt > 0) {
    throw Object.assign(new Error("该标签组下有标签，无法删除"), { statusCode: 400 });
  }

  await queryWithTenant("DELETE FROM t_product_tag_group WHERE id = ?", [id], tenantId);
  return { id };
}

// ==================== 标签值管理 ====================

interface TagRow {
  id: number; group_id: number; name: string; sort_no: number; status: number;
}

export async function listTags(groupId: number | undefined, tenantId: string) {
  let sql = "SELECT id, group_id, name, sort_no, status, created_at FROM t_product_tag WHERE 1=1";
  const params: unknown[] = [];

  if (groupId !== undefined) {
    sql += " AND group_id = ?";
    params.push(groupId);
  }
  sql += " ORDER BY sort_no ASC, id ASC";

  return queryWithTenant<TagRow>(sql, params, tenantId);
}

export async function createTag(body: {
  groupId: number; name: string; sortNo?: number;
}, tenantId: string) {
  const result = await queryWithTenant<{ insertId: number }>(
    "INSERT INTO t_product_tag (group_id, name, sort_no) VALUES (?, ?, ?)",
    [body.groupId, body.name, body.sortNo ?? 0],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateTag(id: number, body: {
  groupId?: number; name?: string; sortNo?: number;
}, tenantId: string) {
  const existing = await queryOneWithTenant<TagRow>(
    "SELECT id FROM t_product_tag WHERE id = ?", [id], tenantId
  );
  if (!existing) throw Object.assign(new Error("标签不存在"), { statusCode: 404 });

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.groupId !== undefined) { sets.push("group_id = ?"); params.push(body.groupId); }
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.sortNo !== undefined) { sets.push("sort_no = ?"); params.push(body.sortNo); }
  if (sets.length === 0) return { id };

  params.push(id);
  await queryWithTenant(
    `UPDATE t_product_tag SET ${sets.join(", ")} WHERE id = ?`,
    params, tenantId
  );
  return { id };
}

export async function deleteTag(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<TagRow>(
    "SELECT id FROM t_product_tag WHERE id = ?", [id], tenantId
  );
  if (!existing) throw Object.assign(new Error("标签不存在"), { statusCode: 404 });

  // 检查是否有商品引用
  const relRows = (await queryWithTenant<any>(
    "SELECT COUNT(*) AS cnt FROM t_product_tag_relation WHERE tag_id = ?", [id], tenantId
  ) as any[])[0];
  if ((relRows as any)?.[0]?.cnt > 0) {
    throw Object.assign(new Error("该标签有商品引用，无法删除"), { statusCode: 400 });
  }

  await queryWithTenant("DELETE FROM t_product_tag WHERE id = ?", [id], tenantId);
  return { id };
}

// ==================== 商品标签关联 ====================

export async function getProductTags(spuId: number, tenantId: string) {
  const rows = await queryWithTenant<any>(
    `SELECT t.id, t.name, t.group_id AS groupId, g.name AS groupName, g.code AS groupCode,
            g.is_multiple AS isMultiple
     FROM t_product_tag_relation r
     JOIN t_product_tag t ON t.id = r.tag_id
     JOIN t_product_tag_group g ON g.id = t.group_id
     WHERE r.spu_id = ?
     ORDER BY g.sort_no, t.sort_no`,
    [spuId], tenantId
  );
  return rows;
}

export async function setProductTags(spuId: number, tagIds: number[], tenantId: string) {
  await transaction(async (conn) => {
    await conn.query("DELETE FROM t_product_tag_relation WHERE spu_id = ?", [spuId]);
    for (const tagId of tagIds) {
      await conn.query(
        "INSERT INTO t_product_tag_relation (spu_id, tag_id) VALUES (?, ?)",
        [spuId, tagId]
      );
    }
  });
  return { spuId, tagIds };
}