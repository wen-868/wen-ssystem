import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const customerPaymentRouter = Router();

// 列表查询
customerPaymentRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { customer_id, status, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId!;

  let sql = "SELECT * FROM customer_payment WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (customer_id) {
    sql += " AND customer_id = ?";
    params.push(Number(customer_id));
  }

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  if (start_date) {
    sql += " AND payment_date >= ?";
    params.push(start_date);
  }

  if (end_date) {
    sql += " AND payment_date <= ?";
    params.push(end_date);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const payments = await query<any>(sql, params);
  res.json(ok(payments));
}));

// 详情查询
customerPaymentRouter.get("/:receiptNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { receiptNo } = req.params;
  const tenantId = req.tenantId!;

  const payment = await queryOne<any>(
    "SELECT * FROM customer_payment WHERE receipt_no = ? AND tenant_id = ?",
    [receiptNo, tenantId]
  );

  if (!payment) {
    res.status(404).json({ code: "404", message: "收款单不存在" });
    return;
  }

  res.json(ok(payment));
}));

// 创建收款单
customerPaymentRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    customer_id: z.number().int().positive(),
    customer_name: z.string().min(1).max(64),
    amount: z.number().min(0.01),
    payment_method: z.enum(["CASH", "BANK", "WECHAT", "ALIPAY", "COLLECTION"]).default("CASH"),
    source_type: z.string().max(32).optional(),
    source_no: z.string().max(64).optional(),
    voucher_no: z.string().max(64).optional(),
    payment_date: z.string(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const receiptNo = makeBizNo("SK");

  await transaction(async (conn) => {
    // 插入收款单
    await conn.execute(
      `INSERT INTO customer_payment (
        receipt_no, customer_id, customer_name, amount, payment_method,
        source_type, source_no, voucher_no, payment_date, operator_id,
        status, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
      [
        receiptNo, body.customer_id, body.customer_name, body.amount,
        body.payment_method, body.source_type || null, body.source_no || null,
        body.voucher_no || null, body.payment_date, req.user!.id,
        body.remark || null, tenantId
      ]
    );

    // 如果是销售单收款，更新销售单的已收金额
    if (body.source_type === "SALE_BILL" && body.source_no) {
      const bill = await conn.execute(
        "SELECT receivable_amount, received_amount FROM sale_bill WHERE bill_no = ?",
        [body.source_no]
      );

      const billRow = (bill[0] as any[])?.[0];
      if (billRow) {
        const newReceivedAmount = Number(billRow.received_amount) + Number(body.amount);
        const newUnreceivedAmount = Number(billRow.receivable_amount) - newReceivedAmount;

        // 更新收款状态
        let collectionStatus = "PARTIAL";
        if (newUnreceivedAmount <= 0) {
          collectionStatus = "PAID";
        }

        await conn.execute(
          "UPDATE sale_bill SET received_amount = ?, unreceived_amount = ?, collection_status = ? WHERE bill_no = ?",
          [newReceivedAmount, Math.max(0, newUnreceivedAmount), collectionStatus, body.source_no]
        );
      }
    }

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_payment", "CREATE", receiptNo, "customer_payment", req.user!.id, req.user!.username, `创建收款单: ${receiptNo}, 金额: ${body.amount}`, tenantId]
    );
  });

  res.json(ok({ receipt_no: receiptNo }));
}));

// 作废收款单（COMPLETED -> VOIDED）
customerPaymentRouter.post("/:receiptNo/void", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { receiptNo } = req.params;
  const tenantId = req.tenantId!;

  const payment = await queryOne<any>(
    "SELECT id, status, source_type, source_no, amount FROM customer_payment WHERE receipt_no = ? AND tenant_id = ?",
    [receiptNo, tenantId]
  );

  if (!payment) {
    res.status(404).json({ code: "404", message: "收款单不存在" });
    return;
  }

  if (payment.status !== "COMPLETED") {
    res.status(400).json({ code: "400", message: "只有已完成状态的收款单可以作废" });
    return;
  }

  await transaction(async (conn) => {
    // 更新收款单状态
    await conn.execute(
      "UPDATE customer_payment SET status = 'VOIDED' WHERE receipt_no = ?",
      [receiptNo]
    );

    // 如果是销售单收款，回滚销售单的已收金额
    if (payment.source_type === "SALE_BILL" && payment.source_no) {
      const bill = await conn.execute(
        "SELECT receivable_amount, received_amount FROM sale_bill WHERE bill_no = ?",
        [payment.source_no]
      );

      const billRow = (bill[0] as any[])?.[0];
      if (billRow) {
        const newReceivedAmount = Number(billRow.received_amount) - Number(payment.amount);
        const newUnreceivedAmount = Number(billRow.receivable_amount) - newReceivedAmount;

        // 更新收款状态
        let collectionStatus = "UNPAID";
        if (newReceivedAmount > 0 && newUnreceivedAmount > 0) {
          collectionStatus = "PARTIAL";
        } else if (newUnreceivedAmount <= 0) {
          collectionStatus = "PAID";
        }

        await conn.execute(
          "UPDATE sale_bill SET received_amount = ?, unreceived_amount = ?, collection_status = ? WHERE bill_no = ?",
          [Math.max(0, newReceivedAmount), newUnreceivedAmount, collectionStatus, payment.source_no]
        );
      }
    }

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["customer_payment", "VOID", receiptNo, "customer_payment", req.user!.id, req.user!.username, `作废收款单: ${receiptNo}`, tenantId]
    );
  });

  res.json(ok({ receipt_no: receiptNo }));
}));
