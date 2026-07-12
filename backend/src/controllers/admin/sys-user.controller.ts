import { z } from "zod";
import { query, queryOne, transaction } from "../../shared/db";
import { ok, fail } from "../../shared/response";
import bcrypt from "bcryptjs";

export async function listSysUsers(req: any, res: any) {
  const tenantId = req.tenantId!;
  const schema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  });
  const params = schema.parse(req.query);
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

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_sys_user ${where}`, sqlParams
  );
  const total = totalRow?.total ?? 0;

  const records = await query<any>(
    `SELECT id, username, real_name AS realName, mobile, email,
            status, last_login_at AS lastLoginAt, created_at AS createdAt
     FROM t_sys_user ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  for (const r of records) {
    const roles = await query<any>(
      `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode
       FROM t_sys_user_role ur
       JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
       WHERE ur.user_id = ? AND ur.tenant_id = ?`,
      [r.id, tenantId]
    );
    r.roles = roles;
  }

  res.json(ok({ total, page: params.page, pageSize: params.pageSize, records }));
}

export async function createSysUser(req: any, res: any) {
  const tenantId = req.tenantId!;
  const body = z.object({
    username: z.string().min(2).max(50),
    realName: z.string().min(1).max(50),
    password: z.string().min(6).max(64),
    mobile: z.string().max(20).optional(),
    email: z.string().email().max(128).optional(),
    roleIds: z.array(z.number().int().positive()).default([]),
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id FROM t_sys_user WHERE username = ? AND tenant_id = ?",
    [body.username, tenantId]
  );
  if (existing) {
    res.status(400).json(fail("用户名已存在", "400"));
    return;
  }

  const hashedPassword = await bcrypt.hash(body.password, 10);

  await transaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO t_sys_user (username, password_hash, real_name, mobile, email, status, tenant_id)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [body.username, hashedPassword, body.realName, body.mobile ?? null, body.email ?? null, tenantId]
    );
    const userId = (result as unknown as { insertId: number }).insertId;

    for (const roleId of body.roleIds) {
      await conn.execute(
        "INSERT INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)",
        [userId, roleId, tenantId]
      );
    }

    await conn.execute(
      `INSERT INTO t_operation_log (operator_id, operator_name, module, action, target_id, target_type, remark, tenant_id)
       VALUES (?, ?, 'USER', 'CREATE', ?, 'user', ?, ?)`,
      [req.user!.id, req.user!.username, userId, `创建子账号: ${body.username}`, tenantId]
    );
  });

  const user = await queryOne<any>(
    `SELECT id, username, real_name AS realName, mobile, email, status, created_at AS createdAt
     FROM t_sys_user WHERE username = ? AND tenant_id = ?`,
    [body.username, tenantId]
  );

  res.json(ok(user));
}

export async function getSysUser(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const user = await queryOne<any>(
    `SELECT id, username, real_name AS realName, mobile, email, status,
            last_login_at AS lastLoginAt, created_at AS createdAt, updated_at AS updatedAt
     FROM t_sys_user WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  if (!user) { res.status(404).json(fail("用户不存在", "404")); return; }

  const roles = await query<any>(
    `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode
     FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
     WHERE ur.user_id = ? AND ur.tenant_id = ?`,
    [id, tenantId]
  );
  user.roles = roles;

  res.json(ok(user));
}

export async function updateSysUser(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = z.object({
    realName: z.string().min(1).max(50).optional(),
    mobile: z.string().max(20).optional(),
    email: z.string().email().max(128).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
    roleIds: z.array(z.number().int().positive()).optional(),
  }).parse(req.body);

  const existing = await queryOne<any>("SELECT id FROM t_sys_user WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  if (!existing) { res.status(404).json(fail("用户不存在", "404")); return; }

  const updates: string[] = [];
  const sqlParams: any[] = [];

  if (body.realName !== undefined) { updates.push("real_name = ?"); sqlParams.push(body.realName); }
  if (body.mobile !== undefined) { updates.push("mobile = ?"); sqlParams.push(body.mobile); }
  if (body.email !== undefined) { updates.push("email = ?"); sqlParams.push(body.email); }
  if (body.status !== undefined) { updates.push("status = ?"); sqlParams.push(body.status); }

  await transaction(async (conn) => {
    if (updates.length > 0) {
      sqlParams.push(id, tenantId);
      await conn.execute(
        `UPDATE t_sys_user SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
        sqlParams
      );
    }

    if (body.roleIds !== undefined) {
      await conn.execute("DELETE FROM t_sys_user_role WHERE user_id = ? AND tenant_id = ?", [id, tenantId]);
      for (const roleId of body.roleIds) {
        await conn.execute("INSERT INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (?, ?, ?)", [id, roleId, tenantId]);
      }
    }

    await conn.execute(
      `INSERT INTO t_operation_log (operator_id, operator_name, module, action, target_id, target_type, remark, tenant_id)
       VALUES (?, ?, 'USER', 'UPDATE', ?, 'user', ?, ?)`,
      [req.user!.id, req.user!.username, id, `更新用户信息: ${id}`, tenantId]
    );
  });

  const user = await queryOne<any>(
    `SELECT id, username, real_name AS realName, mobile, email, status, updated_at AS updatedAt
     FROM t_sys_user WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  res.json(ok(user));
}

export async function resetSysUserPassword(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = z.object({
    newPassword: z.string().min(6).max(64),
  }).parse(req.body);

  const existing = await queryOne<any>("SELECT id, username FROM t_sys_user WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  if (!existing) { res.status(404).json(fail("用户不存在", "404")); return; }

  const hashedPassword = await bcrypt.hash(body.newPassword, 10);
  await query("UPDATE t_sys_user SET password_hash = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?", [hashedPassword, id, tenantId]);

  await query(
    `INSERT INTO t_operation_log (operator_id, operator_name, module, action, target_id, target_type, remark, tenant_id)
     VALUES (?, ?, 'USER', 'RESET_PASSWORD', ?, 'user', ?, ?)`,
    [req.user!.id, req.user!.username, id, `重置用户密码: ${existing.username}`, tenantId]
  );

  res.json(ok({ message: "密码重置成功" }));
}

export async function deleteSysUser(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);

  const existing = await queryOne<any>("SELECT id, username FROM t_sys_user WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  if (!existing) { res.status(404).json(fail("用户不存在", "404")); return; }

  await transaction(async (conn) => {
    await conn.execute("DELETE FROM t_sys_user_role WHERE user_id = ? AND tenant_id = ?", [id, tenantId]);
    await conn.execute("DELETE FROM t_sys_user WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    await conn.execute(
      `INSERT INTO t_operation_log (operator_id, operator_name, module, action, target_id, target_type, remark, tenant_id)
       VALUES (?, ?, 'USER', 'DELETE', ?, 'user', ?, ?)`,
      [req.user!.id, req.user!.username, id, `删除用户: ${existing.username}`, tenantId]
    );
  });

  res.json(ok({ deleted: true }));
}
