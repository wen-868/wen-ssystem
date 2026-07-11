import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import logger from "../../shared/logger.js";
import { syncChangedFields } from "../../shared/field-sync.js";

interface CategoryRow {
  id: number; name: string; parent_id: number | null; sort_no: number;
  icon?: string; code?: string; status: number; tenant_id: string;
  allow_online_sale: number;
}

export async function list(params: { pid?: number; tenantId: string; allowOnlineSale?: number }) {
  const { pid, tenantId, allowOnlineSale } = params;
  let sql = "SELECT id, parent_id, name, icon, code, sort_no, status, allow_online_sale, created_at, updated_at FROM t_product_category WHERE tenant_id = ?";
  const sqlParams: unknown[] = [tenantId];

  if (pid !== undefined) {
    sql += " AND parent_id = ?";
    sqlParams.push(pid);
  } else {
    sql += " AND parent_id IS NULL";
  }
  if (allowOnlineSale !== undefined) {
    sql += " AND allow_online_sale = ?";
    sqlParams.push(allowOnlineSale);
  }
  sql += " ORDER BY sort_no ASC, id ASC";

  const rows = await queryWithTenant<CategoryRow>(sql, sqlParams, tenantId);
  return rows;
}

export async function create(body: {
  name: string; parentId?: number | null; sortNo?: number;
  icon?: string; code?: string; allowOnlineSale?: number;
}, tenantId: string) {
  const result = await queryWithTenant<{ insertId: number }>(
    `INSERT INTO t_product_category (name, parent_id, sort_no, icon, code, allow_online_sale, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [body.name, body.parentId ?? null, body.sortNo ?? 0,
     body.icon ?? null, body.code ?? null, body.allowOnlineSale ?? 1, tenantId],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function update(id: number, body: {
  name?: string; parentId?: number | null; sortNo?: number;
  icon?: string; code?: string; allowOnlineSale?: number;
}, tenantId: string) {
  const existing = await queryOneWithTenant<CategoryRow>(
    "SELECT id, name FROM t_product_category WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!existing) throw Object.assign(new Error("分类不存在"), { statusCode: 404 });

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.parentId !== undefined) { sets.push("parent_id = ?"); params.push(body.parentId); }
  if (body.sortNo !== undefined) { sets.push("sort_no = ?"); params.push(body.sortNo); }
  if (body.icon !== undefined) { sets.push("icon = ?"); params.push(body.icon); }
  if (body.code !== undefined) { sets.push("code = ?"); params.push(body.code); }
  if (body.allowOnlineSale !== undefined) { sets.push("allow_online_sale = ?"); params.push(body.allowOnlineSale); }
  if (sets.length === 0) return { id };

  params.push(id, tenantId);
  await queryWithTenant(
    `UPDATE t_product_category SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    params, tenantId
  );

  // 同步分类名称到 product_spu / product_sku
  if (body.name !== undefined) {
    syncChangedFields("product_category", id, ["name"], tenantId).catch(err => {
      logger.error("[FieldSync] 分类名称同步异常:", err.message);
    });
  }

  return { id };
}

export async function remove(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<CategoryRow>(
    "SELECT id FROM t_product_category WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!existing) throw Object.assign(new Error("分类不存在"), { statusCode: 404 });

  // 检查是否有子分类
  const childRows = (await queryWithTenant<any>(
    "SELECT COUNT(*) AS cnt FROM t_product_category WHERE parent_id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  ) as any[])[0];
  if ((childRows as any)?.[0]?.cnt > 0) {
    throw Object.assign(new Error("请先删除子分类"), { statusCode: 400 });
  }

  // 检查是否有商品引用
  const productRows = (await queryWithTenant<any>(
    "SELECT COUNT(*) AS cnt FROM t_product_spu WHERE category_id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  ) as any[])[0];
  if ((productRows as any)?.[0]?.cnt > 0) {
    throw Object.assign(new Error("该分类下有商品，无法删除"), { statusCode: 400 });
  }

  await queryWithTenant("DELETE FROM t_product_category WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}

export async function sort(items: Array<{ id: number; sortNo: number }>, tenantId: string) {
  await transaction(async (conn) => {
    for (const item of items) {
      await conn.query(
        "UPDATE t_product_category SET sort_no = ? WHERE id = ? AND tenant_id = ?",
        [item.sortNo, item.id, tenantId]
      );
    }
  });
  return { ok: true };
}