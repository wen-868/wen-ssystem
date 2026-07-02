import { query, queryOne } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";

export async function getCollectionLink(token: string) {
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo, cl.amount, cl.paid_amount AS paidAmount,
            cl.status, cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled, cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            sb.customer_name AS customerName, st.name AS storeName
     FROM collection_link cl
     JOIN sale_bill sb ON sb.bill_no = cl.source_no
     JOIN store st ON st.id = sb.store_id
     WHERE cl.token = ?`,
    [token]
  );
  if (!link) return null;

  await query("UPDATE collection_link SET view_count = view_count + 1, last_view_time = NOW() WHERE link_no = ?", [link.linkNo]);

  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM sale_bill_item WHERE bill_no = ?`,
    [link.sourceNo]
  );
  return { ...link, items };
}

export async function getCollectionLinkPage(token: string) {
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled,
            cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            cl.share_channel AS shareChannel, cl.created_at AS createdAt
     FROM collection_link cl
     WHERE cl.token = ?`,
    [token]
  );
  if (!link) return null;

  const now = new Date();
  const expired = link.expireAt && new Date(link.expireAt) < now;
  if (expired && link.status === "PENDING") {
    await query("UPDATE collection_link SET status = 'EXPIRED' WHERE link_no = ?", [link.linkNo]);
    link.status = "EXPIRED";
  }

  if (link.status === "EXPIRED" || link.status === "PAID" || link.status === "REVOKED") {
    return { link, status: link.status };
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

  return {
    linkNo: link.linkNo, token,
    amount: link.amount, paidAmount: link.paidAmount,
    status: link.status, expireAt: link.expireAt, expired,
    taxEnabled: link.taxEnabled, taxRate: link.taxRate, taxAmount: link.taxAmount,
    shareChannel: link.shareChannel, createdAt: link.createdAt,
    customerName: bill?.customerName ?? "", customerMobile: bill?.customerMobile ?? "",
    customerType: bill?.customerType ?? "", storeName: bill?.storeName ?? "",
    receivableAmount: bill?.receivableAmount ?? 0, receivedAmount: bill?.receivedAmount ?? 0,
    unreceivedAmount: bill?.unreceivedAmount ?? 0, items,
  };
}

export async function payCollectionLink(token: string) {
  const link = await queryOne<any>("SELECT link_no, amount, status FROM collection_link WHERE token = ?", [token]);
  if (!link || !["PENDING", "PARTIAL"].includes(link.status)) return null;

  const payNo = makeBizNo("ZF");
  await query(
    `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status)
     VALUES (?, 'COLLECTION_LINK', ?, 'WECHAT', ?, 'PENDING')`,
    [payNo, link.link_no, link.amount]
  );

  return {
    payNo, token,
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: "dev-nonce",
    package: "prepay_id=dev",
    signType: "RSA",
    paySign: "dev-sign",
  };
}

export async function processWxNotify(token: string, headers: Record<string, string>, body: any) {
  const { WechatPay } = await import("../shared/wechat-pay.js");
  const wechatPay = new WechatPay();
  const bodyStr = JSON.stringify(body);

  if (!wechatPay.verifyNotifySignature(headers, bodyStr)) {
    return { verified: false };
  }

  const { resource } = body;
  let payNo: string | undefined, transactionId: string | undefined, payAmount: number | undefined;

  if (resource && resource.ciphertext) {
    try {
      const decrypted = wechatPay.decryptNotifyData(resource.associated_data, resource.nonce, resource.ciphertext);
      const data = JSON.parse(decrypted);
      payNo = data.out_trade_no;
      transactionId = data.transaction_id;
      payAmount = data.amount?.payer_total ? Number(data.amount.payer_total) / 100 : undefined;
    } catch {
      return { decryptFailed: true };
    }
  } else {
    payNo = body.payNo ?? body.out_trade_no;
    transactionId = body.transactionId ?? body.transaction_id;
    payAmount = body.payAmount ?? body.total_fee;
  }

  const link = await queryOne<any>("SELECT link_no, source_no, amount, paid_amount, status FROM collection_link WHERE token = ?", [token]);
  if (!link) return { notFound: true };
  if (link.status === "PAID") return { alreadyPaid: true };
  if (link.status === "REVOKED" || link.status === "EXPIRED") return { invalid: true };

  const wxPayAmount = payAmount ?? link.amount;
  await query(
    `UPDATE payment_order SET status = 'SUCCESS', transaction_id = ?, paid_at = NOW()
     WHERE pay_no = ? AND source_no = ?`,
    [transactionId ?? null, payNo, link.link_no]
  );

  const newPaid = Number(link.paid_amount) + Number(wxPayAmount);
  const newStatus = newPaid >= Number(link.amount) ? "PAID" : "PARTIAL";
  await query(
    "UPDATE collection_link SET paid_amount = ?, status = ?, last_pay_time = NOW() WHERE link_no = ?",
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

  return { payNo, linkNo: link.link_no, status: newStatus, paidAmount: newPaid };
}