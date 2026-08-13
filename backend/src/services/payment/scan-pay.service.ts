import { queryOneWithTenant } from "../../shared/db";
import * as wechatV2 from "../../config/wechat-pay-v2";
import * as alipayF2F from "../../config/alipay-f2f";
import * as unionpay from "../hardware/unionpay.service";
import { offlinePayment } from "../store/sale-bill.service";

/**
 * 收银台扫码支付（反扫）统一服务
 *
 * 付款码特征（行业通用识别规则）：
 * - 微信：18 位数字，以 10~15 开头
 * - 支付宝：16~24 位数字，以 25~30 开头
 * - 云闪付：19 位数字，以 62 开头（预留）
 * - 收款盒子：服务商激活码/串口（预留）
 */

export type PayChannel = "WECHAT" | "ALIPAY" | "UNIONPAY" | "BOX";

export function detectChannel(authCode: string): PayChannel {
  const code = String(authCode || "").trim();
  if (!/^\d{16,24}$/.test(code)) {
    throw new Error("付款码格式不正确：应为 16~24 位纯数字");
  }
  const prefix2 = code.slice(0, 2);
  const prefix = Number(prefix2);
  const len = code.length;
  if (len === 18 && prefix >= 10 && prefix <= 15) return "WECHAT";
  if (len >= 16 && len <= 24 && prefix >= 25 && prefix <= 30) return "ALIPAY";
  if (len === 19 && prefix2.startsWith("62")) return "UNIONPAY";
  throw new Error("无法识别付款码渠道，请确认是微信/支付宝/云闪付的付款码");
}

/** 渠道中文名 */
export const CHANNEL_LABELS: Record<PayChannel, string> = {
  WECHAT: "微信",
  ALIPAY: "支付宝",
  UNIONPAY: "云闪付",
  BOX: "收款盒子",
};

/** 收银台渠道状态（供前端展示哪些通道可用） */
export async function getPosChannels(tenantId: string) {
  const [wechatRow, alipayRow, boxRow] = await Promise.all([
    queryOneWithTenant(
      `SELECT enabled, app_id, mch_id, api_key FROM t_payment_config WHERE provider = 'wechat'`,
      [],
      tenantId
    ),
    queryOneWithTenant(
      `SELECT enabled, app_id FROM t_payment_config WHERE provider = 'alipay'`,
      [],
      tenantId
    ),
    queryOneWithTenant(
      `SELECT enabled, box_config FROM t_payment_config WHERE provider = 'wechat'`,
      [],
      tenantId
    ),
  ]);

  let boxReady = false;
  let boxProvider = "";
  try {
    const parsed = boxRow?.box_config ? JSON.parse(String(boxRow.box_config)) : null;
    // 盒子启用开关独立存 box_config.enabled，不依赖微信支付行 enabled
    boxReady = parsed?.enabled === true && !!parsed && (!!parsed.activationCode || !!parsed.appId || !!parsed.comPort);
    boxProvider = parsed?.provider || "";
  } catch {
    boxReady = false;
  }

  return {
    wechat: {
      ready: Number(wechatRow?.enabled) === 1 && !!wechatRow?.app_id && !!wechatRow?.mch_id && !!wechatRow?.api_key,
      appId: wechatRow?.app_id || "",
      label: "微信（付款码反扫）",
    },
    alipay: {
      ready: Number(alipayRow?.enabled) === 1 && !!alipayRow?.app_id,
      appId: alipayRow?.app_id || "",
      label: "支付宝（付款码反扫）",
    },
    box: {
      ready: boxReady,
      provider: boxProvider,
      label: "收款盒子（聚合码/串口）",
    },
    hardware: {
      cashDrawer: true,
      scanner: true,
      voice: true,
      label: "钱箱/扫码枪/语音播报",
    },
  };
}

/** 付款码支付统一入口：先识别渠道，再走对应通道，成功后落销售单收款 */
export async function payByCode(params: {
  billNo: string;
  amount: number;
  authCode: string;
  deviceIp?: string;
  userId: number;
  username: string;
  tenantId: string;
}) {
  const { billNo, amount, authCode, deviceIp, userId, username, tenantId } = params;
  const channel = detectChannel(authCode);
  if (channel === "BOX") {
    throw new Error("收款盒子通道未配置，请在总台支付配置中填写服务商激活码/串口参数");
  }

  const subject = `销售单${billNo}`;
  let payResult;
  if (channel === "WECHAT") {
    payResult = await wechatV2.payByAuthCode({
      tenantId,
      outTradeNo: billNo,
      description: subject,
      amount,
      authCode,
      deviceIp,
    });
  } else if (channel === "UNIONPAY") {
    payResult = await unionpay.payByAuthCode({
      tenantId,
      outTradeNo: billNo,
      amount,
      authCode,
    });
  } else {
    payResult = await alipayF2F.payByAuthCode({
      tenantId,
      outTradeNo: billNo,
      subject,
      amount,
      authCode,
    });
  }

  // 通道明确失败：兜底确认订单是否已支付（避免重复扣款后误报失败）
  if (!payResult.success) {
    const paid =
      channel === "WECHAT"
        ? await wechatV2.isOrderPaid(tenantId, billNo)
        : channel === "UNIONPAY"
          ? await unionpay.isOrderPaid(tenantId, billNo)
          : await alipayF2F.isOrderPaid(tenantId, billNo);
    if (!paid) {
      throw new Error(payResult.errMsg || "扫码支付失败，请重试");
    }
  }

  // 支付成功：落销售单收款（更新应收/实收、写支付流水、扣减库存）
  const recorded = await offlinePayment({
    billNo,
    amount,
    paymentMethod: channel,
    remark: `扫码收款（${CHANNEL_LABELS[channel]}）`,
    transactionId: payResult.transactionId || "",
    authCode,
    userId,
    username,
    tenantId,
  });
  return {
    ...recorded,
    channel,
    channelLabel: CHANNEL_LABELS[channel],
    transactionId: payResult.transactionId || "",
    authCode: maskAuthCode(authCode),
  };
}

/** 付款码脱敏（仅保留前 6 后 4，供留痕展示） */
export function maskAuthCode(authCode: string): string {
  const code = String(authCode || "").trim();
  if (code.length <= 10) return "****";
  return `${code.slice(0, 6)}****${code.slice(-4)}`;
}
