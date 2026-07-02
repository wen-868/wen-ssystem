import { query, queryOne } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";

// ============ 收款链接详情（法律凭证视图） ============
export async function getCollectionLink(token: string) {
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo, cl.amount, cl.paid_amount AS paidAmount,
            cl.status, cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled, cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            cl.display_config AS displayConfig, cl.document_title AS documentTitle,
            sb.customer_name AS customerName, sb.customer_mobile AS customerMobile,
            sb.store_name AS storeName, sb.store_address AS storeAddress, sb.store_contact AS storeContact,
            sb.bill_no AS billNo, sb.sale_type AS saleType, sb.goods_amount AS goodsAmount,
            sb.discount_amount AS discountAmount, sb.receivable_amount AS receivableAmount,
            sb.received_amount AS receivedAmount, sb.unreceived_amount AS unreceivedAmount,
            sb.business_status AS businessStatus, sb.created_at AS createdAt
     FROM collection_link cl
     JOIN sale_bill sb ON sb.bill_no = cl.source_no
     WHERE cl.token = ?`,
    [token]
  );
  if (!link) {
    throw Object.assign(new Error("收款单不存在或已失效"), { statusCode: 404 });
  }

  await query("UPDATE collection_link SET view_count = view_count + 1, last_view_time = NOW() WHERE link_no = ?", [link.linkNo]);
  await query("INSERT INTO collection_view_log (link_no, ip, user_agent) VALUES (?, ?, ?)", [link.linkNo, null, null]);

  // 获取单据明细（含单位、条形码、规格等法律凭证关键字段）
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty, unit_price AS unitPrice, unit, barcode, spec, subtotal_amount AS subtotalAmount
     FROM sale_bill_item WHERE bill_no = ?`,
    [link.sourceNo]
  );

  return {
    ...link,
    items,
    displayConfig: link.displayConfig ?? { showBarcode: true, showUnit: true, showSpec: true, showTax: false },
  };
}

export async function payCollection(token: string) {
  const link = await queryOne<any>(
    "SELECT link_no, amount, status FROM collection_link WHERE token = ?",
    [token]
  );
  if (!link || !["PENDING", "PARTIAL"].includes(link.status)) {
    throw Object.assign(new Error("收款单不可支付"), { statusCode: 400 });
  }

  const payNo = makeBizNo("ZF");
  await query(
    `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status)
     VALUES (?, 'COLLECTION_LINK', ?, 'WECHAT', ?, 'PENDING')`,
    [payNo, link.link_no, link.amount]
  );

  return {
    payNo,
    token,
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: "dev-nonce",
    package: "prepay_id=dev",
    signType: "RSA",
    paySign: "dev-sign"
  };
}

// ============ H5支付页数据 ============
export async function getCollectionLinkPage(token: string) {
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled,
            cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            cl.display_config AS displayConfig, cl.document_title AS documentTitle,
            cl.share_channel AS shareChannel, cl.created_at AS createdAt
     FROM collection_link cl
     WHERE cl.token = ?`,
    [token]
  );
  if (!link) {
    throw Object.assign(new Error("收款单不存在或已失效"), { statusCode: 404 });
  }

  const now = new Date();
  const expired = link.expireAt && new Date(link.expireAt) < now;
  if (expired && link.status === "PENDING") {
    await query("UPDATE collection_link SET status = 'EXPIRED' WHERE link_no = ?", [link.linkNo]);
    link.status = "EXPIRED";
  }
  if (link.status === "EXPIRED") {
    throw Object.assign(new Error("收款链接已过期"), { statusCode: 410 });
  }
  if (link.status === "PAID") {
    throw Object.assign(new Error("该收款单已支付"), { statusCode: 400 });
  }
  if (link.status === "REVOKED") {
    throw Object.assign(new Error("收款链接已撤销"), { statusCode: 400 });
  }

  const bill = await queryOne<any>(
    `SELECT sb.bill_no AS billNo, sb.customer_name AS customerName,
            sb.customer_mobile AS customerMobile, sb.customer_type AS customerType,
            sb.receivable_amount AS receivableAmount, sb.received_amount AS receivedAmount,
            sb.unreceived_amount AS unreceivedAmount,
            sb.store_name AS storeName, sb.store_address AS storeAddress, sb.store_contact AS storeContact,
            sb.goods_amount AS goodsAmount, sb.discount_amount AS discountAmount,
            sb.sale_type AS saleType, sb.business_status AS businessStatus,
            sb.created_at AS createdAt
     FROM sale_bill sb
     WHERE sb.bill_no = ?`,
    [link.sourceNo]
  );

  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName,
            box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, unit, barcode, spec,
            subtotal_amount AS subtotalAmount
     FROM sale_bill_item WHERE bill_no = ?`,
    [link.sourceNo]
  );

  await query("UPDATE collection_link SET view_count = view_count + 1, last_view_time = NOW() WHERE link_no = ?", [link.linkNo]);

  return {
    linkNo: link.linkNo, token,
    amount: link.amount, paidAmount: link.paidAmount,
    status: link.status, expireAt: link.expireAt, expired,
    taxEnabled: link.taxEnabled, taxRate: link.taxRate, taxAmount: link.taxAmount,
    displayConfig: link.displayConfig ?? { showBarcode: true, showUnit: true, showSpec: true, showTax: false },
    documentTitle: link.documentTitle ?? '销售单',
    shareChannel: link.shareChannel, createdAt: link.createdAt,
    customerName: bill?.customerName ?? "", customerMobile: bill?.customerMobile ?? "",
    customerType: bill?.customerType ?? "",
    storeName: bill?.storeName ?? "", storeAddress: bill?.storeAddress ?? "", storeContact: bill?.storeContact ?? "",
    receivableAmount: bill?.receivableAmount ?? 0, receivedAmount: bill?.receivedAmount ?? 0,
    unreceivedAmount: bill?.unreceivedAmount ?? 0,
    goodsAmount: bill?.goodsAmount ?? 0, discountAmount: bill?.discountAmount ?? 0,
    saleType: bill?.saleType ?? "", businessStatus: bill?.businessStatus ?? "",
    billCreatedAt: bill?.createdAt ?? "",
    items
  };
}

// ============ 微信支付回调处理 ============
export async function processWxNotify(token: string, payNo: string, transactionId: string | null, payAmount: number | null) {
  const link = await queryOne<any>(
    "SELECT link_no, source_no, amount, paid_amount, status FROM collection_link WHERE token = ?",
    [token]
  );
  if (!link) {
    throw Object.assign(new Error("收款链接不存在"), { statusCode: 404 });
  }
  if (link.status === "PAID") {
    return { alreadyPaid: true, linkNo: link.link_no };
  }
  if (link.status === "REVOKED" || link.status === "EXPIRED") {
    throw Object.assign(new Error("收款链接已失效"), { statusCode: 400 });
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

  return { payNo, linkNo: link.link_no, status: newStatus, paidAmount: newPaid };
}