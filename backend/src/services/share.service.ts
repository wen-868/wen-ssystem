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
