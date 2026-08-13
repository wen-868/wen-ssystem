import crypto from "crypto";
import { HardwareConfigService } from "./hardware-config.service";

/**
 * 云喇叭 / 收款播报器
 *
 * 通用 HTTP 通道：租户在「收银硬件」配置服务商接口地址（apiUrl）、设备号
 * （deviceId）、密钥（secret）后，收款成功即调用播报；服务商可回调
 * /api/store/hardware/callbacks/cloud-speaker 确认。
 * 各服务商（银盛/随行付/云喇叭厂商）报文格式不同，本服务以通用 JSON 为基线，
 * 服务商确定后在 buildPayload 中按需扩展。
 */

export interface CloudSpeakerConfig {
  provider?: string;
  apiUrl?: string;
  deviceId?: string;
  secret?: string;
  extra?: Record<string, unknown>;
}

function buildPayload(cfg: CloudSpeakerConfig, params: { amount: number; orderNo: string; channel: string }) {
  const payload: Record<string, unknown> = {
    type: "PAY_ANNOUNCE",
    deviceId: cfg.deviceId || "",
    provider: cfg.provider || "",
    amount: params.amount,
    orderNo: params.orderNo,
    channel: params.channel,
    time: Math.floor(Date.now() / 1000),
  };
  // 通用签名：md5(amount|orderNo|secret)，服务商有自定义签名可在此扩展
  if (cfg.secret) {
    payload.sign = crypto
      .createHash("md5")
      .update(`${params.amount}|${params.orderNo}|${cfg.secret}`)
      .digest("hex");
  }
  return { ...payload, ...(cfg.extra || {}) };
}

/** 收款成功后向云喇叭发起播报 */
export async function announce(params: {
  tenantId: string;
  amount: number;
  orderNo: string;
  channel: string;
}): Promise<{ success: boolean; reason?: string; detail?: unknown }> {
  const { enabled, config } = await HardwareConfigService.getRawConfig(params.tenantId, "cloud_speaker");
  const cfg = config as CloudSpeakerConfig;
  if (!enabled || !cfg.apiUrl) {
    return { success: false, reason: "云喇叭未配置或未启用" };
  }
  try {
    const response = await fetch(cfg.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(cfg, params)),
      signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    let detail: unknown = text;
    try { detail = JSON.parse(text); } catch { /* 保留原文 */ }
    return { success: response.ok, reason: response.ok ? undefined : `云喇叭返回 ${response.status}`, detail };
  } catch (e) {
    return { success: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** 云喇叭回调（服务商播报结果确认），接口预留 */
export async function handleCallback(tenantId: string, body: unknown) {
  return {
    success: true,
    received: true,
    tenantId,
    body,
  };
}
