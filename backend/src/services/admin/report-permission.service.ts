import { query, transaction } from "../../shared/db";

/** 报表权限矩阵行 */
interface ReportPermissionRow {
  id: number;
  role_id: number;
  report_code: string;
  store_scope: string;
  role_name: string;
}

export async function getMatrix() {
  const rows = await query<ReportPermissionRow>(
    `SELECT rpm.*, r.name AS role_name
     FROM t_report_permission_matrix rpm
     LEFT JOIN t_sys_role r ON r.id = rpm.role_id
     ORDER BY rpm.role_id, rpm.report_code`
  );
  return rows;
}

export async function saveMatrix(data: Array<{ role_id: number; report_code: string; store_scope: string }>) {
  await transaction(async (conn) => {
    await conn.query("DELETE FROM t_report_permission_matrix WHERE 1=1");
    for (const item of data) {
      await conn.query(
        `INSERT INTO t_report_permission_matrix (role_id, report_code, store_scope) VALUES (?, ?, ?)`,
        [item.role_id, item.report_code, item.store_scope]
      );
    }
  });
}