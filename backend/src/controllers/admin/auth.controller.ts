import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import * as authService from "../../services/admin/auth.service";

// 密码强度校验：至少8位，必须含大小写字母+数字
function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) return { valid: false, message: "密码长度不能少于8位" };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "密码必须包含至少一个大写字母" };
  if (!/[a-z]/.test(password)) return { valid: false, message: "密码必须包含至少一个小写字母" };
  if (!/[0-9]/.test(password)) return { valid: false, message: "密码必须包含至少一个数字" };
  return { valid: true };
}

export const login = asyncHandler(async (req, res) => {
  const body = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  const result = await authService.login(body.username, body.password);
  res.json(ok(result));
});

export const changePassword = asyncHandler(async (req, res) => {
  const body = z.object({
    oldPassword: z.string(),
    newPassword: z.string()
  }).parse(req.body);
  const strengthCheck = validatePasswordStrength(body.newPassword);
  if (!strengthCheck.valid) {
    res.status(400).json(fail(strengthCheck.message || "", "400"));
    return;
  }
  const result = await authService.changePassword(req.user!.id, body.oldPassword, body.newPassword, req.tenantId as string);
  res.json(ok(result));
});

export const getMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user!);
  res.json(ok(result));
});

export const getSettings = asyncHandler(async (req, res) => {
  const result = await authService.getSettings(req.user!.id, req.tenantId!);
  res.json(ok(result));
});

export const updateSettings = asyncHandler(async (req, res) => {
  const body = z.object({
    defaultHomepage: z.enum(['/admin', '/cashier']).optional()
  }).parse(req.body);
  const result = await authService.updateSettings(req.user!.id, body.defaultHomepage || null, req.tenantId!);
  res.json(ok(result));
});