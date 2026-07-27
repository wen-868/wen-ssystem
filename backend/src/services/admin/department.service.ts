import { query } from "../../shared/db";

/** 部门行 */
interface SysDepartmentRow {
  id: number;
  parent_id: number | null;
  name: string;
  store_id: number;
  sort_order: number;
  status: number;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

interface DepartmentInput {
  parentId?: number | null;
  name: string;
  storeId?: number | string;
  sortOrder?: number;
  status?: number;
}

export async function getDepartments(tenantId: string, params?: { storeId?: number }) {
  let where = "WHERE 1=1";
  const vals: unknown[] = [];
  if (params?.storeId) { where += " AND store_id = ?"; vals.push(params.storeId); }
  const rows = await query<SysDepartmentRow>(`SELECT * FROM t_sys_department ${where} ORDER BY sort_order ASC, id ASC`, vals);
  return { records: rows };
}

export async function getDepartmentTree(tenantId: string) {
  const rows = await query<SysDepartmentRow>(`SELECT * FROM t_sys_department ORDER BY sort_order ASC, id ASC`);
  return buildTree(rows, null);
}

function buildTree(rows: SysDepartmentRow[], parentId: number | null): (SysDepartmentRow & { children: ReturnType<typeof buildTree> })[] {
  return rows
    .filter(r => r.parent_id === parentId)
    .map(r => ({ ...r, children: buildTree(rows, r.id) }));
}

export async function createDepartment(data: DepartmentInput) {
  const result = await query(
    `INSERT INTO t_sys_department (parent_id, name, store_id, sort_order, status) VALUES (?, ?, ?, ?, ?)`,
    [data.parentId || null, data.name, data.storeId, data.sortOrder || 0, data.status ?? 1]
  );
  return { id: (result as unknown as Record<string, unknown>).insertId };
}

export async function updateDepartment(id: number, data: DepartmentInput) {
  await query(
    `UPDATE t_sys_department SET parent_id=?, name=?, store_id=?, sort_order=?, status=? WHERE id=?`,
    [data.parentId, data.name, data.storeId, data.sortOrder, data.status, id]
  );
  return { success: true };
}

export async function deleteDepartment(id: number) {
  await query(`DELETE FROM t_sys_department WHERE id=?`, [id]);
  return { success: true };
}