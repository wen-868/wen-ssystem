import { query, queryOne, transaction } from "../../shared/db";

// ========== 类型定义 ==========

interface DataPermissionRow {
  id: number;
  permissionName: string;
  permissionCode: string;
  permissionType: string;
  description: string | null;
  status: number;
  sortNo: number;
  createdAt: string;
  updatedAt: string;
}

interface IdRow {
  id: number;
}

interface RoleDataPermissionRow {
  id: number;
  roleId: number;
  dataPermissionId: number;
  scopeValues: string | null;
  permissionName: string;
  permissionCode: string;
  permissionType: string;
  description: string | null;
  createdAt: string;
}

interface UserDataPermissionRow {
  id: number;
  permissionName: string;
  permissionCode: string;
  permissionType: string;
  description: string | null;
  scopeValues: string | null;
}

export async function listDataPermissions(tenantId: string) {
  const records = await query<DataPermissionRow>(
    `SELECT id, permission_name AS permissionName, permission_code AS permissionCode,
            permission_type AS permissionType, description, status, sort_no AS sortNo,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_data_permission
     WHERE tenant_id = ? OR tenant_id = ''
     ORDER BY sort_no ASC, created_at ASC`,
    [tenantId]
  );
  return records;
}

export async function getDataPermissionDetail(id: number, tenantId: string) {
  const record = await queryOne<DataPermissionRow>(
    `SELECT id, permission_name AS permissionName, permission_code AS permissionCode,
            permission_type AS permissionType, description, status, sort_no AS sortNo,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_data_permission
     WHERE id = ? AND (tenant_id = ? OR tenant_id = '')`,
    [id, tenantId]
  );
  if (!record) {
    throw Object.assign(new Error("数据权限配置不存在"), { statusCode: 404 });
  }
  return record;
}

