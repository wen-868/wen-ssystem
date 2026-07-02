import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import { isProviderReady } from "../../services/admin/payment-config.service.js";

/**
 * 支付前置检查中间件：确保支付渠道已配置
 * 用于销售收款等支付触发点
 */
export const requirePaymentReady = asyncHandler(async (req: any, res: any, next: any) => {
  const provider = req.body.provider || req.query.provider || "wechat_pay";
  const ready = await isProviderReady(req.tenantId!, provider);
  if (!ready) {
    res.status(400).json({
      code: "PAYMENT_NOT_CONFIGURED",
      message: "请先配置微信支付",
      provider: "wechat_pay",
    });
    return;
  }
  next();
});