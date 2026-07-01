import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const shareRouter = Router();

shareRouter.get("/collections/:token", asyncHandler(async (req, res) => {
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo, cl.amount, cl.paid_amount AS paidAmount,
            cl.status, cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled, cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            sb.customer_name AS customerName, st.name AS storeName
     FROM collection_link cl
     JOIN sale_bill sb ON sb.bill_no = cl.source_no
     JOIN store st ON st.id = sb.store_id
     WHERE cl.token = ?`,
    [req.params.token]
  );
  if (!link) {
    res.status(404).json({ code: "404", message: "收款单不存在或已失效" });
    return;
  }
  await query("UPDATE collection_link SET view_count = view_count + 1, last_view_time = NOW() WHERE link_no = ?", [link.linkNo]);
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM sale_bill_item WHERE bill_no = ?`,
    [link.sourceNo]
  );
  res.json(ok({ ...link, items }));
}));

// H5支付页 — 返回页面渲染所需数据
shareRouter.get("/collections/:token/page", asyncHandler(async (req, res) => {
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled,
            cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            cl.share_channel AS shareChannel, cl.created_at AS createdAt
     FROM collection_link cl
     WHERE cl.token = ?`,
    [req.params.token]
  );
  if (!link) {
    res.status(404).json({ code: "404", message: "收款单不存在或已失效" });
    return;
  }
  const now = new Date();
  const expired = link.expireAt && new Date(link.expireAt) < now;
  if (expired && link.status === "PENDING") {
    await query("UPDATE collection_link SET status = 'EXPIRED' WHERE link_no = ?", [link.linkNo]);
    link.status = "EXPIRED";
  }
  if (link.status === "EXPIRED") {
    res.status(410).json({ code: "410", message: "收款链接已过期" });
    return;
  }
  if (link.status === "PAID") {
    res.status(400).json({ code: "400", message: "该收款单已支付" });
    return;
  }
  if (link.status === "REVOKED") {
    res.status(400).json({ code: "400", message: "收款链接已撤销" });
    return;
  }
  const bill = await queryOne<any>(
    `SELECT sb.bill_no AS billNo, sb.customer_name AS customerName,
            sb.customer_mobile AS customerMobile, sb.customer_type AS customerType,
            sb.receivable_amount AS receivableAmount, sb.received_amount AS receivedAmount,
            sb.unreceived_amount AS unreceivedAmount, sb.store_id AS storeId,
            st.name AS storeName
     FROM sale_bill sb
     JOIN store st ON st.id = sb.store_id
     WHERE sb.bill_no = ?`,
    [link.sourceNo]
  );
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName,
            box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM sale_bill_item WHERE bill_no = ?`,
    [link.sourceNo]
  );
  await query("UPDATE collection_link SET view_count = view_count + 1, last_view_time = NOW() WHERE link_no = ?", [link.linkNo]);
  res.json(ok({
    linkNo: link.linkNo, token: req.params.token,
    amount: link.amount, paidAmount: link.paidAmount,
    status: link.status, expireAt: link.expireAt, expired,
    taxEnabled: link.taxEnabled, taxRate: link.taxRate, taxAmount: link.taxAmount,
    shareChannel: link.shareChannel, createdAt: link.createdAt,
    customerName: bill?.customerName ?? "", customerMobile: bill?.customerMobile ?? "",
    customerType: bill?.customerType ?? "", storeName: bill?.storeName ?? "",
    receivableAmount: bill?.receivableAmount ?? 0, receivedAmount: bill?.receivedAmount ?? 0,
    unreceivedAmount: bill?.unreceivedAmount ?? 0, items
  }));
}));

shareRouter.post("/collections/:token/pay", asyncHandler(async (req, res) => {
  const link = await queryOne<any>("SELECT link_no, amount, status FROM collection_link WHERE token = ?", [req.params.token]);
  if (!link || !["PENDING", "PARTIAL"].includes(link.status)) {
    res.status(400).json({ code: "400", message: "收款单不可支付" });
    return;
  }
  const payNo = makeBizNo("ZF");
  await query(
    `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status)
     VALUES (?, 'COLLECTION_LINK', ?, 'WECHAT', ?, 'PENDING')`,
    [payNo, link.link_no, link.amount]
  );
  res.json(ok({
    payNo, token: req.params.token,
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: "dev-nonce",
    package: "prepay_id=dev",
    signType: "RSA",
    paySign: "dev-sign"
  }));
}));

// 微信支付回调
shareRouter.post("/collections/:token/wx-notify", asyncHandler(async (req, res) => {
  // 微信支付签名验证
  const { wechatPay } = await import("../shared/wechat-pay.js");
  const headers = req.headers as Record<string, string>;
  const bodyStr = JSON.stringify(req.body);

  if (!wechatPay.verifyNotifySignature(headers, bodyStr)) {
    res.status(401).json({ code: "401", message: "签名验证失败" });
    return;
  }

  // 解密通知数据（微信 v3 API 使用 AES-256-GCM 加密）
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
    // 兼容 v2 API 明文回调
    payNo = req.body.payNo ?? req.body.out_trade_no;
    transactionId = req.body.transactionId ?? req.body.transaction_id;
    payAmount = req.body.payAmount ?? req.body.total_fee;
  }

  const link = await queryOne<any>("SELECT link_no, source_no, amount, paid_amount, status FROM collection_link WHERE token = ?", [req.params.token]);
  if (!link) {
    res.status(404).json({ code: "404", message: "收款链接不存在" });
    return;
  }
  if (link.status === "PAID") {
    res.json(ok({ message: "已支付，无需重复处理" }));
    return;
  }
  if (link.status === "REVOKED" || link.status === "EXPIRED") {
    res.status(400).json({ code: "400", message: "收款链接已失效" });
    return;
  }
  const wxPayAmount = payAmount ?? link.amount;
  await query(
    `UPDATE payment_order SET status = 'SUCCESS', transaction_id = ?, paid_at = NOW()
     WHERE pay_no = ? AND source_no = ?`,
    [transactionId ?? null, payNo, link.link_no]
  );
  const newPaid = Number(link.paid_amount) + Number(wxPayAmount);
  const newStatus = newPaid >= Number(link.amount) ? "PAID" : "PARTIAL";
  await query(
    `UPDATE collection_link SET paid_amount = ?, status = ?, last_pay_time = NOW() WHERE link_no = ?`,
    [newPaid, newStatus, link.link_no]
  );
  const bill = await queryOne<any>("SELECT received_amount, receivable_amount FROM sale_bill WHERE bill_no = ?", [link.source_no]);
  if (bill) {
    const newReceived = Number(bill.received_amount) + Number(wxPayAmount);
    const billStatus = newReceived >= Number(bill.receivable_amount) ? "PAID" : "PARTIAL";
    await query(
      `UPDATE sale_bill SET received_amount = ?, unreceived_amount = GREATEST(receivable_amount - ?, 0),
       collection_status = ?, last_payment_time = NOW() WHERE bill_no = ?`,
      [newReceived, newReceived, billStatus, link.source_no]
    );
  }
  res.json(ok({ payNo, linkNo: link.link_no, status: newStatus, paidAmount: newPaid }));
}));