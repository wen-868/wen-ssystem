import { query, queryOne } from "../../shared/db.js";

export async function getReportPermissions(tenantId: string) {
  return query<any>(
    `SELECT rp.id, rp.role_id AS roleId, r.role_name AS roleName, rp.report_code AS reportCode, rp.report_name AS reportName, rp.access_level AS accessLevel
     FROM report_permission rp
     JOIN sys_role r ON rp.role_id = r.id
     WHERE r.tenant_id = ? ORDER BY r.role_name, rp.report_code`,
    [tenantId]
  );
}

export async function saveReportPermissions(tenantId: string, permissions: { roleId: number; reportCode: string; reportName: string; accessLevel: string }[]) {
  // 先删除旧的
  await query(`DELETE FROM report_permission WHERE role_id IN (SELECT r.id FROM sys_role r WHERE r.tenant_id = ?)`, [tenantId]);
  // 批量插入
  for (const p of permissions) {
    await query(
      `INSERT INTO report_permission (role_id, report_code, report_name, access_level) VALUES (?, ?, ?, ?)`,
      [p.roleId, p.reportCode, p.reportName, p.accessLevel]
    );
  }
  return { success: true };
}