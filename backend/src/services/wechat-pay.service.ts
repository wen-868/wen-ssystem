import crypto from "node:crypto";
import { queryOneWithTenant } from "../shared/db";

/** 微信支付配置（t_payment_config provider=wechat） */
interface WechatPayConfig {
  app_id: string;
  mch_id: string;
  api_v3_key: string;
  private_key: string;
  serial_no: string;
  notify_url: string;
  enabled: number;
}

/** 读微信支付配置，缺失/未启用抛错 */
export async function getWechatPayConfig(tenantId: string): Promise<WechatPayConfig> {
  const cfg = await queryOneWithTenant<WechatPayConfig & { enabled: number | string }>(
    `SELECT app_id, mch_id, api_v3_key, private_key, serial_no, notify_url, enabled
     FROM t_payment_config WHERE provider = 'wechat' AND tenant_id = ?`,
    [tenantId],
    tenantId
  );
  if (!cfg || Number(cfg.enabled) !== 1) {
    throw Object.assign(new Error("微信支付未启用，请在系统设置-支付配置中完成商户配置"), { statusCode: 400 });
  }
  const missing: string[] = [];
  for (const key of ["app_id", "mch_id", "api_v3_key", "private_key", "serial_no"] as const) {
    if (!cfg[key]) missing.push(key);
  }
  if (missing.length > 0) {
    throw Object.assign(new Error(`微信支付配置不完整：缺少 ${missing.join("、")}`), { statusCode: 400 });
  }
  return cfg;
}

/** RSA-SHA256 签名 */
function rsaSign(privateKeyPem: string, message: string): string {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  sign.end();
  return sign.sign(privateKeyPem, "base64");
}

/** API v3 请求签名串 */
function buildSignStr(method: string, urlPath: string, timestamp: string, nonce: string, body: string): string {
  return `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
}

/** 组装 API v3 Authorization 头 */
function buildAuthHeader(cfg: WechatPayConfig, method: string, urlPath: string, body: string): string {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString("hex");
  const signStr = buildSignStr(method, urlPath, timestamp, nonce, body);
  const signature = rsaSign(cfg.private_key, signStr);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mch_id}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serial_no}"`;
}

/**
 * 微信 JSAPI 下单，返回前端 wx.requestPayment 所需参数
 */
export async function createJsapiPayment(params: {
  tenantId: string;
  openid: string;
  orderNo: string;
  amountYuan: number;
  description: string;
}): Promise<{
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA";
  paySign: string;
  prepayId: string;
}> {
  const cfg = await getWechatPayConfig(params.tenantId);
  const urlPath = "/v3/pay/transactions/jsapi";
  const bodyObj = {
    appid: cfg.app_id,
    mchid: cfg.mch_id,
    description: params.description.slice(0, 127),
    out_trade_no: params.orderNo,
    notify_url: cfg.notify_url || `https://api.onepan.cn/api/miniapp/pay/notify`,
    amount: { total: Math.round(params.amountYuan * 100) },
    payer: { openid: params.openid },
  };
  const body = JSON.stringify(bodyObj);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: buildAuthHeader(cfg, "POST", urlPath, body),
    "User-Agent": "zhixiang-liquor/0.1.0",
  };
  const resp = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });
  const text = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`微信支付下单失败：HTTP ${resp.status} ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    throw new Error(`微信支付下单失败：${data.message || data.code || `HTTP ${resp.status}`}`);
  }
  const prepayId = String(data.prepay_id || "");
  if (!prepayId) {
    throw new Error("微信支付下单失败：响应缺少 prepay_id");
  }

  // 组装 JSAPI 调起参数（paySign 用商户私钥签名）
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const pkg = `prepay_id=${prepayId}`;
  const paySignStr = `${cfg.app_id}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const paySign = rsaSign(cfg.private_key, paySignStr);

  return {
    appId: cfg.app_id,
    timeStamp,
    nonceStr,
    package: pkg,
    signType: "RSA",
    paySign,
    prepayId,
  };
}

/** 查询微信支付订单（对账/查单） */
export async function queryWechatPayOrder(tenantId: string, orderNo: string): Promise<{ trade_state: string }> {
  const cfg = await getWechatPayConfig(tenantId);
  const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${cfg.mch_id}`;
  const resp = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: buildAuthHeader(cfg, "GET", urlPath, ""),
      "User-Agent": "zhixiang-liquor/0.1.0",
    },
    signal: AbortSignal.timeout(10000),
  });
  const text = await resp.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`微信查单失败：HTTP ${resp.status} ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    throw new Error(`微信查单失败：${data.message || data.code || `HTTP ${resp.status}`}`);
  }
  return { trade_state: String(data.trade_state || "UNKNOWN") };
}
