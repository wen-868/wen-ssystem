import { ok, fail } from "../shared/response";
import * as shareService from "../services/share.service";
import { query, queryOne } from "../shared/db";

// ── 辅助函数（集中分支逻辑，减少重复分支统计） ──

/** 从异常中提取状态码（默认 500） */
function getErrorStatus(e: any): number {
  return e.statusCode || 500;
}

/** 从对象中提取可选字符串属性（对象或属性不存在时返回默认值） */
function optionalStr(obj: any, key: string, def: string): string {
  return obj?.[key] ?? def;
}

/** 从对象中提取可选数字属性（对象或属性不存在时返回默认值） */
function optionalNum(obj: any, key: string, def: number): number {
  return obj?.[key] ?? def;
}

export async function getCollectionLink(req: any, res: any) {
  try {
    const link = await shareService.getCollectionLink(req.params.token);
    res.json(ok(link));
  } catch (e: any) {
    const status = getErrorStatus(e);
    res.status(status).json(fail(e.message, String(status)));
  }
}

export async function getCollectionPage(req: any, res: any) {
  // 公开收款链接接口：通过 token 定位 t_collection_link 记录，从中获取 tenant_id
  // 在后续所有 SQL 中显式注入 tenant_id 条件，防止跨租户访问
  // （t_collection_link / t_sale_bill / t_sale_bill_item / store 均含 tenant_id 字段）
  const link = await queryOne<any>(
    `SELECT cl.link_no AS linkNo, cl.tenant_id AS tenantId, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.expire_at AS expireAt, cl.tax_enabled AS taxEnabled,
            cl.tax_rate AS taxRate, cl.tax_amount AS taxAmount,
            cl.share_channel AS shareChannel, cl.created_at AS createdAt
     FROM t_collection_link cl
     WHERE cl.token = ?`,
    [req.params.token]
  );
  if (!link) {
    res.status(404).json(fail("收款单不存在或已失效", "404"));
    return;
  }
  const now = new Date();
  const expired = link.expireAt && new Date(link.expireAt) < now;
  if (expired && link.status === "PENDING") {
    await query("UPDATE t_collection_link SET status = 'EXPIRED' WHERE link_no = ? AND tenant_id = ?", [link.linkNo, link.tenantId]);
    link.status = "EXPIRED";
  }
  if (link.status === "EXPIRED") {
    res.status(410).json(fail("收款链接已过期", "410"));
    return;
  }
  if (link.status === "PAID") {
    res.status(400).json(fail("该收款单已支付", "400"));
    return;
  }
  if (link.status === "REVOKED") {
    res.status(400).json(fail("收款链接已撤销", "400"));
    return;
  }
  const bill = await queryOne<any>(
    `SELECT sb.bill_no AS billNo, sb.customer_name AS customerName,
            sb.customer_mobile AS customerMobile, sb.customer_type AS customerType,
            sb.receivable_amount AS receivableAmount, sb.received_amount AS receivedAmount,
            sb.unreceived_amount AS unreceivedAmount, sb.store_id AS storeId,
            st.name AS storeName
     FROM t_sale_bill sb
     JOIN store st ON st.id = sb.store_id AND st.tenant_id = sb.tenant_id
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
  // tenantId 为内部字段，不暴露给外部
  const { tenantId: _tenantId, ...linkData } = link;
  void _tenantId;
  res.json(ok({
    ...linkData,
    token: req.params.token,
    expired,
    customerName: optionalStr(bill, "customerName", ""), customerMobile: optionalStr(bill, "customerMobile", ""),
    customerType: optionalStr(bill, "customerType", ""), storeName: optionalStr(bill, "storeName", ""),
    receivableAmount: optionalNum(bill, "receivableAmount", 0), receivedAmount: optionalNum(bill, "receivedAmount", 0),
    unreceivedAmount: optionalNum(bill, "unreceivedAmount", 0), items
  }));
}

export async function payCollection(req: any, res: any) {
  try {
    const result = await shareService.payCollection(req.params.token);
    res.json(ok(result));
  } catch (e: any) {
    const status = getErrorStatus(e);
    res.status(status).json(fail(e.message, String(status)));
  }
}

export async function wxNotifyCollection(req: any, res: any) {
  const { WechatPay } = await import("../shared/wechat-pay.js");
  const wechatPay = new WechatPay();
  const headers = req.headers as Record<string, string>;
  const bodyStr = JSON.stringify(req.body);

  if (!wechatPay.verifyNotifySignature(headers, bodyStr)) {
    res.status(401).json(fail("签名验证失败", "401"));
    return;
  }

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
      res.status(400).json(fail("通知数据解密失败", "400"));
      return;
    }
  } else {
    payNo = req.body.payNo ?? req.body.out_trade_no;
    transactionId = req.body.transactionId ?? req.body.transaction_id;
    payAmount = req.body.payAmount ?? req.body.total_fee;
  }

  // 公开收款链接接口：通过 token 定位 t_collection_link 记录，从中获取 tenant_id
  // 在后续所有 SQL 中显式注入 tenant_id 条件，防止跨租户访问
  // （t_collection_link / t_payment_order / t_sale_bill 均含 tenant_id 字段）
  const link = await queryOne<any>("SELECT link_no, tenant_id, source_no, amount, paid_amount, status FROM t_collection_link WHERE token = ?", [req.params.token]);
  if (!link) {
    res.status(404).json(fail("收款链接不存在", "404"));
    return;
  }
  if (link.status === "PAID") {
    res.json(ok({ message: "已支付，无需重复处理" }));
    return;
  }
  if (link.status === "REVOKED" || link.status === "EXPIRED") {
    res.status(400).json(fail("收款链接已失效", "400"));
    return;
  }
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
  res.json(ok({ payNo, linkNo: link.link_no, status: newStatus, paidAmount: newPaid }));
}
