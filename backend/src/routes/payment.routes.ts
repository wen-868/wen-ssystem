import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";
import { WechatPay } from "../shared/wechat-pay.js";
import { requireAuth, requireAuthWithTenant } from "../shared/auth.js";
import { env } from "../shared/env.js";

export const paymentRouter = Router();
const wechatPay = new WechatPay();

paymentRouter.post("/orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    sourceType: z.enum(["MINIAPP_ORDER", "SALE_BILL", "COLLECTION_LINK"]),
    sourceNo: z.string(),
    amount: z.number().positive(),
    openid: z.string().optional(),
    description: z.string().optional()
  }).parse(req.body);

  const payNo = makeBizNo("ZF");
  const tenantId = req.tenantId;

  await query(
    `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, tenant_id)
     VALUES (?, ?, ?, 'WECHAT', ?, 'PENDING', ?)`,
    [payNo, body.sourceType, body.sourceNo, body.amount, tenantId]
  );

  if (!body.openid) {
    res.json(ok({
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
    }));
    return;
  }

  try {
    const { prepayId, paySign, timeStamp, nonceStr } = await wechatPay.createJsapiOrder({
      outTradeNo: payNo,
      description: body.description || `支付订单 ${payNo}`,
      amount: body.amount,
      openid: body.openid,
      attach: JSON.stringify({ sourceType: body.sourceType, sourceNo: body.sourceNo, tenantId })
    });

    res.json(ok({
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
    }));
  } catch (error) {
    res.status(500).json({ code: "500", message: (error as Error).message });
  }
}));

paymentRouter.post("/wx/callback", asyncHandler(async (req, res) => {
  const headers = req.headers as Record<string, string>;
  
  if (!wechatPay.verifyNotifySignature(headers, JSON.stringify(req.body))) {
    res.status(400).json({ code: "400", message: "签名验证失败" });
    return;
  }

  const resource = req.body.resource;
  let notifyData: any;
  
  try {
    notifyData = JSON.parse(wechatPay.decryptNotifyData(
      resource.associated_data,
      resource.nonce,
      resource.ciphertext
    ));
  } catch {
    res.status(400).json({ code: "400", message: "数据解密失败" });
    return;
  }

  const { out_trade_no, transaction_id, trade_state, amount } = notifyData;

  if (trade_state === 'SUCCESS') {
    await transaction(async (conn) => {
      await conn.execute(
        "UPDATE payment_order SET status = 'PAID', transaction_id = ?, paid_amount = ?, paid_at = NOW() WHERE pay_no = ?",
        [transaction_id, amount.total / 100, out_trade_no]
      );

      const order = await conn.execute(
        "SELECT source_type, source_no FROM payment_order WHERE pay_no = ?",
        [out_trade_no]
      );

      if (order[0] && (order[0] as any[]).length > 0) {
        const { source_type, source_no } = (order[0] as any[])[0];
        
        if (source_type === 'SALE_BILL') {
          await conn.execute(
            "UPDATE sale_bill SET status = 'PAID' WHERE bill_no = ?",
            [source_no]
          );
        } else if (source_type === 'MINIAPP_ORDER') {
          await conn.execute(
            "UPDATE miniapp_order SET order_status = 'PAID' WHERE order_no = ?",
            [source_no]
          );
        } else if (source_type === 'COLLECTION_LINK') {
          await conn.execute(
            "UPDATE collection_link SET paid_amount = paid_amount + ?, status = 'PAID' WHERE link_no = ?",
            [amount.total / 100, source_no]
          );
        }
      }
    });
  }

  res.json({ code: "SUCCESS", message: "成功" });
}));

paymentRouter.post("/refunds", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({ 
    payNo: z.string(), 
    amount: z.number().positive(), 
    reason: z.string() 
  }).parse(req.body);

  const tenantId = req.tenantId;
  const payment = await queryOne<any>(
    "SELECT amount, status, transaction_id FROM payment_order WHERE pay_no = ? AND tenant_id = ?",
    [body.payNo, tenantId]
  );

  if (!payment) {
    res.status(404).json({ code: "404", message: "支付订单不存在" });
    return;
  }

  if (payment.status !== 'PAID') {
    res.status(400).json({ code: "400", message: "订单未支付，无法退款" });
    return;
  }

  if (body.amount > Number(payment.amount)) {
    res.status(400).json({ code: "400", message: "退款金额不能超过支付金额" });
    return;
  }

  const refundNo = makeBizNo("TK");

  try {
    await wechatPay.createRefund({
      outRefundNo: refundNo,
      outTradeNo: body.payNo,
      amount: body.amount,
      reason: body.reason
    });

    await query(
      `INSERT INTO refund_order (refund_no, pay_no, source_type, source_no, amount, reason, status, tenant_id)
       SELECT ?, pay_no, source_type, source_no, ?, ?, 'PROCESSING', tenant_id
       FROM payment_order WHERE pay_no = ?`,
      [refundNo, body.amount, body.reason, body.payNo]
    );

    res.json(ok({ refundNo, status: "PROCESSING" }));
  } catch (error) {
    res.status(500).json({ code: "500", message: (error as Error).message });
  }
}));

paymentRouter.get("/orders/:payNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { payNo } = req.params;
  const tenantId = req.tenantId;

  const order = await queryOne<any>(
    "SELECT * FROM payment_order WHERE pay_no = ? AND tenant_id = ?",
    [payNo, tenantId]
  );

  if (!order) {
    res.status(404).json({ code: "404", message: "支付订单不存在" });
    return;
  }

  res.json(ok(order));
}));

paymentRouter.get("/orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { page = 1, pageSize = 20, status } = req.query;

  let sql = "SELECT * FROM payment_order WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const orders = await query<any>(sql, params);
  res.json(ok(orders));
}));