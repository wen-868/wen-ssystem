import { ok } from "../../shared/response";
import * as platformAuthService from "../../services/platform/platform-auth.service";
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
