import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as sysUserService from "../services/admin/sys-user.service.js";

export const sysUserRouter = Router();

// ========== 用户列表（子账号管理） ==========
sysUserRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  }).parse(req.query);
  const result = await sysUserService.listUsers(tenantId, params);
  res.json(ok(result));
}));

// ========== 创建子账号 ==========
sysUserRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    username: z.string().min(2).max(50),
    realName: z.string().min(1).max(50),
    password: z.string().min(6).max(64),
    mobile: z.string().max(20).optional(),
    email: z.string().email().max(128).optional(),
    roleIds: z.array(z.number().int().positive()).default([]),
  }).parse(req.body);
  try {
    const user = await sysUserService.createUser(tenantId, body, req.user!.id, req.user!.username);
    res.json(ok(user));
  } catch (err: any) {
    res.status(400).json({ code: "400", message: err.message });
  }
}));

// ========== 用户详情 ==========
sysUserRouter.get("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const user = await sysUserService.getUserDetail(tenantId, id);
  if (!user) { res.status(404).json({ code: "404", message: "用户不存在" }); return; }
  res.json(ok(user));
}));

// ========== 更新用户信息 ==========
sysUserRouter.put("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = z.object({
    realName: z.string().min(1).max(50).optional(),
    mobile: z.string().max(20).optional(),
    email: z.string().email().max(128).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
    roleIds: z.array(z.number().int().positive()).optional(),
  }).parse(req.body);
  try {
    const user = await sysUserService.updateUser(tenantId, id, body, req.user!.id, req.user!.username);
    res.json(ok(user));
  } catch (err: any) {
    res.status(400).json({ code: "400", message: err.message });
  }
}));

// ========== 重置密码 ==========
sysUserRouter.post("/:id/reset-password", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const { newPassword } = z.object({ newPassword: z.string().min(6).max(64) }).parse(req.body);
  try {
    const result = await sysUserService.resetPassword(tenantId, id, newPassword, req.user!.id, req.user!.username);
    res.json(ok(result));
  } catch (err: any) {
    res.status(400).json({ code: "400", message: err.message });
  }
}));

// ========== 删除用户 ==========
sysUserRouter.delete("/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  try {
    const result = await sysUserService.deleteUser(tenantId, id, req.user!.id, req.user!.username);
    res.json(ok(result));
  } catch (err: any) {
    res.status(400).json({ code: "400", message: err.message });
  }
}));