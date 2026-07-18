import { query, queryOne } from "../shared/db";
import { makeBizNo } from "../shared/id";

export async function getCollectionLink(token: string) {
  // 公开收款链接接口：通过 token 定位唯一的 t_collection_link 记录
  // 从该记录中获取 tenant_id，并在后续 SQL 中显式注入 tenant_id 条件
  // （t_collection_link / t_sale_bill / t_sale_bill_item / t_collection_view_log 均含 tenant_id 字段）
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.tenant_id AS tenantId, cl.source_type AS sourceType, cl.source_no AS sourceNo, cl.amount, cl.paid_amount AS paidAmount,
            cl.status, cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled, cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            sb.customer_name AS customerName, st.name AS storeName
     FROM t_collection_link cl
     JOIN t_sale_bill sb ON sb.bill_no = cl.source_no AND sb.tenant_id = cl.tenant_id
     JOIN t_store st ON st.id = sb.store_id
     WHERE cl.token = ?`,
    [token]
  );
  if (!link) {
    throw Object.assign(new Error("收款单不存在或已失效"), { statusCode: 404 });
  }

  await query(
    "UPDATE t_collection_link SET view_count = view_count + 1, last_view_time = NOW() WHERE link_no = ? AND tenant_id = ?",
    [link.linkNo, link.tenantId]
  );
  await query(
    "INSERT INTO t_collection_view_log (tenant_id, link_no, ip, user_agent) VALUES (?, ?, ?, ?)",
    [link.tenantId, link.linkNo, null, null]
  );

  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty, unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM t_sale_bill_item WHERE bill_no = ? AND tenant_id = ?`,
    [link.sourceNo, link.tenantId]
  );

  // tenantId 为内部字段，不暴露给外部
  const { tenantId: _tenantId, ...linkData } = link;
  void _tenantId;
  return { ...linkData, items };
}

export async function getCollectionPage(token: string) {
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.tenant_id AS tenantId, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled,
            cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            cl.share_channel AS shareChannel, cl.created_at AS createdAt
     FROM t_collection_link cl
     WHERE cl.token = ?`,
    [token]
  );
  if (!link) {
    return { error: "收款单不存在或已失效", status: 404 };
  }
  const now = new Date();
  const expired = link.expireAt && new Date(link.expireAt) < now;
  if (expired && link.status === "PENDING") {
    await query("UPDATE t_collection_link SET status = 'EXPIRED' WHERE link_no = ? AND tenant_id = ?", [link.linkNo, link.tenantId]);
    link.status = "EXPIRED";
  }
  if (link.status === "EXPIRED") {
    return { error: "收款链接已过期", status: 410 };
  }
  if (link.status === "PAID") {
    return { error: "该收款单已支付", status: 400 };
  }
  if (link.status === "REVOKED") {
    return { error: "收款链接已撤销", status: 400 };
  }
  const bill = await queryOne<any>(
    `SELECT sb.bill_no AS billNo, sb.customer_name AS customerName,
            sb.customer_mobile AS customerMobile, sb.customer_type AS customerType,
            sb.receivable_amount AS receivableAmount, sb.received_amount AS receivedAmount,
            sb.unreceived_amount AS unreceivedAmount, sb.store_id AS storeId,
            st.name AS storeName
     FROM t_sale_bill sb
     JOIN t_store st ON st.id = sb.store_id AND st.tenant_id = sb.tenant_id
     WHERE sb.bill_no = ? AND sb.tenant_id = ?`,
    [link.sourceNo, link.tenantId]
  );
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName,
            box_qty AS boxQty, bottle_qty AS bottleQty,
            total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, subtotal_amount AS subtotalAmount
     FROM t_sale_bill_item WHERE bill_no = ? AND tenant_id = ?`,
    [link.sourceNo, link.tenantId]
  );
  await query("UPDATE t_collection_link SET view_count = view_count + 1, last_view_time = NOW() WHERE link_no = ? AND tenant_id = ?", [link.linkNo, link.tenantId]);
  const { tenantId: _tenantId, ...linkData } = link;
  void _tenantId;
  return {
    data: {
      ...linkData,
      token,
      expired,
      customerName: bill?.customerName ?? "",
      customerMobile: bill?.customerMobile ?? "",
      customerType: bill?.customerType ?? "",
      storeName: bill?.storeName ?? "",
      receivableAmount: bill?.receivableAmount ?? 0,
      receivedAmount: bill?.receivedAmount ?? 0,
      unreceivedAmount: bill?.unreceivedAmount ?? 0,
      items,
    },
  };
}

export async function wxNotifyCollection(token: string, paymentData: {
  payNo?: string;
  transactionId?: string;
  payAmount?: number;
}) {
  const link = await queryOne<any>("SELECT link_no, tenant_id, source_no, amount, paid_amount, status FROM t_collection_link WHERE token = ?", [token]);
  if (!link) {
    return { error: "收款链接不存在", status: 404 };
  }
  if (link.status === "PAID") {
    return { data: { message: "已支付，无需重复处理" } };
  }
  if (link.status === "REVOKED" || link.status === "EXPIRED") {
    return { error: "收款链接已失效", status: 400 };
  }
  const { payNo, transactionId, payAmount } = paymentData;
  const wxPayAmount = payAmount ?? link.amount;
  await query(
    `UPDATE t_payment_order SET status = 'SUCCESS', transaction_id = ?, paid_at = NOW()
     WHERE pay_no = ? AND source_no = ? AND tenant_id = ?`,
    [transactionId ?? null, payNo, link.link_no, link.tenant_id]
  );
  const newPaid = Number(link.paid_amount) + Number(wxPayAmount);
  const newStatus = newPaid >= Number(link.amount) ? "PAID" : "PARTIAL";
  await query(
    `UPDATE t_collection_link SET paid_amount = ?, status = ?, last_pay_time = NOW() WHERE link_no = ? AND tenant_id = ?`,
    [newPaid, newStatus, link.link_no, link.tenant_id]
  );
  const bill = await queryOne<any>("SELECT received_amount, receivable_amount FROM t_sale_bill WHERE bill_no = ? AND tenant_id = ?", [link.source_no, link.tenant_id]);
  if (bill) {
    const newReceived = Number(bill.received_amount) + Number(wxPayAmount);
    const billStatus = newReceived >= Number(bill.receivable_amount) ? "PAID" : "PARTIAL";
    await query(
      `UPDATE t_sale_bill SET received_amount = ?, unreceived_amount = GREATEST(receivable_amount - ?, 0),
       collection_status = ?, last_payment_time = NOW() WHERE bill_no = ? AND tenant_id = ?`,
      [newReceived, newReceived, billStatus, link.source_no, link.tenant_id]
    );
  }
  return { data: { payNo, linkNo: link.link_no, status: newStatus, paidAmount: newPaid } };
}

export async function payCollection(token: string) {
  const link = await queryOne<{ link_no: string; tenant_id: string; amount: number; status: string }>(
    "SELECT link_no, tenant_id, amount, status FROM t_collection_link WHERE token = ?",
    [token]
  );
  if (!link || !["PENDING", "PARTIAL"].includes(link.status)) {
    throw Object.assign(new Error("收款单不可支付"), { statusCode: 400 });
  }

  const payNo = makeBizNo("ZF");
  await query(
    `INSERT INTO t_payment_order (tenant_id, pay_no, source_type, source_no, channel, amount, status)
     VALUES (?, ?, 'COLLECTION_LINK', ?, 'WECHAT', ?, 'PENDING')`,
    [link.tenant_id, payNo, link.link_no, link.amount]
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
