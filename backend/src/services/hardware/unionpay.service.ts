import crypto from "crypto";
import { HardwareConfigService } from "./hardware-config.service";

/**
 * 云闪付付款码（反扫）
 *
 * 银联/聚合服务商网关适配：租户在「收银硬件 → 云闪付」填写网关地址
 * （gatewayUrl）、商户号（mchId）、密钥（apiKey）后，收银台扫云闪付
 * 付款码（62 开头 19 位）即调本通道扣款。报文为通用 JSON + MD5 签名，
 * 服务商确定后按需扩展字段。
 */

export interface UnionpayConfig {
  gatewayUrl?: string;
  mchId?: string;
  apiKey?: string;
  provider?: string;
}

export interface UnionpayPayResult {
  success: boolean;
  transactionId?: string;
  errCode?: string;
  errMsg?: string;
}

async function loadConfig(tenantId: string): Promise<{ enabled: boolean; config: UnionpayConfig }> {
  return HardwareConfigService.getRawConfig(tenantId, "unionpay");
}

function buildPayload(cfg: UnionpayConfig, params: { outTradeNo: string; amount: number; authCode: string }) {
  const payload: Record<string, unknown> = {
    type: "MICROPAY",
    mchId: cfg.mchId || "",
    outTradeNo: params.outTradeNo,
    amount: params.amount,
    authCode: params.authCode,
    time: Math.floor(Date.now() / 1000),
  };
  if (cfg.apiKey) {
    payload.sign = crypto
      .createHash("md5")
      .update(`${params.outTradeNo}|${params.amount}|${params.authCode}|${cfg.apiKey}`)
      .digest("hex");
  }
  return payload;
}

/** 云闪付付款码支付 */
export async function payByAuthCode(params: {
  tenantId: string;
  outTradeNo: string;
  amount: number;
  authCode: string;
}): Promise<UnionpayPayResult> {
  const { enabled, config } = await loadConfig(params.tenantId);
  if (!enabled || !config.gatewayUrl || !config.mchId || !config.apiKey) {
    return { success: false, errCode: "CHANNEL_NOT_CONFIGURED", errMsg: "云闪付通道未配置（需在收银硬件中填写网关地址/商户号/密钥并启用）" };
  }
  try {
    const response = await fetch(config.gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(config, params)),
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { /* 非 JSON */ }
    const success = response.ok && (data.success === true || data.code === "SUCCESS" || data.code === "0");
    if (success) {
      return { success: true, transactionId: String(data.transactionId || data.tradeNo || "") };
    }
    return {
      success: false,
      errCode: String(data.code || data.errCode || response.status),
      errMsg: String(data.msg || data.errMsg || data.message || `云闪付网关返回 ${response.status}`),
    };
  } catch (e) {
    return { success: false, errCode: "NETWORK_ERROR", errMsg: e instanceof Error ? e.message : String(e) };
  }
}

/** 订单已支付查询（超时/重试兜底） */
export async function isOrderPaid(tenantId: string, outTradeNo: string): Promise<boolean> {
  const { enabled, config } = await loadConfig(tenantId);
  if (!enabled || !config.gatewayUrl || !config.apiKey) return false;
  try {
    const payload: Record<string, unknown> = {
      type: "QUERY",
      mchId: config.mchId || "",
      outTradeNo,
      time: Math.floor(Date.now() / 1000),
    };
    payload.sign = crypto
      .createHash("md5")
      .update(`${outTradeNo}|${config.apiKey}`)
      .digest("hex");
    const response = await fetch(config.gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return response.ok && (data.success === true || data.tradeStatus === "SUCCESS" || data.status === "PAID");
  } catch {
    return false;
  }
}
