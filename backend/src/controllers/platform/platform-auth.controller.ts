import { z } from "zod";
import { ok } from "../../shared/response";
import * as platformAuthService from "../../services/platform/platform-auth.service";
import * as platformMfaService from "../../services/platform/platform-mfa.service";
import { createCaptcha } from "../../services/platform/captcha.service";

/**
 * 下发图形验证码（R101-S2-01 裁定 4.1）
 * 返回 { captchaId, image(data URI), expiresIn }；校验在 requireCaptcha 中间件完成。
 */
export async function getCaptcha(_req: any, res: any) {
  const result = await createCaptcha();
  res.json(ok(result));
}

export async function platformLogin(req: any, res: any) {
  const result = await platformAuthService.login(req.body.username, req.body.password);
  res.json(ok(result));
}

export async function getPlatformMe(req: any, res: any) {
  const result = await platformAuthService.getMe(req.user.id);
  res.json(ok(result));
}

export async function createPlatformAdmin(req: any, res: any) {
  const result = await platformAuthService.createAdmin(req.body);
  res.json(ok(result));
}

// ==================== 平台管理员双因素认证（MFA，S3-58-F1 R3） ====================
// 与租户端 /api/admin/auth/mfa/* 同样的四件套 + 登录二次验证，但操作 t_platform_admin。
// 默认不强制开启；密钥/动态码不进日志。

/** 获取当前平台管理员 MFA 状态 */
export async function getPlatformMfaStatus(req: any, res: any) {
  res.json(ok(await platformMfaService.getMfaStatus(req.user.id)));
}

/** 发起绑定：返回 Secret 与 otpauth 二维码地址 */
export async function setupPlatformMfa(req: any, res: any) {
  res.json(ok(await platformMfaService.setupMfa(req.user.id)));
}

/** 确认绑定：校验动态码后启用 */
export async function confirmPlatformMfa(req: any, res: any) {
  const body = z.object({ code: z.string().trim().regex(/^\d{6}$/, "验证码为 6 位数字") }).parse(req.body);
  res.json(ok(await platformMfaService.confirmMfa(req.user.id, body.code)));
}

/** 关闭双因素认证 */
export async function disablePlatformMfa(req: any, res: any) {
  const body = z.object({ code: z.string().trim().regex(/^\d{6}$/, "验证码为 6 位数字") }).parse(req.body);
  res.json(ok(await platformMfaService.disableMfa(req.user.id, body.code)));
}

/** 登录二次验证（MFA 挑战令牌 + 动态码 → 完整登录结果；无鉴权，登录链路的一部分） */
export async function verifyPlatformMfa(req: any, res: any) {
  const body = z
    .object({
      mfaToken: z.string().min(1),
      code: z.string().trim().regex(/^\d{6}$/, "验证码为 6 位数字"),
    })
    .parse(req.body);
  res.json(ok(await platformMfaService.verifyMfaChallenge(body.mfaToken, body.code)));
}
