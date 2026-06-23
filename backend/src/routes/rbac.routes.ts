import { Router } from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok } from "../shared/response.js";
import type { AuthUser } from "../shared/auth.js";

export const rbacRouter = Router();

// ========== 权限验证中间件 ==========

export function requirePermission(permCode: string): RequestHandler {
  return (req, res, next) => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      res.status(401).json({ code: "401", message: "未登录" });
      return;
    }
    // 超级管理员跳过权限检查
    if (user.roles.includes("SUPER_ADMIN")) {
      next();
      return;
    }
    // 查询用户角色的权限
    checkUserPermission(user.id, permCode).then((hasPermission) => {
      if (hasPermission) {
        next();
      } else {
        res.status(403).json({ code: "403", message: `无权限执行此操作，需要权限: ${permCode}` });
      }
    }).catch(() => {
      res.status(500).json({ code: "500", message: "权限检查失败" });
    });
  };
}

async function checkUserPermission(userId: number, permCode: string): Promise<boolean> {
  const roles = await query<any>(
    `SELECT r.permissions
     FROM sys_user_role ur
     JOIN sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.status = 'ACTIVE'`,
    [userId]
  );

  for (const role of roles) {
    const perms: string[] = role.permissions ? JSON.parse(role.permissions) : [];
    if (perms.includes("*") || perms.includes(permCode)) {
      return true;
    }
  }
  return false;
}

// ========== 角色管理 ==========

// 角色列表
rbacRouter.get("/", asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM sys_role
     ORDER BY created_at ASC`
  );

  res.json(ok(records));
}));

// 创建角色
rbacRouter.post("/", asyncHandler(async (req, res) => {
  const body = z.object({
    roleName: z.string().min(1).max(50),
    roleCode: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    permissions: z.array(z.string()).default([]),
    dataScope: z.enum(["ALL", "DEPARTMENT", "STORE", "SELF"]).default("SELF")
  }).parse(req.body);

  // 检查角色编码唯一性
  const existing = await queryOne<any>("SELECT id FROM sys_role WHERE role_code = ?", [body.roleCode]);
  if (existing) {
    res.status(400).json({ code: "400", message: "角色编码已存在" });
    return;
  }

  await query(
    `INSERT INTO sys_role (role_name, role_code, description, permissions, data_scope, status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [body.roleName, body.roleCode, body.description ?? null, JSON.stringify(body.permissions), body.dataScope]
  );

  const record = await queryOne<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM sys_role WHERE role_code = ?`,
    [body.roleCode]
  );

  res.json(ok(record));
}));

// 角色详情
rbacRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const record = await queryOne<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM sys_role WHERE id = ?`,
    [id]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "角色不存在" });
    return;
  }

  res.json(ok(record));
}));

// 更新角色
rbacRouter.put("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, role_code FROM sys_role WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "角色不存在" });
    return;
  }

  const body = z.object({
    roleName: z.string().min(1).max(50).optional(),
    description: z.string().max(200).optional(),
    permissions: z.array(z.string()).optional(),
    dataScope: z.enum(["ALL", "DEPARTMENT", "STORE", "SELF"]).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional()
  }).parse(req.body);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.roleName !== undefined) { updates.push("role_name = ?"); params.push(body.roleName); }
  if (body.description !== undefined) { updates.push("description = ?"); params.push(body.description); }
  if (body.permissions !== undefined) { updates.push("permissions = ?"); params.push(JSON.stringify(body.permissions)); }
  if (body.dataScope !== undefined) { updates.push("data_scope = ?"); params.push(body.dataScope); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    await query(`UPDATE sys_role SET ${updates.join(", ")} WHERE id = ?`, [...params, id]);
  }

  const record = await queryOne<any>(
    `SELECT id, role_name AS roleName, role_code AS roleCode, description, status,
            permissions, data_scope AS dataScope,
            created_at AS createdAt, updated_at AS updatedAt
     FROM sys_role WHERE id = ?`,
    [id]
  );

  res.json(ok(record));
}));

// 删除角色
rbacRouter.delete("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, role_code FROM sys_role WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "角色不存在" });
    return;
  }
  if (existing.role_code === "SUPER_ADMIN") {
    res.status(400).json({ code: "400", message: "不能删除超级管理员角色" });
    return;
  }

  await transaction(async (conn) => {
    // 删除用户角色关联
    await (conn as any).execute("DELETE FROM sys_user_role WHERE role_id = ?", [id]);
    // 删除角色
    await (conn as any).execute("DELETE FROM sys_role WHERE id = ?", [id]);
  });

  res.json(ok({ deleted: true }));
}));

// ========== 用户角色分配 ==========

// 获取用户角色列表
rbacRouter.get("/users/:userId/roles", asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);

  const records = await query<any>(
    `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode, r.description, r.status,
            r.permissions, r.data_scope AS dataScope,
            ur.created_at AS assignedAt
     FROM sys_user_role ur
     JOIN sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ?
     ORDER BY ur.created_at DESC`,
    [userId]
  );

  res.json(ok(records));
}));

// 设置用户角色（替换式）
rbacRouter.put("/users/:userId/roles", asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);

  const body = z.object({
    roleIds: z.array(z.number().int().positive())
  }).parse(req.body);

  // 校验用户是否存在
  const user = await queryOne<any>("SELECT id FROM sys_user WHERE id = ?", [userId]);
  if (!user) {
    res.status(404).json({ code: "404", message: "用户不存在" });
    return;
  }

  // 校验角色是否存在
  if (body.roleIds.length > 0) {
    const roleCount = await queryOne<any>(
      `SELECT COUNT(*) AS count FROM sys_role WHERE id IN (${body.roleIds.map(() => "?").join(",")})`,
      body.roleIds
    );
    if (Number(roleCount?.count ?? 0) !== body.roleIds.length) {
      res.status(400).json({ code: "400", message: "部分角色不存在" });
      return;
    }
  }

  await transaction(async (conn) => {
    // 删除旧的角色关联
    await (conn as any).execute("DELETE FROM sys_user_role WHERE user_id = ?", [userId]);
    // 插入新的角色关联
    for (const roleId of body.roleIds) {
      await (conn as any).execute(
        "INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)",
        [userId, roleId]
      );
    }
  });

  const records = await query<any>(
    `SELECT r.id, r.role_name AS roleName, r.role_code AS roleCode, r.description, r.status
     FROM sys_user_role ur
     JOIN sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );

  res.json(ok(records));
}));
