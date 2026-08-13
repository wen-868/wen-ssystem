import crypto from "crypto";
import { queryOneWithTenant } from "../shared/db";

/**
 * 支付宝当面付（条码支付/反扫）
 *
 * 场景：收银员用扫码枪扫顾客支付宝付款码，调用 alipay.trade.pay 直接扣款；
 * 返回 WAIT_BUYER_PAY 或系统类错误时轮询 alipay.trade.query 确认最终结果。
 * 官方文档：https://opendocs.alipay.com/open/02ekfg
 */

interface AlipayF2FConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  notifyUrl: string;
}

/** 当面付结果 */
export interface AlipayPayResult {
  success: boolean;
  transactionId?: string;
  tradeStatus?: string;
  errCode?: string;
  errMsg?: string;
}

const GATEWAY = "https://openapi.alipay.com/gateway.do";

/** 读取租户支付宝当面付配置 */
export async function loadAlipayF2FConfig(tenantId: string): Promise<AlipayF2FConfig | null> {
  const row = await queryOneWithTenant(
    `SELECT enabled, app_id, private_key, alipay_public_key, notify_url FROM t_payment_config WHERE provider = 'alipay'`,
    [],
    tenantId
  );
  if (!row || Number(row.enabled) !== 1 || !row.app_id || !row.private_key || !row.alipay_public_key) return null;
  return {
    appId: String(row.app_id),
    privateKey: String(row.private_key),
    alipayPublicKey: String(row.alipay_public_key),
    notifyUrl: String(row.notify_url || ""),
  };
}

/** RSA2 签名：参数升序拼接后 RSA-SHA256，Base64 输出 */
function rsa2Sign(params: Record<string, string>, privateKey: string): string {
  const str = Object.entries(params)
    .filter(([k, v]) => v !== undefined && v !== null && v !== "" && k !== "sign")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(str, "utf8");
  return signer.sign(privateKey, "base64");
}

/** 校验支付宝响应签名 */
function verifySign(params: Record<string, string>, alipayPublicKey: string): boolean {
  const sign = params.sign;
  if (!sign) return false;
  const str = Object.entries(params)
    .filter(([k, v]) => v !== undefined && v !== null && v !== "" && k !== "sign" && k !== "sign_type")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(str, "utf8");
    return verifier.verify(alipayPublicKey, sign, "base64");
  } catch {
    return false;
  }
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function request(method: string, bizContent: Record<string, unknown>, cfg: AlipayF2FConfig): Promise<Record<string, string>> {
  const baseParams: Record<string, string> = {
    app_id: cfg.appId,
    method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(new Date()),
    version: "1.0",
    biz_content: JSON.stringify(bizContent),
  };
  if (cfg.notifyUrl && method === "alipay.trade.pay") baseParams.notify_url = cfg.notifyUrl;
  baseParams.sign = rsa2Sign(baseParams, cfg.privateKey);

  const url = new URL(GATEWAY);
  for (const [k, v] of Object.entries(baseParams)) url.searchParams.set(k, v);
  const response = await fetch(url.toString(), { method: "GET" });
  const data = (await response.json()) as Record<string, unknown>;
  const body = (data[method.replace(".", "_") + "_response"] || {}) as Record<string, string>;
  return { ...body, sign: String(data.sign || "") };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 当面付条码支付（含轮询） */
export async function payByAuthCode(params: {
  tenantId: string;
  outTradeNo: string;
  subject: string;
  amount: number; // 元
  authCode: string;
}): Promise<AlipayPayResult> {
  const cfg = await loadAlipayF2FConfig(params.tenantId);
  if (!cfg) {
    return { success: false, errCode: "CHANNEL_NOT_CONFIGURED", errMsg: "支付宝通道未配置（需启用支付配置并填写应用私钥/支付宝公钥）" };
  }

  const first = await request(
    "alipay.trade.pay",
    {
      out_trade_no: params.outTradeNo,
      scene: "bar_code",
      auth_code: params.authCode,
      subject: params.subject.slice(0, 255),
      total_amount: params.amount.toFixed(2),
      timeout_express: "2m",
    },
    cfg
  );

  // 明确成功
  if (first.code === "10000" && (first.trade_status === "TRADE_SUCCESS" || first.trade_status === "TRADE_FINISHED")) {
    return { success: true, transactionId: first.trade_no, tradeStatus: first.trade_status };
  }
  // 用户等待付款或系统类不确定错误：轮询确认
  if (
    first.code === "10000" ||
    first.sub_code === "ACQ.SYSTEM_ERROR" ||
    first.sub_code === "ACQ.PAYMENT_REQUEST_HAS_RISK"
  ) {
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const q = await request(
        "alipay.trade.query",
        { out_trade_no: params.outTradeNo },
        cfg
      );
      if (q.code === "10000") {
        if (q.trade_status === "TRADE_SUCCESS" || q.trade_status === "TRADE_FINISHED") {
          return { success: true, transactionId: q.trade_no, tradeStatus: q.trade_status };
        }
        if (q.trade_status === "WAIT_BUYER_PAY") continue;
        if (q.trade_status) {
          return { success: false, errCode: q.trade_status, errMsg: "支付未完成（用户取消或超时）" };
        }
      }
    }
    return { success: false, errCode: "PAY_TIMEOUT", errMsg: "用户付款超时，请确认后重试" };
  }
  return { success: false, errCode: first.sub_code || first.code, errMsg: first.sub_msg || first.msg || "当面付失败" };
}

/** 查询订单是否已支付（超时兜底） */
export async function isOrderPaid(tenantId: string, outTradeNo: string): Promise<boolean> {
  const cfg = await loadAlipayF2FConfig(tenantId);
  if (!cfg) return false;
  const q = await request("alipay.trade.query", { out_trade_no: outTradeNo }, cfg);
  return q.code === "10000" && (q.trade_status === "TRADE_SUCCESS" || q.trade_status === "TRADE_FINISHED");
}
