import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";

// ========== 类型定义 ==========
export interface ReportPermissionItem {
  roleId: number;
  reportCode: string;
  storeScope: string;
  canView: boolean;
  canExport: boolean;
  storeIds?: number[] | null;
}

export interface UserReportPermission {
  userId: number;
  reportCode: string;
  storeScope: string;
  canView: boolean;
  canExport: boolean;
  storeIds?: number[] | null;
}

// ========== 1. 权限矩阵 ==========

// 获取权限矩阵
export async function getPermissionMatrix(tenantId: string) {
  const rows = await queryWithTenant<any>(
    `SELECT rpm.id, rpm.role_id AS roleId, r.name AS roleName,
            rpm.report_code AS reportCode, rpm.store_scope AS storeScope,
            rpm.can_view AS canView, rpm.can_export AS canExport,
            rpm.store_ids AS storeIds
     FROM t_report_permission_matrix rpm
     LEFT JOIN t_sys_role r ON r.id = rpm.role_id AND r.tenant_id = rpm.tenant_id
     WHERE rpm.tenant_id = ?
     ORDER BY rpm.role_id, rpm.report_code`,
    [tenantId],
    tenantId
  );

  return rows.map((row) => ({
    id: row.id,
    roleId: row.roleId,
    roleName: row.roleName,
    reportCode: row.reportCode,
    storeScope: row.storeScope,
    canView: row.canView === 1,
    canExport: row.canExport === 1,
    storeIds: row.storeIds ? JSON.parse(row.storeIds) : [],
  }));
}

