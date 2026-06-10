import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const shareRouter = Router();

shareRouter.get("/collections/:token", asyncHandler(async (req, res) => {
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo, cl.amount, cl.paid_amount AS paidAmount,
            cl.status, cl.expire_at AS expireAt, sb.customer_name AS customerName, st.name AS storeName
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
  await query("INSERT INTO collection_view_log (link_no, ip, user_agent) VALUES (?, ?, ?)", [link.linkNo, req.ip, req.headers["user-agent"] ?? null]);
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM sale_bill_item WHERE bill_no = ?`,
    [link.sourceNo]
  );
  res.json(ok({ ...link, items }));
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
    payNo,
    token: req.params.token,
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: "dev-nonce",
    package: "prepay_id=dev",
    signType: "RSA",
    paySign: "dev-sign"
  }));
}));
