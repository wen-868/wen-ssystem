import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

interface BrandRow {
  id: number; name: string; logo?: string; description?: string;
  sort_no: number; status: number; tenant_id: string;
}

export async function list(params: { keyword?: string; tenantId: string }) {
  const { keyword, tenantId } = params;
  let sql = "SELECT id, name, logo, description, sort_no, status, created_at, updated_at FROM brand WHERE tenant_id = ?";
  const sqlParams: unknown[] = [tenantId];

  if (keyword) {
    sql += " AND name LIKE ?";
    sqlParams.push(`%${keyword}%`);
  }
  sql += " ORDER BY sort_no ASC, id ASC";

  return queryWithTenant<BrandRow>(sql, sqlParams, tenantId);
}

export async function create(body: {
  name: string; logo?: string; description?: string; sortNo?: number;
}, tenantId: string) {
  const result = await queryWithTenant<{ insertId: number }>(
    `INSERT INTO brand (name, logo, description, sort_no, tenant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.name, body.logo ?? null, body.description ?? null, body.sortNo ?? 0, tenantId],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function update(id: number, body: {
  name?: string; logo?: string; description?: string; sortNo?: number;
}, tenantId: string) {
  const existing = await queryOneWithTenant<BrandRow>(
    "SELECT id FROM brand WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!existing) throw Object.assign(new Error("品牌不存在"), { statusCode: 404 });

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.logo !== undefined) { sets.push("logo = ?"); params.push(body.logo); }
  if (body.description !== undefined) { sets.push("description = ?"); params.push(body.description); }
  if (body.sortNo !== undefined) { sets.push("sort_no = ?"); params.push(body.sortNo); }
  if (sets.length === 0) return { id };

  params.push(id, tenantId);
  await queryWithTenant(
    `UPDATE brand SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    params, tenantId
  );
  return { id };
}

export async function remove(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<BrandRow>(
    "SELECT id FROM brand WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!existing) throw Object.assign(new Error("品牌不存在"), { statusCode: 404 });

  await queryWithTenant("DELETE FROM brand WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}