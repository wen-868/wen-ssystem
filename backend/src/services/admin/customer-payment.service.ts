import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

export async function list(params: {
  page: number; pageSize: number; tenantId: string;
  customerId?: number; status?: string; dateStart?: string; dateEnd?: string;
}) {
  const { page, pageSize, tenantId, customerId, status, dateStart, dateEnd } = params;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (customerId !== undefined) {
    conditions.push("customer_id = ?");
    queryParams.push(customerId);
  }
  if (status) {
    conditions.push("status = ?");
    queryParams.push(status);
  }
  if (dateStart) {
    conditions.push("payment_date >= ?");
    queryParams.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("payment_date <= ?");
    queryParams.push(dateEnd);
  }

  const whereClause = conditions.length > 0 ? " AND " + conditions.join(" AND ") : "";
  const offset = (page - 1) * pageSize;
  const payments = await queryWithTenant<any>(
    `SELECT * FROM customer_payment WHERE 1=1${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  return payments;
}

export async function getDetail(receiptNo: string, tenantId: string) {
  const payment = await queryOneWithTenant<any>(
    "SELECT * FROM customer_payment WHERE receipt_no = ?",
    [receiptNo],
    tenantId
  );
  if (!payment) throw Object.assign(new Error("收款单不存在"), { statusCode: 404 });
  return payment;
}

export async function create(body: {
  customer_id: number; customer_name: string; amount: number;
  payment_method?: string; source_type?: string; source_no?: string;
  voucher_no?: string; payment_date: string; remark?: string;
}, tenantId: string, userId: number, username: string) {
  const receiptNo = makeBizNo("SK");

  await transaction(async (conn) => {
    await conn.query(
      `INSERT INTO customer_payment (receipt_no, customer_id, customer_name, amount, payment_method,
        source_type, source_no, voucher_no, payment_date, operator_id, status, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
      [receiptNo, body.customer_id, body.customer_name, body.amount,
        body.payment_method || "CASH", body.source_type || null, body.source_no || null,
        body.voucher_no || null, body.payment_date, userId, body.remark || null, tenantId]
    );

    if (body.source_type === "SALE_BILL" && body.source_no) {
      const [billRows] = await conn.query(
        "SELECT receivable_amount, received_amount FROM sale_bill WHERE bill_no = ?",
        [body.source_no]
      );
      const billRow = (billRows as any[])?.[0];
      if (billRow) {
        const newReceivedAmount = Number(billRow.received_amount) + Number(body.amount);
        const newUnreceivedAmount = Number(billRow.receivable_amount) - newReceivedAmount;
        let collectionStatus = newUnreceivedAmount <= 0 ? "PAID" : "PARTIAL";
        await conn.query(
          "UPDATE sale_bill SET received_amount = ?, unreceived_amount = ?, collection_status = ? WHERE bill_no = ?",
          [newReceivedAmount, Math.max(0, newUnreceivedAmount), collectionStatus, body.source_no]
        );
      }
    }

    await conn.query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_payment", "CREATE", receiptNo, "customer_payment", userId, username, `创建收款单: ${receiptNo}, 金额: ${body.amount}`, tenantId]
    );
  });

  return { receipt_no: receiptNo };
}

export async function voidPayment(receiptNo: string, tenantId: string, userId: number, username: string) {
  const payment = await queryOneWithTenant<any>(
    "SELECT id, status, source_type, source_no, amount FROM customer_payment WHERE receipt_no = ?",
    [receiptNo],
    tenantId
  );
  if (!payment) throw Object.assign(new Error("收款单不存在"), { statusCode: 404 });
  if (payment.status !== "COMPLETED") throw Object.assign(new Error("只有已完成状态的收款单可以作废"), { statusCode: 400 });

  await transaction(async (conn) => {
    await conn.query("UPDATE customer_payment SET status = 'VOIDED' WHERE receipt_no = ?", [receiptNo]);

    if (payment.source_type === "SALE_BILL" && payment.source_no) {
      const [billRows] = await conn.query(
        "SELECT receivable_amount, received_amount FROM sale_bill WHERE bill_no = ?",
        [payment.source_no]
      );
      const billRow = (billRows as any[])?.[0];
      if (billRow) {
        const newReceivedAmount = Number(billRow.received_amount) - Number(payment.amount);
        const newUnreceivedAmount = Number(billRow.receivable_amount) - newReceivedAmount;
        let collectionStatus = "UNPAID";
        if (newReceivedAmount > 0 && newUnreceivedAmount > 0) collectionStatus = "PARTIAL";
        else if (newUnreceivedAmount <= 0) collectionStatus = "PAID";
        await conn.query(
          "UPDATE sale_bill SET received_amount = ?, unreceived_amount = ?, collection_status = ? WHERE bill_no = ?",
          [Math.max(0, newReceivedAmount), newUnreceivedAmount, collectionStatus, payment.source_no]
        );
      }
    }

    await conn.query(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_payment", "VOID", receiptNo, "customer_payment", userId, username, `作废收款单: ${receiptNo}`, tenantId]
    );
  });

  return { receipt_no: receiptNo };
}