export async function createDataPermission(body: {
  permissionName: string;
  permissionCode: string;
  permissionType: string;
  description?: string;
  status?: number;
  sortNo?: number;
}, tenantId: string) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_data_permission WHERE permission_code = ? AND tenant_id = ?",
    [body.permissionCode, tenantId]
  );
  if (existing) {
    throw Object.assign(new Error("数据权限编码已存在"), { statusCode: 400 });
  }

  await query(
    `INSERT INTO t_data_permission (permission_name, permission_code, permission_type, description, status, sort_no, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [body.permissionName, body.permissionCode, body.permissionType, body.description ?? null, body.status ?? 1, body.sortNo ?? 0, tenantId]
  );

  const record = await queryOne<DataPermissionRow>(
    `SELECT id, permission_name AS permissionName, permission_code AS permissionCode,
            permission_type AS permissionType, description, status, sort_no AS sortNo,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_data_permission WHERE permission_code = ? AND tenant_id = ?`,
    [body.permissionCode, tenantId]
  );
  return record;
}

export async function updateDataPermission(id: number, body: {
  permissionName?: string;
  description?: string;
  status?: number;
  sortNo?: number;
}, tenantId: string) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_data_permission WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("数据权限配置不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.permissionName !== undefined) { updates.push("permission_name = ?"); params.push(body.permissionName); }
  if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }
  if (body.sortNo !== undefined) { updates.push("sort_no = ?"); params.push(body.sortNo); }

  if (updates.length > 0) {
    await query(
      `UPDATE t_data_permission SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      [...params, id, tenantId]
    );
  }

  const record = await queryOne<DataPermissionRow>(
    `SELECT id, permission_name AS permissionName, permission_code AS permissionCode,
            permission_type AS permissionType, description, status, sort_no AS sortNo,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_data_permission WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return record;
}

export async function deleteDataPermission(id: number, tenantId: string) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_data_permission WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("数据权限配置不存在"), { statusCode: 404 });
  }

  await transaction(async (conn) => {
    await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
      "DELETE FROM t_role_data_permission WHERE data_permission_id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
      "DELETE FROM t_data_permission WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
  });

  return { deleted: true };
}

export async function getRoleDataPermissions(roleId: number, tenantId: string) {
  const records = await query<RoleDataPermissionRow>(
    `SELECT rdp.id, rdp.role_id AS roleId, rdp.data_permission_id AS dataPermissionId,
            rdp.scope_values AS scopeValues,
            dp.permission_name AS permissionName, dp.permission_code AS permissionCode,
            dp.permission_type AS permissionType, dp.description,
            rdp.created_at AS createdAt
     FROM t_role_data_permission rdp
     JOIN t_data_permission dp ON dp.id = rdp.data_permission_id
     WHERE rdp.role_id = ? AND rdp.tenant_id = ?
     ORDER BY rdp.created_at DESC`,
    [roleId, tenantId]
  );
  return records;
}

export async function assignRoleDataPermission(roleId: number, dataPermissionId: number, scopeValues: number[] | null, tenantId: string) {
  const role = await queryOne<IdRow>(
    "SELECT id FROM t_sys_role WHERE id = ? AND tenant_id = ?",
    [roleId, tenantId]
  );
  if (!role) {
    throw Object.assign(new Error("角色不存在"), { statusCode: 404 });
  }

  const perm = await queryOne<IdRow>(
    "SELECT id FROM t_data_permission WHERE id = ? AND (tenant_id = ? OR tenant_id = '')",
    [dataPermissionId, tenantId]
  );
  if (!perm) {
    throw Object.assign(new Error("数据权限不存在"), { statusCode: 404 });
  }

  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_role_data_permission WHERE role_id = ? AND data_permission_id = ? AND tenant_id = ?",
    [roleId, dataPermissionId, tenantId]
  );

  if (existing) {
    await query(
      "UPDATE t_role_data_permission SET scope_values = ? WHERE id = ?",
      [scopeValues ? JSON.stringify(scopeValues) : null, existing.id]
    );
  } else {
    await query(
      "INSERT INTO t_role_data_permission (role_id, data_permission_id, scope_values, tenant_id) VALUES (?, ?, ?, ?)",
      [roleId, dataPermissionId, scopeValues ? JSON.stringify(scopeValues) : null, tenantId]
    );
  }

  const records = await getRoleDataPermissions(roleId, tenantId);
  return records;
}

export async function removeRoleDataPermission(roleId: number, dataPermissionId: number, tenantId: string) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_role_data_permission WHERE role_id = ? AND data_permission_id = ? AND tenant_id = ?",
    [roleId, dataPermissionId, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("角色数据权限关联不存在"), { statusCode: 404 });
  }

  await query(
    "DELETE FROM t_role_data_permission WHERE id = ?",
    [existing.id]
  );

  const records = await getRoleDataPermissions(roleId, tenantId);
  return records;
}

export async function getUserDataPermissions(userId: number, tenantId: string) {
  const records = await query<UserDataPermissionRow>(
    `SELECT DISTINCT dp.id, dp.permission_name AS permissionName, dp.permission_code AS permissionCode,
            dp.permission_type AS permissionType, dp.description,
            rdp.scope_values AS scopeValues
     FROM t_sys_user_role ur
     JOIN t_role_data_permission rdp ON rdp.role_id = ur.role_id AND rdp.tenant_id = ur.tenant_id
     JOIN t_data_permission dp ON dp.id = rdp.data_permission_id
     WHERE ur.user_id = ? AND ur.tenant_id = ?
     ORDER BY dp.sort_no ASC`,
    [userId, tenantId]
  );
  return records;
}

export async function checkDataPermission(userId: number, tenantId: string, dataType: string, targetId: number | null): Promise<boolean> {
  const permissions = await getUserDataPermissions(userId, tenantId);

  for (const perm of permissions) {
    if (perm.permissionType === "ALL") {
      return true;
    }

    if (perm.permissionType === dataType && targetId !== null) {
      const scopeValues: number[] = perm.scopeValues ? JSON.parse(perm.scopeValues) : [];
      if (scopeValues.length === 0 || scopeValues.includes(targetId)) {
        return true;
      }
    }
  }

  return false;
}
