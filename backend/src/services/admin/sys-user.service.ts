import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import bcrypt from "bcryptjs";

export interface UserListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: "ACTIVE" | "DISABLED";
}

export interface CreateUserInput {
  username: string;
  realName: string;
  password: string;
  mobile?: string;
  email?: string;
  roleIds: number[];
}

export interface UpdateUserInput {
  realName?: string;
  mobile?: string;
  email?: string;
  status?: "ACTIVE" | "DISABLED";
  roleIds?: number[];
}

export async function listUsers(tenantId: string, params: UserListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.keyword) {
    conditions.push("(username LIKE ? OR real_name LIKE ? OR mobile LIKE ?)");
    const kw = `%${params.keyword}%`;
    sqlParams.push(kw, kw, kw);
  }
  if (params.status) { conditions.push("status = ?"); sqlParams.push(params.status); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sys_user ${where}`, sqlParams, tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<any>(
    `SELECT id, username, real_name AS realName, mobile, email,
            status, last_login_at AS lastLoginAt, created_at AS createdAt
     FROM sys_user ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  for (const r of records) {
    const roles = await queryWithTenant<any>(
      `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode
       FROM sys_user_role ur
       JOIN sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
       WHERE ur.user_id = ? AND ur.tenant_id = ?`,
      [r.id, tenantId],
      tenantId
    );
    r.roles = roles;
  }

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function createUser(tenantId: string, input: CreateUserInput, operatorId: number, operatorName: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM sys_user WHERE username = ? AND tenant_id = ?",
    [input.username, tenantId], tenantId
  );
  if (existing) throw new Error("用户名已存在");

  const hashedPassword = await bcrypt.hash(input.password, 10);

  await transaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO sys_user (username, password_hash, real_name, mobile, email, status, tenant_id)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [input.username, hashedPassword, input.realName, input.mobile ?? null, input.email ?? null, tenantId]
    );
    const userId = (result as unknown as { insertId: number }).insertId;

    for (const roleId of input.roleIds) {
      await conn.execute(
        "INSERT INTO sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)",
        [userId, roleId, tenantId]
      );
    }

    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, target_id, target_type, remark, tenant_id)
       VALUES (?, ?, 'USER', 'CREATE', ?, 'user', ?, ?)`,
      [operatorId, operatorName, userId, `创建子账号: ${input.username}`, tenantId]
    );
  });

  const user = await queryOneWithTenant<any>(
    `SELECT id, username, real_name AS realName, mobile, email, status, created_at AS createdAt
     FROM sys_user WHERE username = ? AND tenant_id = ?`,
    [input.username, tenantId], tenantId
  );
  return user;
}

export async function getUserDetail(tenantId: string, id: number) {
  const user = await queryOneWithTenant<any>(
    `SELECT id, username, real_name AS realName, mobile, email, status,
            last_login_at AS lastLoginAt, created_at AS createdAt, updated_at AS updatedAt
     FROM sys_user WHERE id = ? AND tenant_id = ?`,
    [id, tenantId], tenantId
  );
  if (!user) return null;

  const roles = await queryWithTenant<any>(
    `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode
     FROM sys_user_role ur
     JOIN sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND ur.tenant_id = ?`,
    [id, tenantId], tenantId
  );
  user.roles = roles;
  return user;
}

export async function updateUser(tenantId: string, id: number, input: UpdateUserInput, operatorId: number, operatorName: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM sys_user WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId
  );
  if (!existing) throw new Error("用户不存在");

  const updates: string[] = [];
  const sqlParams: any[] = [];

  if (input.realName !== undefined) { updates.push("real_name = ?"); sqlParams.push(input.realName); }
  if (input.mobile !== undefined) { updates.push("mobile = ?"); sqlParams.push(input.mobile); }
  if (input.email !== undefined) { updates.push("email = ?"); sqlParams.push(input.email); }
  if (input.status !== undefined) { updates.push("status = ?"); sqlParams.push(input.status); }

  await transaction(async (conn) => {
    if (updates.length > 0) {
      sqlParams.push(id, tenantId);
      await conn.execute(
        `UPDATE sys_user SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
        sqlParams
      );
    }

    if (input.roleIds !== undefined) {
      await conn.execute("DELETE FROM sys_user_role WHERE user_id = ? AND tenant_id = ?", [id, tenantId]);
      for (const roleId of input.roleIds) {
        await conn.execute("INSERT INTO sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)", [id, roleId, tenantId]);
      }
    }

    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, target_id, target_type, remark, tenant_id)
       VALUES (?, ?, 'USER', 'UPDATE', ?, 'user', ?, ?)`,
      [operatorId, operatorName, id, `更新用户信息: ${id}`, tenantId]
    );
  });

  const user = await queryOneWithTenant<any>(
    `SELECT id, username, real_name AS realName, mobile, email, status, updated_at AS updatedAt
     FROM sys_user WHERE id = ? AND tenant_id = ?`,
    [id, tenantId], tenantId
  );
  return user;
}

export async function resetPassword(tenantId: string, id: number, newPassword: string, operatorId: number, operatorName: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, username FROM sys_user WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId
  );
  if (!existing) throw new Error("用户不存在");

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await queryWithTenant(
    "UPDATE sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [hashedPassword, id, tenantId], tenantId
  );

  await queryWithTenant(
    `INSERT INTO operation_log (operator_id, operator_name, module, action, target_id, target_type, remark, tenant_id)
     VALUES (?, ?, 'USER', 'RESET_PASSWORD', ?, 'user', ?, ?)`,
    [operatorId, operatorName, id, `重置用户密码: ${existing.username}`, tenantId], tenantId
  );

  return { message: "密码重置成功" };
}

export async function deleteUser(tenantId: string, id: number, operatorId: number, operatorName: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, username FROM sys_user WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId
  );
  if (!existing) throw new Error("用户不存在");

  await transaction(async (conn) => {
    await conn.execute("DELETE FROM sys_user_role WHERE user_id = ? AND tenant_id = ?", [id, tenantId]);
    await conn.execute("DELETE FROM sys_user WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, target_id, target_type, remark, tenant_id)
       VALUES (?, ?, 'USER', 'DELETE', ?, 'user', ?, ?)`,
      [operatorId, operatorName, id, `删除用户: ${existing.username}`, tenantId]
    );
  });

  return { deleted: true };
}