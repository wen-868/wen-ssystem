import { query, queryOne, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

/** 采购付款单完整行（SELECT *，字段依据 INSERT 语句及常见列推断） */
interface PurchasePaymentRow {
  id: number | string;
  payment_no: string;
  supplier_id: number | string;
  supplier_name: string;
  payment_type: string;
  source_type: string | null;
  source_no: string | null;
  amount: number | string;
  payment_method: string;
  bank_account: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  voucher_no: string | null;
  payment_date: string | Date;
  operator_id: number | string | null;
  status: string;
  remark: string | null;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 付款单审核查询行（SELECT id, status, source_type, source_no, amount） */
interface PurchasePaymentApproveRow {
  id: number | string;
  status: string;
  source_type: string | null;
  source_no: string | null;
  amount: number | string;
}

/** 付款单状态查询行（SELECT id, status） */
interface PurchasePaymentStatusRow {
  id: number | string;
  status: string;
}

export async function list(params: {
  page: number; pageSize: number; tenantId: string;
  supplierId?: number; paymentType?: string; status?: string; dateStart?: string; dateEnd?: string;
}) {
  const { page, pageSize, tenantId, supplierId, paymentType, status, dateStart, dateEnd } = params;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (supplierId !== undefined) {
    conditions.push("supplier_id = ?");
    queryParams.push(supplierId);
  }
  if (paymentType) {
    conditions.push("payment_type = ?");
    queryParams.push(paymentType);
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
  const payments = await queryWithTenant<PurchasePaymentRow>(
    `SELECT * FROM t_purchase_payment WHERE 1=1${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  return payments;
}

export async function getDetail(paymentNo: string, tenantId: string) {
  const payment = await queryOneWithTenant<PurchasePaymentRow>(
    "SELECT * FROM t_purchase_payment WHERE payment_no = ?",
    [paymentNo],
    tenantId
  );
  if (!payment) throw Object.assign(new Error("付款单不存在"), { statusCode: 404 });
  return payment;
}

export async function create(body: {
  supplier_id: number; supplier_name: string; payment_type?: string; source_type?: string;
  source_no?: string; amount: number; payment_method?: string; bank_account?: string;
  bank_account_name?: string; bank_name?: string; voucher_no?: string;
  payment_date: string; remark?: string;
}, tenantId: string, userId: number, username: string) {
  const paymentNo = makeBizNo("FK");

  await transaction(async (conn) => {
    await conn.query(
      `INSERT INTO t_purchase_payment (payment_no, supplier_id, supplier_name, payment_type, source_type, source_no,
        amount, payment_method, bank_account, bank_account_name, bank_name, voucher_no,
        payment_date, operator_id, status, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [paymentNo, body.supplier_id, body.supplier_name, body.payment_type || "ORDER",
        body.source_type || null, body.source_no || null, body.amount,
        body.payment_method || "BANK", body.bank_account || null, body.bank_account_name || null,
        body.bank_name || null, body.voucher_no || null, body.payment_date,
        userId, body.remark || null, tenantId]
    );
    await conn.query(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_payment", "CREATE", paymentNo, "purchase_payment", userId, username, `创建付款单: ${paymentNo}, 金额: ${body.amount}`, tenantId]
    );
  });

  return { payment_no: paymentNo };
}

export async function approve(paymentNo: string, tenantId: string, userId: number, username: string) {
  const payment = await queryOneWithTenant<PurchasePaymentApproveRow>(
    "SELECT id, status, source_type, source_no, amount FROM t_purchase_payment WHERE payment_no = ?",
    [paymentNo],
    tenantId
  );
  if (!payment) throw Object.assign(new Error("付款单不存在"), { statusCode: 404 });
  if (payment.status !== "PENDING") throw Object.assign(new Error("只有待审核状态的付款单可以审核"), { statusCode: 400 });

  await transaction(async (conn) => {
    await conn.query("UPDATE t_purchase_payment SET status = 'COMPLETED' WHERE payment_no = ?", [paymentNo]);

    if (payment.source_type === "PURCHASE_ORDER" && payment.source_no) {
      const [orderRows] = await conn.query(
        "SELECT payable_amount, paid_amount FROM t_purchase_order WHERE order_no = ?",
        [payment.source_no]
      );
      const orderRow = (orderRows as unknown as Record<string, unknown>[])?.[0];
      if (orderRow) {
        const newPaidAmount = Number(orderRow.paid_amount) + Number(payment.amount);
        const newUnpaidAmount = Number(orderRow.payable_amount) - newPaidAmount;
        await conn.query(
          "UPDATE t_purchase_order SET paid_amount = ?, unpaid_amount = ? WHERE order_no = ?",
          [newPaidAmount, Math.max(0, newUnpaidAmount), payment.source_no]
        );
      }
    }

    await conn.query(
      "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_payment", "APPROVE", paymentNo, "purchase_payment", userId, username, `审核通过: ${paymentNo}`, tenantId]
    );
  });

  return { payment_no: paymentNo };
}

export async function voidPayment(paymentNo: string, tenantId: string, userId: number, username: string) {
  const payment = await queryOneWithTenant<PurchasePaymentStatusRow>(
    "SELECT id, status FROM t_purchase_payment WHERE payment_no = ?",
    [paymentNo],
    tenantId
  );
  if (!payment) throw Object.assign(new Error("付款单不存在"), { statusCode: 404 });
  if (payment.status !== "PENDING") throw Object.assign(new Error("只有待审核状态的付款单可以作废"), { statusCode: 400 });

  await queryWithTenant("UPDATE t_purchase_payment SET status = 'VOIDED' WHERE payment_no = ?", [paymentNo], tenantId);
  await queryWithTenant(
    "INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase_payment", "VOID", paymentNo, "purchase_payment", userId, username, `作废付款单: ${paymentNo}`, tenantId],
    tenantId
  );
  return { payment_no: paymentNo };
}