import { query, queryOne } from "../../shared/db.js";

export async function getDepartments(tenantId: string, params?: { storeId?: number }) {
  let where = "WHERE 1=1";
  const vals: any[] = [];
  if (params?.storeId) { where += " AND store_id = ?"; vals.push(params.storeId); }
  const rows = await query<any>(`SELECT * FROM sys_department ${where} ORDER BY sort_order ASC, id ASC`, vals);
  return { records: rows };
}

export async function getDepartmentTree(tenantId: string) {
  const rows = await query<any>(`SELECT * FROM sys_department ORDER BY sort_order ASC, id ASC`);
  return buildTree(rows, null);
}

function buildTree(rows: any[], parentId: number | null): any[] {
  return rows
    .filter(r => r.parent_id === parentId)
    .map(r => ({ ...r, children: buildTree(rows, r.id) }));
}

export async function createDepartment(data: any) {
  const result = await query(
    `INSERT INTO sys_department (parent_id, name, store_id, sort_order, status) VALUES (?, ?, ?, ?, ?)`,
    [data.parentId || null, data.name, data.storeId, data.sortOrder || 0, data.status ?? 1]
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateDepartment(id: number, data: any) {
  await query(
    `UPDATE sys_department SET parent_id=?, name=?, store_id=?, sort_order=?, status=? WHERE id=?`,
    [data.parentId, data.name, data.storeId, data.sortOrder, data.status, id]
  );
  return { success: true };
}

export async function deleteDepartment(id: number) {
  await query(`DELETE FROM sys_department WHERE id=?`, [id]);
  return { success: true };
}