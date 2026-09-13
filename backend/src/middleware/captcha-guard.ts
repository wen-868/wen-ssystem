/**
 * 图形验证码校验中间件（R101-S2-01 裁定 4.1）
 *
 * 挂在平台登录路由上，位于业务处理之前。
 * 校验失败抛 AppError(400)，由 errorHandler 统一转成
 * HTTP 400 + { code: "400", msg: "<中文原因>" }，前端可直接上屏。
 *
 * 设计取舍：
 *  - 校验放在中间件而非 controller —— controller（platformLogin）签名与调用方式零改动，
 *    既有 controller 单测无需修改；只有经过路由链的集成测试需要 mock 本模块。
 *  - 缺参数 / 已失效 / 不匹配分别给不同中文文案，便于用户区分「没填」和「填错了」。
 *  - 校验失败时该验证码已被消耗（一次性），提示语明确引导重新获取。
 */

import type { RequestHandler } from "express";
import { AppError } from "../shared/app-error";
import { verifyCaptcha, type CaptchaVerifyReason } from "../services/platform/captcha.service";

/** 校验失败原因 → 面向用户的中文文案 */
const REASON_TEXT: Record<CaptchaVerifyReason, string> = {
  ok: "",
  missing: "请输入图形验证码",
  expired: "图形验证码已失效，请点击图片重新获取",
  mismatch: "图形验证码错误",
};

/** 业务体里读取的两个字段（前端 PlatformLogin.vue 提交） */
interface CaptchaPayload {
  captchaId?: unknown;
  captcha?: unknown;
}

export const requireCaptcha: RequestHandler = async (req, _res, next) => {
  try {
    const { captchaId, captcha } = (req.body ?? {}) as CaptchaPayload;
    const result = await verifyCaptcha(captchaId, captcha);
    if (!result.ok) {
      next(new AppError(REASON_TEXT[result.reason] || "图形验证码错误", 400));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};
