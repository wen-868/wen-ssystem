import { query, queryOne } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";

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