import { z } from "zod";
import { ok } from "../../shared/response";
import * as sysUserService from "../../services/admin/sys-user.service";

export async function listSysUsers(req: any, res: any) {
  const tenantId = req.tenantId!;
  const schema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  });
  const params = schema.parse(req.query);
  const result = await sysUserService.listUsers(tenantId, params);
  res.json(ok(result));
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

  const user = await sysUserService.createUser(
    tenantId,
    body,
    req.user!.id,
    req.user!.username
  );
  res.json(ok(user));
}

export async function getSysUser(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const user = await sysUserService.getUserDetail(tenantId, id);
  if (!user) {
    res.status(404).json({ code: "404", msg: "用户不存在" });
    return;
  }
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

  const user = await sysUserService.updateUser(
    tenantId,
    id,
    body,
    req.user!.id,
    req.user!.username
  );
  res.json(ok(user));
}

export async function resetSysUserPassword(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = z.object({
    newPassword: z.string().min(6).max(64),
  }).parse(req.body);

  const result = await sysUserService.resetPassword(
    tenantId,
    id,
    body.newPassword,
    req.user!.id,
    req.user!.username
  );
  res.json(ok(result));
}

export async function deleteSysUser(req: any, res: any) {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const result = await sysUserService.deleteUser(
    tenantId,
    id,
    req.user!.id,
    req.user!.username
  );
  res.json(ok(result));
}
