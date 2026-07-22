import { query, queryOne, transaction } from "../../shared/db";
import type { ResultSetHeader } from "mysql2/promise";
import { makeBizNo } from "../../shared/id";
import { env } from "../../shared/env";
import type { WechatPay } from "../../shared/wechat-pay";

// ==================== 类型定义 ====================

/** 支付订单原始行 */
interface PaymentOrderRawRow {
  id: number;
  pay_no: string;
  source_type: string;
  source_no: string;
  channel: string;
  amount: number | string;
  paid_amount: number | string | null;
  transaction_id: string | null;
  status: string;
  tenant_id: string;
  paid_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 支付订单简要行 */
interface PaymentOrderBriefRow {
  amount: number | string;
  status: string;
  transaction_id: string | null;
}

export async function createPaymentOrder(
  body: { sourceType: string; sourceNo: string; amount: number; openid?: string; description?: string },
  tenantId: string,
  wechatPay: WechatPay
) {
  const payNo = makeBizNo("ZF");

  await query(
    `INSERT INTO t_payment_order (pay_no, source_type, source_no, channel, amount, status, tenant_id)
     VALUES (?, ?, ?, 'WECHAT', ?, 'PENDING', ?)`,
    [payNo, body.sourceType, body.sourceNo, body.amount, tenantId]
  );

  if (!body.openid) {
    return {
      payNo,
      appId: env.WECHAT_APP_ID,
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: makeBizNo("NC"),
      package: "prepay_id=dev",
      signType: "RSA",
      paySign: "dev-sign",
      sourceType: body.sourceType,
      sourceNo: body.sourceNo,
      amount: body.amount
    };
  }

  const { prepayId, paySign, timeStamp, nonceStr } = await wechatPay.createJsapiOrder({
    outTradeNo: payNo,
    description: body.description || `支付订单 ${payNo}`,
    amount: body.amount,
    openid: body.openid,
    attach: JSON.stringify({ sourceType: body.sourceType, sourceNo: body.sourceNo, tenantId })
  });

  return {
    payNo,
    appId: env.WECHAT_APP_ID,
    timeStamp,
    nonceStr,
    package: `prepay_id=${prepayId}`,
    signType: "RSA",
    paySign,
    sourceType: body.sourceType,
    sourceNo: body.sourceNo,
    amount: body.amount
  };
}

export async function handleWxCallback(
  headers: Record<string, string>,
  body: any,
  wechatPay: WechatPay
) {
  if (!wechatPay.verifyNotifySignature(headers, JSON.stringify(body))) {
    return { success: false, code: "400", message: "签名验证失败" };
  }

  const resource = body.resource;
  let notifyData: any;

  try {
    notifyData = JSON.parse(wechatPay.decryptNotifyData(
      resource.associated_data,
      resource.nonce,
      resource.ciphertext
    ));
  } catch {
    return { success: false, code: "400", message: "数据解密失败" };
  }

  const { out_trade_no, transaction_id, trade_state, amount } = notifyData;

  if (trade_state === 'SUCCESS') {
    await transaction(async (conn) => {
      await conn.execute(
        "UPDATE t_payment_order SET status = 'PAID', transaction_id = ?, paid_amount = ?, paid_at = NOW() WHERE pay_no = ?",
        [transaction_id, amount.total / 100, out_trade_no]
      );

      const order = await conn.execute(
        "SELECT source_type, source_no FROM t_payment_order WHERE pay_no = ?",
        [out_trade_no]
      );

      if ((order[0] as any) && (order[0] as any).length > 0) {
        const { source_type, source_no } = (order[0] as any)[0];

        if (source_type === 'SALE_BILL') {
          await conn.execute(
            "UPDATE t_sale_bill SET status = 'PAID' WHERE bill_no = ?",
            [source_no]
          );
        } else if (source_type === 'MINIAPP_ORDER') {
          await conn.execute(
            "UPDATE t_miniapp_order SET order_status = 'PAID' WHERE order_no = ?",
            [source_no]
          );
        } else if (source_type === 'COLLECTION_LINK') {
          await conn.execute(
            "UPDATE t_collection_link SET paid_amount = paid_amount + ?, status = 'PAID' WHERE link_no = ?",
            [amount.total / 100, source_no]
          );
        }
      }
    });
  }

  return { success: true, code: "SUCCESS", message: "成功" };
}

export async function createRefund(
  body: { payNo: string; amount: number; reason: string },
  tenantId: string,
  wechatPay: WechatPay
) {
  const payment = await queryOne<PaymentOrderBriefRow>(
    "SELECT amount, status, transaction_id FROM t_payment_order WHERE pay_no = ? AND tenant_id = ?",
    [body.payNo, tenantId]
  );

  if (!payment) {
    return { success: false, code: "404", message: "支付订单不存在" };
  }

  if (payment.status !== 'PAID') {
    return { success: false, code: "400", message: "订单未支付，无法退款" };
  }

  if (body.amount > Number(payment.amount)) {
    return { success: false, code: "400", message: "退款金额不能超过支付金额" };
  }

  const refundNo = makeBizNo("TK");

  await wechatPay.createRefund({
    outRefundNo: refundNo,
    outTradeNo: body.payNo,
    amount: body.amount,
    reason: body.reason
  });

  await query(
    `INSERT INTO t_refund_order (refund_no, pay_no, source_type, source_no, amount, reason, status, tenant_id)
     SELECT ?, pay_no, source_type, source_no, ?, ?, 'PROCESSING', tenant_id
     FROM t_payment_order WHERE pay_no = ?`,
    [refundNo, body.amount, body.reason, body.payNo]
  );

  return { success: true, data: { refundNo, status: "PROCESSING" } };
}

export async function getPaymentOrder(payNo: string, tenantId: string) {
  const order = await queryOne<PaymentOrderRawRow>(
    "SELECT * FROM t_payment_order WHERE pay_no = ? AND tenant_id = ?",
    [payNo, tenantId]
  );

  return order;
}

export async function listPaymentOrders(tenantId: string, page: number, pageSize: number, status?: string) {
  let sql = "SELECT * FROM t_payment_order WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, (page - 1) * pageSize);

  const orders = await query<PaymentOrderRawRow>(sql, params);
  return orders;
}