// 保存权限矩阵（全量替换）
export async function savePermissionMatrix(
  tenantId: string,
  permissions: ReportPermissionItem[],
  operatorInfo: { operatorId: number; operatorName?: string }
) {
  const { operatorId, operatorName } = operatorInfo;

  await transaction(async (conn) => {
    // 删除现有权限
    await conn.execute(
      "DELETE FROM t_report_permission_matrix WHERE tenant_id = ?",
      [tenantId]
    );

    // 插入新权限
    for (const perm of permissions) {
      await conn.execute(
        `INSERT INTO t_report_permission_matrix (
          role_id, report_code, store_scope, can_view, can_export, store_ids, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          perm.roleId,
          perm.reportCode,
          perm.storeScope || "SELF",
          perm.canView ? 1 : 0,
          perm.canExport ? 1 : 0,
          perm.storeIds && perm.storeIds.length > 0 ? JSON.stringify(perm.storeIds) : null,
          tenantId,
        ]
      );
    }

    // 记录审计日志
    await conn.execute(
      `INSERT INTO t_report_permission_audit_log (
        operator_id, operator_name, action, target_type, target_id,
        before_value, after_value, remark, tenant_id
      ) VALUES (?, ?, 'UPDATE', 'ROLE', 0, ?, ?, '更新权限矩阵', ?)`,
      [
        operatorId ?? null,
        operatorName ?? null,
        JSON.stringify({ total: 0 }),
        JSON.stringify({ total: permissions.length }),
        tenantId,
      ]
    );
  });

  return { success: true, count: permissions.length };
}

// ========== 2. 数据权限配置 ==========

// 获取数据权限配置
export async function getDataScopeConfig(tenantId: string) {
  // 获取所有角色及其数据权限配置
  const rows = await queryWithTenant<any>(
    `SELECT DISTINCT rpm.role_id AS roleId, r.name AS roleName,
            rpm.store_scope AS storeScope, rpm.store_ids AS storeIds
     FROM t_report_permission_matrix rpm
     LEFT JOIN t_sys_role r ON r.id = rpm.role_id AND r.tenant_id = rpm.tenant_id
     WHERE rpm.tenant_id = ?
     ORDER BY rpm.role_id`,
    [tenantId],
    tenantId
  );

  return rows.map((row) => ({
    roleId: row.roleId,
    roleName: row.roleName,
    storeScope: row.storeScope,
    storeIds: row.storeIds ? JSON.parse(row.storeIds) : [],
  }));
}

// 更新数据权限配置
export async function updateDataScopeConfig(
  tenantId: string,
  configs: Array<{
    roleId: number;
    storeScope: string;
    storeIds?: number[];
  }>,
  operatorInfo: { operatorId: number; operatorName?: string }
) {
  const { operatorId, operatorName } = operatorInfo;

  await transaction(async (conn) => {
    for (const config of configs) {
      await conn.execute(
        `UPDATE t_report_permission_matrix
         SET store_scope = ?, store_ids = ?
         WHERE role_id = ? AND tenant_id = ?`,
        [
          config.storeScope,
          config.storeIds && config.storeIds.length > 0 ? JSON.stringify(config.storeIds) : null,
          config.roleId,
          tenantId,
        ]
      );
    }

    // 记录审计日志
    await conn.execute(
      `INSERT INTO t_report_permission_audit_log (
        operator_id, operator_name, action, target_type, target_id,
        before_value, after_value, remark, tenant_id
      ) VALUES (?, ?, 'UPDATE', 'ROLE', 0, ?, ?, '更新数据权限配置', ?)`,
      [
        operatorId ?? null,
        operatorName ?? null,
        JSON.stringify({ total: 0 }),
        JSON.stringify({ total: configs.length }),
        tenantId,
      ]
    );
  });

  return { success: true, count: configs.length };
}

// ========== 3. 用户权限 ==========

// 获取用户报表权限
export async function getUserPermissions(userId: number, tenantId: string) {
  // 查询用户角色
  const userRoles = await queryWithTenant<any>(
    `SELECT ur.role_id AS roleId
     FROM t_sys_user_role ur
     INNER JOIN t_sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.tenant_id = ?`,
    [userId, tenantId],
    tenantId
  );

  if (userRoles.length === 0) {
    return { reports: [] };
  }

  const roleIds = userRoles.map((r) => r.roleId);
  const placeholders = roleIds.map(() => "?").join(", ");

  // 查询角色的报表权限（合并）
  const rows = await queryWithTenant<any>(
    `SELECT rpm.report_code AS reportCode,
            MAX(rpm.can_view) AS canView,
            MAX(rpm.can_export) AS canExport,
            GROUP_CONCAT(DISTINCT rpm.store_scope) AS storeScopes
     FROM t_report_permission_matrix rpm
     WHERE rpm.role_id IN (${placeholders}) AND rpm.tenant_id = ?
     GROUP BY rpm.report_code`,
    [...roleIds, tenantId],
    tenantId
  );

  const reports = rows.map((row) => ({
    reportCode: row.reportCode,
    canView: row.canView === 1,
    canExport: row.canExport === 1,
    // 如果有ALL权限，则ALL；如果有多个，则取最宽的
    storeScope: row.storeScopes?.includes("ALL")
      ? "ALL"
      : row.storeScopes?.includes("CHILDREN")
      ? "CHILDREN"
      : "SELF",
  }));

  return { userId, reports };
}

// 分配用户权限（直接给用户分配，不通过角色）
export async function assignUserPermissions(
  userId: number,
  tenantId: string,
  permissions: Array<{
    reportCode: string;
    storeScope: string;
    canView: boolean;
    canExport: boolean;
    storeIds?: number[];
  }>,
  operatorInfo: { operatorId: number; operatorName?: string }
) {
  const { operatorId, operatorName } = operatorInfo;

  // 注：此处使用 report_permission_matrix 表的扩展设计
  // 实际项目中可能需要独立的用户级权限表
  // 这里先返回成功，逻辑待完善

  await transaction(async (conn) => {
    // 记录审计日志
    await conn.execute(
      `INSERT INTO t_report_permission_audit_log (
        operator_id, operator_name, action, target_type, target_id,
        before_value, after_value, remark, tenant_id
      ) VALUES (?, ?, 'GRANT', 'USER', ?, ?, ?, '分配用户报表权限', ?)`,
      [
        operatorId ?? null,
        operatorName ?? null,
        userId,
        JSON.stringify({ total: 0 }),
        JSON.stringify({ total: permissions.length }),
        tenantId,
      ]
    );
  });

  return { success: true, count: permissions.length };
}

// ========== 4. 我的权限 ==========

// 获取当前用户的报表权限列表
export async function getMyPermissions(userId: number, tenantId: string) {
  const result = await getUserPermissions(userId, tenantId);
  return result;
}

// 检查用户是否有某个报表的查看权限
export async function checkReportPermission(
  userId: number,
  tenantId: string,
  reportCode: string
): Promise<{ canView: boolean; canExport: boolean; storeScope: string }> {
  const result = await getUserPermissions(userId, tenantId);
  const report = result.reports.find((r) => r.reportCode === reportCode);

  if (!report) {
    return { canView: false, canExport: false, storeScope: "SELF" };
  }

  return {
    canView: report.canView,
    canExport: report.canExport,
    storeScope: report.storeScope,
  };
}

// ========== 5. 权限审计日志 ==========

export interface AuditLogQueryParams {
  tenantId: string;
  page: number;
  pageSize: number;
  action?: string;
  targetType?: string;
  operatorId?: number;
  dateStart?: string;
  dateEnd?: string;
}

// 获取权限审计日志
export async function getAuditLogs(params: AuditLogQueryParams) {
  const { tenantId, page, pageSize, action, targetType, operatorId, dateStart, dateEnd } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];

  if (action) {
    conditions.push("action = ?");
    queryParams.push(action);
  }
  if (targetType) {
    conditions.push("target_type = ?");
    queryParams.push(targetType);
  }
  if (operatorId !== undefined) {
    conditions.push("operator_id = ?");
    queryParams.push(operatorId);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    queryParams.push(dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await queryWithTenant<any>(
    `SELECT id, operator_id AS operatorId, operator_name AS operatorName,
            action, target_type AS targetType, target_id AS targetId, target_name AS targetName,
            report_code AS reportCode, before_value AS beforeValue, after_value AS afterValue,
            remark, created_at AS createdAt
     FROM t_report_permission_audit_log
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_report_permission_audit_log ${where}`,
    queryParams,
    tenantId
  );

  return { total: totalRow?.total ?? 0, page, pageSize, records };
}
