import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

export async function listPositions(params: { departmentId?: number; status?: number; page: number; pageSize: number; tenantId: string }) {
  const { departmentId, status, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["tenant_id = ?"];
  const values: unknown[] = [tenantId];
  if (departmentId !== undefined) { conditions.push("department_id = ?"); values.push(departmentId); }
  if (status !== undefined) { conditions.push("status = ?"); values.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<any>(
    `SELECT id, position_name AS positionName, position_code AS positionCode, department_id AS departmentId, sort_order AS sortOrder, status, remark, created_at AS createdAt, updated_at AS updatedAt
     FROM t_sys_position ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<any>(`SELECT COUNT(*) AS total FROM t_sys_position ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

export async function getPosition(id: number, tenantId: string) {
  const position = await queryOneWithTenant<any>(
    "SELECT id, position_name AS positionName, position_code AS positionCode, department_id AS departmentId, sort_order AS sortOrder, status, remark, created_at AS createdAt, updated_at AS updatedAt FROM t_sys_position WHERE id = ? AND tenant_id = ?",
    [id, tenantId], tenantId
  );
  if (!position) throw Object.assign(new Error("岗位不存在"), { statusCode: 404 });
  return position;
}

export async function createPosition(params: { positionName: string; positionCode?: string; departmentId?: number; sortOrder?: number; status?: number; remark?: string; tenantId: string }) {
  const { positionName, positionCode, departmentId, sortOrder, status, remark, tenantId } = params;
  const result = await queryWithTenant<any>(
    "INSERT INTO t_sys_position (position_name, position_code, department_id, sort_order, status, remark, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [positionName, positionCode ?? null, departmentId ?? null, sortOrder ?? 0, status ?? 1, remark ?? null, tenantId], tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, positionName };
}

export async function updatePosition(id: number, params: { positionName?: string; positionCode?: string; departmentId?: number; sortOrder?: number; status?: number; remark?: string; tenantId: string }) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (params.positionName !== undefined) { fields.push("position_name = ?"); values.push(params.positionName); }
  if (params.positionCode !== undefined) { fields.push("position_code = ?"); values.push(params.positionCode); }
  if (params.departmentId !== undefined) { fields.push("department_id = ?"); values.push(params.departmentId); }
  if (params.sortOrder !== undefined) { fields.push("sort_order = ?"); values.push(params.sortOrder); }
  if (params.status !== undefined) { fields.push("status = ?"); values.push(params.status); }
  if (params.remark !== undefined) { fields.push("remark = ?"); values.push(params.remark); }
  if (fields.length === 0) throw Object.assign(new Error("没有需要更新的字段"), { statusCode: 400 });
  values.push(id, params.tenantId);
  await queryWithTenant(`UPDATE t_sys_position SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, params.tenantId);
  return { id, ...params };
}

export async function deletePosition(id: number, tenantId: string) {
  const position = await queryOneWithTenant<any>("SELECT id FROM t_sys_position WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  if (!position) throw Object.assign(new Error("岗位不存在"), { statusCode: 404 });
  await queryWithTenant("DELETE FROM t_sys_position WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}

export async function listAllPositions(tenantId: string) {
  return queryWithTenant<any>(
    "SELECT id, position_name AS positionName, position_code AS positionCode FROM t_sys_position WHERE tenant_id = ? AND status = 1 ORDER BY sort_order ASC",
    [tenantId], tenantId
  );
}
