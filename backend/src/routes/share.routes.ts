import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import { getCollectionLink, getCollectionLinkPage, payCollection, processWxNotify } from "../services/share.service.js";

export const shareRouter = Router();

// 获取分享单据完整数据（法律凭证视图）
shareRouter.get("/collections/:token", asyncHandler(async (req, res) => {
  try {
    const data = await getCollectionLink(req.params.token);
    res.json(ok(data));
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ code: String(err.statusCode || 500), message: err.message });
  }
}));

// H5支付页 — 返回页面渲染所需数据（完整法律凭证）
shareRouter.get("/collections/:token/page", asyncHandler(async (req, res) => {
  try {
    const data = await getCollectionLinkPage(req.params.token);
    res.json(ok(data));
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ code: String(statusCode), message: err.message });
  }
}));

// 发起支付
shareRouter.post("/collections/:token/pay", asyncHandler(async (req, res) => {
  try {
    const data = await payCollection(req.params.token);
    res.json(ok(data));
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ code: String(err.statusCode || 500), message: err.message });
  }
}));

// 微信支付回调
shareRouter.post("/collections/:token/wx-notify", asyncHandler(async (req, res) => {
  // 微信支付签名验证
  const { WechatPay } = await import("../shared/wechat-pay.js");
  const wechatPay = new WechatPay();
  const headers = req.headers as Record<string, string>;
  const bodyStr = JSON.stringify(req.body);

  if (!wechatPay.verifyNotifySignature(headers, bodyStr)) {
    res.status(401).json({ code: "401", message: "签名验证失败" });
    return;
  }

  // 解密通知数据
  const { resource } = req.body;
  let payNo: string | undefined, transactionId: string | undefined, payAmount: number | undefined;
  if (resource && resource.ciphertext) {
    try {
      const decrypted = wechatPay.decryptNotifyData(resource.associated_data, resource.nonce, resource.ciphertext);
      const data = JSON.parse(decrypted);
      payNo = data.out_trade_no;
      transactionId = data.transaction_id;
      payAmount = data.amount?.payer_total ? Number(data.amount.payer_total) / 100 : undefined;
    } catch {
      res.status(400).json({ code: "400", message: "通知数据解密失败" });
      return;
    }
  } else {
    payNo = req.body.payNo ?? req.body.out_trade_no;
    transactionId = req.body.transactionId ?? req.body.transaction_id;
    payAmount = req.body.payAmount ?? req.body.total_fee;
  }

  try {
    const result = await processWxNotify(req.params.token, payNo!, transactionId ?? null, payAmount ?? null);
    if (result.alreadyPaid) {
      res.json(ok({ message: "已支付，无需重复处理" }));
      return;
    }
    res.json(ok(result));
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ code: String(err.statusCode || 500), message: err.message });
  }
}));