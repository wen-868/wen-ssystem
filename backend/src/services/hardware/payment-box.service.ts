import crypto from "crypto";
import { queryOneWithTenant, executeWithTenant } from "../../shared/db";
import { offlinePayment } from "../store/sale-bill.service";

/**
 * 收款盒子（聚合收款）
 *
 * 两种主流通道：
 * 1. HTTP 通道：服务商提供接口地址 + 激活码/应用ID，金额下发、顾客扫码、服务商回调；
 * 2. 串口联动：激活码/串口号 + 命令模板（hex，{amount} 占位），经本地打印助手写入。
 *
 * 配置存 t_payment_config 微信配置行的 box_config（与支付配置页保持一致）。
 */

export interface BoxConfig {
  /** 盒子启用开关（独立存 box_config.enabled，不占用微信支付行 enabled） */
  enabled?: boolean;
  provider?: string;
  activationCode?: string;
  appId?: string;
  comPort?: string;
  apiUrl?: string;
  secret?: string;
  /** 串口命令模板（hex，{amount} 为金额占位），如 7B22616D6F756E74223A7B616D6F756E747D7D */
  commandTemplate?: string;
}

async function getBoxConfig(tenantId: string): Promise<{ enabled: boolean; config: BoxConfig }> {
  const row = await queryOneWithTenant(
    `SELECT enabled, box_config FROM t_payment_config WHERE provider = 'wechat'`,
    [],
    tenantId
  );
  if (!row) return { enabled: false, config: {} };
  let config: BoxConfig = {};
  try {
    config = row.box_config ? JSON.parse(row.box_config) : {};
  } catch { /* 忽略 */ }
  // 盒子启用开关独立存 box_config.enabled，不占用微信支付行 enabled
  return { enabled: config.enabled === true, config };
}

/** 收银台读取盒子配置（脱敏） */
export async function getBoxConfigPublic(tenantId: string) {
  const { enabled, config } = await getBoxConfig(tenantId);
  const mask = (v: string | undefined) =>
    v && v.length > 8 ? `${v.slice(0, 4)}****${v.slice(-4)}` : v ? "****" : "";
  return {
    enabled,
    config: {
      provider: config.provider || "",
      activationCode: mask(config.activationCode),
      appId: config.appId || "",
      comPort: config.comPort || "",
      apiUrl: config.apiUrl || "",
      commandTemplate: config.commandTemplate || "",
    },
  };
}

/** 收银台保存盒子配置（只写 box_config，启用开关进 JSON） */
export async function saveBoxConfig(tenantId: string, config: BoxConfig, enabled: boolean) {
  const row = await queryOneWithTenant(
    `SELECT id FROM t_payment_config WHERE provider = 'wechat'`,
    [],
    tenantId
  );
  if (!row) throw new Error("微信支付配置不存在，请先保存微信支付配置");
  const merged: BoxConfig = { ...config, enabled };
  await executeWithTenant(
    `UPDATE t_payment_config SET box_config = ?, updated_at = NOW() WHERE provider = 'wechat'`,
    [JSON.stringify(merged)],
    tenantId
  );
  return { success: true, enabled };
}

/** 生成 HTTP 通道报文（通用 JSON + 签名，服务商确定后扩展） */
function buildPayload(cfg: BoxConfig, params: { amount: number; orderNo: string; subject: string }) {
  const payload: Record<string, unknown> = {
    type: "CREATE_PAYMENT",
    activationCode: cfg.activationCode || "",
    appId: cfg.appId || "",
    orderNo: params.orderNo,
    amount: params.amount,
    subject: params.subject,
    time: Math.floor(Date.now() / 1000),
  };
  if (cfg.secret) {
    payload.sign = crypto
      .createHash("md5")
      .update(`${params.orderNo}|${params.amount}|${cfg.secret}`)
      .digest("hex");
  }
  return payload;
}

/** 发起收款盒子支付（HTTP 通道下发金额；串口通道返回本地指令） */
export async function createBoxPayment(params: {
  tenantId: string;
  amount: number;
  orderNo: string;
  subject: string;
}): Promise<{ success: boolean; mode?: "HTTP" | "SERIAL"; reason?: string; detail?: unknown }> {
  const { enabled, config } = await getBoxConfig(params.tenantId);
  if (!enabled || (!config.apiUrl && !config.comPort)) {
    return { success: false, reason: "收款盒子未配置（需启用并填写 HTTP 接口或串口参数）" };
  }
  // 串口联动：返回命令模板供本地助手写入
  if (!config.apiUrl && config.comPort) {
    return {
      success: true,
      mode: "SERIAL",
      detail: {
        comPort: config.comPort,
        commandTemplate: config.commandTemplate || "",
        amount: params.amount,
        orderNo: params.orderNo,
      },
    };
  }
  try {
    const response = await fetch(config.apiUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(config, params)),
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    let detail: unknown = text;
    try { detail = JSON.parse(text); } catch { /* 保留原文 */ }
    return { success: response.ok, mode: "HTTP", reason: response.ok ? undefined : `收款盒子返回 ${response.status}`, detail };
  } catch (e) {
    return { success: false, mode: "HTTP", reason: e instanceof Error ? e.message : String(e) };
  }
}

/** 收款盒子回调：顾客扫码支付完成后由服务商回调，成功后落销售单收款 */
export async function handleBoxCallback(params: {
  tenantId: string;
  body: Record<string, unknown>;
}): Promise<{ success: boolean; reason?: string; orderNo?: string; amount?: number }> {
  const body = params.body || {};
  const orderNo = String(body.outTradeNo || body.orderNo || body.billNo || "");
  const amount = Number(body.amount ?? body.totalAmount ?? 0);
  const status = String(body.status || body.tradeStatus || "");
  const transactionId = String(body.transactionId || body.tradeNo || "");
  const paid = status === "SUCCESS" || status === "PAID" || status === "TRADE_SUCCESS" || Number(body.paid ?? 0) === 1;
  if (!orderNo || !amount || amount <= 0) {
    return { success: false, reason: "回调缺少单号或金额" };
  }
  if (!paid) {
    return { success: false, reason: `收款盒子返回未支付状态：${status || "未知"}` };
  }
  await offlinePayment({
    billNo: orderNo,
    amount,
    paymentMethod: "BOX",
    remark: "收款盒子（聚合收款）",
    transactionId,
    userId: 0,
    username: "收款盒子",
    tenantId: params.tenantId,
  });
  return { success: true, orderNo, amount };
}
