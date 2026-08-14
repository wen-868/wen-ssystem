import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as authService from "../../services/admin/auth.service";
import * as mfaService from "../../services/admin/mfa.service";

export const login = asyncHandler(async (req, res) => {
  const body = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  const result = await authService.login(body.username, body.password);
  res.json(ok(result));
});

/** 演示账号登录（免密，仅供产品演示） */
export const demoLogin = asyncHandler(async (_req, res) => {
  const result = await authService.demoLogin();
  res.json(ok(result));
});

/** 服务账号换发 JWT（供运营系统适配层调用，统一工作台方案 §5.4） */
export const serviceToken = asyncHandler(async (req, res) => {
  const body = z
    .object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      tenantId: z.string().optional(),
    })
    .parse(req.body);
  const result = await authService.issueServiceToken(
    body.clientId,
    body.clientSecret,
    body.tenantId,
  );
  res.json(ok(result));
});

export const changePassword = asyncHandler(async (req, res) => {
  const body = z.object({
    oldPassword: z.string(),
    newPassword: z.string()
  }).parse(req.body);
  // 密码强度校验统一由 service 层使用 password.ts 的 validatePassword 完成，
  // 避免与 service 层校验规则不一致（历史 Bug：controller 要求大小写+数字，service 要求字母+数字+特殊字符）
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

// ==================== 双因素认证（MFA，顶级商业软件验收-认证检查项） ====================

/** 获取当前用户 MFA 状态 */
export const getMfaStatus = asyncHandler(async (req, res) => {
  res.json(ok(await mfaService.getMfaStatus(req.user!.id)));
});

/** 发起绑定：返回 Secret 与 otpauth 二维码地址 */
export const setupMfa = asyncHandler(async (req, res) => {
  res.json(ok(await mfaService.setupMfa(req.user!.id)));
});

/** 确认绑定：校验动态码后启用 */
export const confirmMfa = asyncHandler(async (req, res) => {
  const body = z.object({ code: z.string().trim().regex(/^\d{6}$/, "验证码为 6 位数字") }).parse(req.body);
  res.json(ok(await mfaService.confirmMfa(req.user!.id, body.code)));
});

/** 关闭双因素认证 */
export const disableMfa = asyncHandler(async (req, res) => {
  const body = z.object({ code: z.string().trim().regex(/^\d{6}$/, "验证码为 6 位数字") }).parse(req.body);
  res.json(ok(await mfaService.disableMfa(req.user!.id, body.code)));
});

/** 登录二次验证（MFA 挑战令牌 + 动态码 → 完整登录结果；无鉴权，由 server.ts 注册） */
export const verifyMfa = asyncHandler(async (req, res) => {
  const body = z.object({
    mfaToken: z.string().min(1),
    code: z.string().trim().regex(/^\d{6}$/, "验证码为 6 位数字"),
  }).parse(req.body);
  res.json(ok(await mfaService.verifyMfaChallenge(body.mfaToken, body.code)));
});
