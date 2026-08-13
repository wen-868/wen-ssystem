import crypto from "crypto";
import { queryOneWithTenant } from "../shared/db";

/**
 * 微信支付 APIv2 付款码支付（收银台反扫）
 *
 * 场景：收银员用扫码枪扫顾客付款码（微信 18 位数字），商户后台调
 * /pay/micropay 直接扣款；用户未输密码时返回 USERPAYING，需轮询
 * /pay/orderquery 直到 SUCCESS/失败。官方文档：
 * https://pay.weixin.qq.com/doc/v3/merchant/4012382150
 */

interface V2Config {
  appId: string;
  mchId: string;
  apiKey: string;
}

/** 付款码支付结果 */
export interface MicroPayResult {
  success: boolean;
  transactionId?: string;
  openid?: string;
  errCode?: string;
  errMsg?: string;
}

/** 读取租户微信支付 APIv2 配置（付款码支付仅需 app_id/mch_id/api_key） */
export async function loadWechatV2Config(tenantId: string): Promise<V2Config | null> {
  const row = await queryOneWithTenant(
    `SELECT enabled, app_id, mch_id, api_key FROM t_payment_config WHERE provider = 'wechat'`,
    [],
    tenantId
  );
  if (!row || Number(row.enabled) !== 1 || !row.app_id || !row.mch_id) return null;
  const apiKey = String(row.api_key || "");
  if (!apiKey) return null;
  return { appId: String(row.app_id), mchId: String(row.mch_id), apiKey };
}

/** 极简 XML 编码（V2 报文结构固定，无需完整解析器） */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildXml(map: Record<string, string>): string {
  const parts = Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<${k}><![CDATA[${escapeXml(v)}]]></${k}>`);
  return `<xml>${parts.join("")}</xml>`;
}

/** 极简 XML 解析：只取叶节点文本（微信 V2 响应为扁平结构，无嵌套） */
export function parseXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  // 分支1：CDATA 包裹（微信 V2 标准）；分支2：纯文本叶节点
  const regex = /<([A-Za-z_][\w-]*)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>|<([A-Za-z_][\w-]*)>([^<]*)<\/\3>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] ?? match[4] ?? "";
    if (!(key in result)) result[key] = value;
  }
  return result;
}

/** V2 签名：参数按 key 升序拼接，末尾 &key=APIv2密钥，MD5 大写 */
export function signV2(params: Record<string, string>, apiKey: string): string {
  const str = Object.entries(params)
    .filter(([k, v]) => v !== undefined && v !== null && v !== "" && k !== "sign")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return crypto.createHash("md5").update(`${str}&key=${apiKey}`).digest("hex").toUpperCase();
}

function nonceStr(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function postV2(url: string, params: Record<string, string>, apiKey: string): Promise<Record<string, string>> {
  const sign = signV2(params, apiKey);
  const body = buildXml({ ...params, sign });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body,
  });
  const text = await response.text();
  const parsed = parseXml(text);
  if (!parsed.return_code) throw new Error("微信支付返回异常");
  return parsed;
}

/** 付款码支付（反扫）：单次发起 */
async function microPay(params: {
  cfg: V2Config;
  outTradeNo: string;
  description: string;
  amount: number; // 元
  authCode: string;
  deviceIp?: string;
}): Promise<Record<string, string>> {
  const { cfg, outTradeNo, description, amount, authCode, deviceIp } = params;
  return postV2(
    "https://api.mch.weixin.qq.com/pay/micropay",
    {
      appid: cfg.appId,
      mch_id: cfg.mchId,
      nonce_str: nonceStr(),
      body: description.slice(0, 127),
      out_trade_no: outTradeNo,
      total_fee: String(Math.round(amount * 100)),
      fee_type: "CNY",
      spbill_create_ip: deviceIp || "127.0.0.1",
      auth_code: authCode,
    },
    cfg.apiKey
  );
}

/** 订单查询（USERPAYING 轮询用） */
async function queryOrder(cfg: V2Config, outTradeNo: string): Promise<Record<string, string>> {
  return postV2(
    "https://api.mch.weixin.qq.com/pay/orderquery",
    {
      appid: cfg.appId,
      mch_id: cfg.mchId,
      nonce_str: nonceStr(),
      out_trade_no: outTradeNo,
    },
    cfg.apiKey
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 付款码支付（含轮询）
 *
 * 轮询规则（官方）：USERPAYING 表示用户正在输入密码，需每 2~3 秒
 * 查询订单，最长 20 秒左右；SUCCESS 即支付成功。
 */
export async function payByAuthCode(params: {
  tenantId: string;
  outTradeNo: string;
  description: string;
  amount: number;
  authCode: string;
  deviceIp?: string;
}): Promise<MicroPayResult> {
  const cfg = await loadWechatV2Config(params.tenantId);
  if (!cfg) {
    return { success: false, errCode: "CHANNEL_NOT_CONFIGURED", errMsg: "微信支付通道未配置（需启用支付配置并填写 APIv2 密钥）" };
  }

  const first = await microPay({ cfg, ...params });
  if (first.return_code !== "SUCCESS") {
    return { success: false, errCode: first.return_code, errMsg: first.return_msg || "微信支付通信失败" };
  }
  if (first.result_code === "SUCCESS") {
    return { success: true, transactionId: first.transaction_id, openid: first.openid };
  }
  // 用户正在输入密码：轮询订单
  if (first.err_code === "USERPAYING" || first.err_code === "SYSTEMERROR") {
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const q = await queryOrder(cfg, params.outTradeNo);
      if (q.return_code !== "SUCCESS") continue;
      if (q.result_code !== "SUCCESS") {
        return { success: false, errCode: q.err_code, errMsg: q.err_code_des || "订单查询失败" };
      }
      if (q.trade_state === "SUCCESS") {
        return { success: true, transactionId: q.transaction_id, openid: q.openid };
      }
      if (q.trade_state === "PAYERROR" || q.trade_state === "CLOSED" || q.trade_state === "REVOKED") {
        return { success: false, errCode: q.trade_state, errMsg: q.trade_state_desc || "支付未完成" };
      }
    }
    return { success: false, errCode: "PAY_TIMEOUT", errMsg: "用户付款超时，请确认后重试" };
  }
  return { success: false, errCode: first.err_code, errMsg: first.err_code_des || first.return_msg || "付款码支付失败" };
}

/** 判断订单是否已支付（重试/超时兜底，避免重复扣款） */
export async function isOrderPaid(tenantId: string, outTradeNo: string): Promise<boolean> {
  const cfg = await loadWechatV2Config(tenantId);
  if (!cfg) return false;
  const q = await queryOrder(cfg, outTradeNo);
  return q.return_code === "SUCCESS" && q.result_code === "SUCCESS" && q.trade_state === "SUCCESS";
}
