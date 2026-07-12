import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

interface UnitRow {
  id: number; name: string; code: string; type: string;
  sort_no: number; status: number; tenant_id: string;
}

export async function list(params: { keyword?: string; tenantId: string }) {
  const { keyword, tenantId } = params;
  let sql = "SELECT id, name, code, type, sort_no, status, created_at, updated_at FROM unit WHERE tenant_id = ?";
  const sqlParams: unknown[] = [tenantId];

  if (keyword) {
    sql += " AND (name LIKE ? OR code LIKE ?)";
    sqlParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  sql += " ORDER BY sort_no ASC, id ASC";

  return queryWithTenant<UnitRow>(sql, sqlParams, tenantId);
}

export async function create(body: {
  name: string; code: string; type?: string; sortNo?: number;
}, tenantId: string) {
  const result = await queryWithTenant<{ insertId: number }>(
    `INSERT INTO unit (name, code, type, sort_no, tenant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.name, body.code, body.type ?? "BASE", body.sortNo ?? 0, tenantId],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function update(id: number, body: {
  name?: string; code?: string; type?: string; sortNo?: number;
}, tenantId: string) {
  const existing = await queryOneWithTenant<UnitRow>(
    "SELECT id FROM unit WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!existing) throw Object.assign(new Error("单位不存在"), { statusCode: 404 });

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.code !== undefined) { sets.push("code = ?"); params.push(body.code); }
  if (body.type !== undefined) { sets.push("type = ?"); params.push(body.type); }
  if (body.sortNo !== undefined) { sets.push("sort_no = ?"); params.push(body.sortNo); }
  if (sets.length === 0) return { id };

  params.push(id, tenantId);
  await queryWithTenant(
    `UPDATE unit SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    params, tenantId
  );
  return { id };
}

export async function remove(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<UnitRow>(
    "SELECT id FROM unit WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!existing) throw Object.assign(new Error("单位不存在"), { statusCode: 404 });

  await queryWithTenant("DELETE FROM unit WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}