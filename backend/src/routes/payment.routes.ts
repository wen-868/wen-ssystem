import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const paymentRouter = Router();

paymentRouter.post("/orders", asyncHandler(async (req, res) => {
  const body = z.object({
    sourceType: z.enum(["MINIAPP_ORDER", "SALE_BILL", "COLLECTION_LINK"]),
    sourceNo: z.string(),
    amount: z.number().positive(),
    openid: z.string().optional()
  }).parse(req.body);
  const payNo = makeBizNo("ZF");
  await query(
    `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status)
     VALUES (?, ?, ?, 'WECHAT', ?, 'PENDING')`,
    [payNo, body.sourceType, body.sourceNo, body.amount]
  );
  res.json(ok({
    payNo,
    appId: "wx-dev-appid",
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: "dev-nonce",
    package: "prepay_id=dev",
    signType: "RSA",
    paySign: "dev-sign",
    sourceType: body.sourceType,
    sourceNo: body.sourceNo,
    amount: body.amount
  }));
}));

paymentRouter.post("/wx/callback", asyncHandler(async (_req, res) => {
  // 第 1 阶段骨架保留回调入口；正式接入微信支付 V3 时需完成验签、解密和幂等更新。
  res.json({ code: "SUCCESS", message: "成功" });
}));

paymentRouter.post("/refunds", asyncHandler(async (req, res) => {
  const body = z.object({ payNo: z.string(), amount: z.number().positive(), reason: z.string() }).parse(req.body);
  // 校验退款不超过支付金额
  const payment = await queryOne<any>(
    "SELECT amount FROM payment_order WHERE pay_no = ?",
    [body.payNo]
  );
  if (!payment) {
    res.status(404).json({ code: "404", message: "支付订单不存在" });
    return;
  }
  if (body.amount > Number(payment.amount)) {
    res.status(400).json({ code: "400", message: "退款金额不能超过支付金额" });
    return;
  }
  const refundNo = makeBizNo("TK");
  await query(
    `INSERT INTO refund_order (refund_no, pay_no, source_type, source_no, amount, reason, status)
     SELECT ?, pay_no, source_type, source_no, ?, ?, 'PENDING'
     FROM payment_order WHERE pay_no = ?`,
    [refundNo, body.amount, body.reason, body.payNo]
  );
  res.json(ok({ refundNo, status: "PENDING" }));
}));
