import { query, queryOne, transaction } from "../../shared/db";

export async function listRoles(tenantId: string) {
  const records = await query<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_sys_role
     WHERE tenant_id = ?
     ORDER BY created_at ASC`,
    [tenantId]
  );
  return records;
}

export async function createRole(body: {
  roleName: string;
  roleCode: string;
  description?: string;
  permissions: string[];
  dataScope: string;
}, tenantId: string) {
  const existing = await queryOne<any>(
    "SELECT id FROM t_sys_role WHERE role_code = ? AND tenant_id = ?",
    [body.roleCode, tenantId]
  );
  if (existing) {
    throw Object.assign(new Error("角色编码已存在"), { statusCode: 400 });
  }

  await query(
    `INSERT INTO t_sys_role (role_name, role_code, description, permissions, data_scope, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    [body.roleName, body.roleCode, body.description ?? null, JSON.stringify(body.permissions), body.dataScope, tenantId]
  );

  const record = await queryOne<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_sys_role WHERE role_code = ? AND tenant_id = ?`,
    [body.roleCode, tenantId]
  );
  return record;
}

export async function getRoleDetail(id: number, tenantId: string) {
  const record = await queryOne<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_sys_role WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  if (!record) {
    throw Object.assign(new Error("角色不存在"), { statusCode: 404 });
  }
  return record;
}

export async function updateRole(id: number, body: {
  roleName?: string;
  description?: string;
  permissions?: string[];
  dataScope?: string;
  status?: string;
}, tenantId: string) {
  const existing = await queryOne<any>(
    "SELECT id, role_code FROM t_sys_role WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("角色不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.roleName !== undefined) { updates.push("role_name = ?"); params.push(body.roleName); }
  if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }
  if (body.permissions !== undefined) { updates.push("permissions = ?"); params.push(JSON.stringify(body.permissions)); }
  if (body.dataScope !== undefined) { updates.push("data_scope = ?"); params.push(body.dataScope); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    await query(
      `UPDATE t_sys_role SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      [...params, id, tenantId]
    );
  }

  const record = await queryOne<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_sys_role WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return record;
}

export async function deleteRole(id: number, tenantId: string) {
  const existing = await queryOne<any>(
    "SELECT id, role_code FROM t_sys_role WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("角色不存在"), { statusCode: 404 });
  }
  if (existing.role_code === "SUPER_ADMIN") {
    throw Object.assign(new Error("不能删除超级管理员角色"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute("DELETE FROM t_sys_user_role WHERE role_id = ? AND tenant_id = ?", [id, tenantId]);
    await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute("DELETE FROM t_sys_role WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  });

  return { deleted: true };
}

// 专用接口：只更新角色权限
export async function updateRolePermissions(id: number, permissions: string[], tenantId: string) {
  const existing = await queryOne<any>(
    "SELECT id FROM t_sys_role WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );
  if (!existing) {
    throw Object.assign(new Error("角色不存在"), { statusCode: 404 });
  }

  await query(
    "UPDATE t_sys_role SET permissions = ? WHERE id = ? AND tenant_id = ?",
    [JSON.stringify(permissions), id, tenantId]
  );

  const record = await queryOne<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_sys_role WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return record;
}

export async function getUserRoles(userId: number, tenantId: string) {
  const records = await query<any>(
    `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode, r.description, r.status,
            r.permissions, r.data_scope AS dataScope,
            ur.created_at AS assignedAt
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND ur.tenant_id = ?
     ORDER BY ur.created_at DESC`,
    [userId, tenantId]
  );
  return records;
}

export async function setUserRoles(userId: number, roleIds: number[], tenantId: string) {
  const user = await queryOne<any>(
    "SELECT id FROM t_sys_user WHERE id = ? AND tenant_id = ?",
    [userId, tenantId]
  );
  if (!user) {
    throw Object.assign(new Error("用户不存在"), { statusCode: 404 });
  }

  if (roleIds.length > 0) {
    const placeholders = roleIds.map(() => "?").join(",");
    const roleCount = await queryOne<any>(
      `SELECT COUNT(*) AS count FROM t_sys_role WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...roleIds, tenantId]
    );
    if (Number(roleCount?.count ?? 0) !== roleIds.length) {
      throw Object.assign(new Error("部分角色不存在"), { statusCode: 400 });
    }
  }

  await transaction(async (conn) => {
    await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute("DELETE FROM t_sys_user_role WHERE user_id = ? AND tenant_id = ?", [userId, tenantId]);
    for (const roleId of roleIds) {
      await (conn as { execute: (sql: string, params?: unknown[]) => Promise<unknown> }).execute(
        "INSERT INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)",
        [userId, roleId, tenantId]
      );
    }
  });

  const records = await query<any>(
    `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode, r.description, r.status
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND ur.tenant_id = ?`,
    [userId, tenantId]
  );
  return records;
}

export async function checkUserPermission(userId: number, tenantId: number, permCode: string): Promise<boolean> {
  const roles = await query<any>(
    `SELECT r.permissions
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND ur.tenant_id = ? AND r.status = 'ACTIVE'`,
    [userId, tenantId]
  );

  for (const role of roles) {
    const perms: string[] = role.permissions ? JSON.parse(role.permissions) : [];
    if (perms.includes("*") || perms.includes(permCode)) {
      return true;
    }
  }
  return false;
}

export async function getRoleWithDataPermissions(id: number, tenantId: string) {
  const role = await queryOne<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_sys_role WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  if (!role) {
    throw Object.assign(new Error("角色不存在"), { statusCode: 404 });
  }

  const dataPermissions = await query<any>(
    `SELECT rdp.id, rdp.data_permission_id AS dataPermissionId,
            rdp.scope_values AS scopeValues,
            dp.permission_name AS permissionName, dp.permission_code AS permissionCode,
            dp.permission_type AS permissionType, dp.description
     FROM t_role_data_permission rdp
     JOIN t_data_permission dp ON dp.id = rdp.data_permission_id
     WHERE rdp.role_id = ? AND rdp.tenant_id = ?`,
    [id, tenantId]
  );

  return {
    ...role,
    dataPermissions,
  };
}