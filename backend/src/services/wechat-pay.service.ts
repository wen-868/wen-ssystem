import crypto from "node:crypto";
import { query, queryOneWithTenant } from "../shared/db";

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

/** AES-256-GCM 解密微信支付回调 resource（key = APIv3 密钥） */
function decryptResource(
  apiV3Key: string,
  resource: { ciphertext: string; nonce: string; associated_data?: string }
): Record<string, unknown> {
  const key = Buffer.from(apiV3Key, "utf8");
  const nonce = Buffer.from(resource.nonce, "utf8");
  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  const aad = Buffer.from(resource.associated_data || "", "utf8");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad);
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(plain);
}

/**
 * 微信支付回调处理（API v3 通知）
 * 微信回调不携带租户头，resource 密文用商户 api_v3_key 加密——轮询所有启用微信支付的租户密钥尝试解密，
 * 解密成功即定位订单所属租户（解密失败 = 密钥不符，来源不可信）。
 * 返回 { code: "SUCCESS" } 表示已受理（微信停止重试）；其他抛错返回 500 触发重试。
 */
export async function handlePayNotify(params: {
  body: Record<string, unknown>;
}): Promise<{ code: string; message?: string }> {
  const resource = (params.body as { resource?: { ciphertext?: string; nonce?: string; associated_data?: string } }).resource;
  if (!resource?.ciphertext || !resource.nonce) {
    throw new Error("回调缺少 resource 密文");
  }
  const tenants = await query<{ tenant_id: string; api_v3_key: string }>(
    `SELECT tenant_id, api_v3_key FROM t_payment_config
     WHERE provider = 'wechat' AND enabled = 1 AND api_v3_key <> ''`
  );
  if (!tenants || tenants.length === 0) {
    throw new Error("无启用微信支付的租户配置，拒绝回调");
  }

  let decrypted: Record<string, unknown> | null = null;
  let matchedTenant = "";
  for (const t of tenants) {
    try {
      decrypted = decryptResource(t.api_v3_key, {
        ciphertext: resource.ciphertext,
        nonce: resource.nonce,
        associated_data: resource.associated_data,
      });
      matchedTenant = t.tenant_id;
      break;
    } catch {
      // 密钥不符，尝试下一个租户
    }
  }
  if (!decrypted) {
    throw new Error("微信回调解密失败（api_v3_key 不匹配或来源不可信）");
  }

  const outTradeNo = String(decrypted.out_trade_no || "");
  const tradeState = String(decrypted.trade_state || "");
  if (!outTradeNo || tradeState !== "SUCCESS") {
    return { code: "SUCCESS", message: "非成功交易，忽略" };
  }
  const { markOrderPaid } = await import("./miniapp.service");
  await markOrderPaid(outTradeNo, matchedTenant);
  return { code: "SUCCESS" };
}
