import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const purchasePaymentRouter = Router();

// 列表查询
purchasePaymentRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { supplier_id, payment_type, status, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  const tenantId = req.tenantId!;

  let sql = "SELECT * FROM purchase_payment WHERE tenant_id = ?";
  const params: any[] = [tenantId];

  if (supplier_id) {
    sql += " AND supplier_id = ?";
    params.push(Number(supplier_id));
  }

  if (payment_type) {
    sql += " AND payment_type = ?";
    params.push(payment_type);
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
purchasePaymentRouter.get("/:paymentNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { paymentNo } = req.params;
  const tenantId = req.tenantId!;

  const payment = await queryOne<any>(
    "SELECT * FROM purchase_payment WHERE payment_no = ? AND tenant_id = ?",
    [paymentNo, tenantId]
  );

  if (!payment) {
    res.status(404).json({ code: "404", message: "付款单不存在" });
    return;
  }

  res.json(ok(payment));
}));

// 创建付款单
purchasePaymentRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const body = z.object({
    supplier_id: z.number().int().positive(),
    supplier_name: z.string().min(1).max(128),
    payment_type: z.enum(["ORDER", "RETURN", "ADVANCE"]).default("ORDER"),
    source_type: z.string().max(32).optional(),
    source_no: z.string().max(64).optional(),
    amount: z.number().min(0.01),
    payment_method: z.enum(["BANK", "CASH", "WECHAT", "ALIPAY"]).default("BANK"),
    bank_account: z.string().max(64).optional(),
    bank_account_name: z.string().max(64).optional(),
    bank_name: z.string().max(128).optional(),
    voucher_no: z.string().max(64).optional(),
    payment_date: z.string(),
    remark: z.string().max(255).optional(),
  }).parse(req.body);

  const tenantId = req.tenantId!;
  const paymentNo = makeBizNo("FK");

  await transaction(async (conn) => {
    // 插入付款 record
    await conn.execute(
      `INSERT INTO purchase_payment (
        payment_no, supplier_id, supplier_name, payment_type, source_type, source_no,
        amount, payment_method, bank_account, bank_account_name, bank_name, voucher_no,
        payment_date, operator_id, status, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [
        paymentNo, body.supplier_id, body.supplier_name, body.payment_type,
        body.source_type || null, body.source_no || null,
        body.amount, body.payment_method, body.bank_account || null,
        body.bank_account_name || null, body.bank_name || null, body.voucher_no || null,
        body.payment_date, req.user!.id, body.remark || null, tenantId
      ]
    );

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_payment", "CREATE", paymentNo, "purchase_payment", req.user!.id, req.user!.username, `创建付款单: ${paymentNo}, 金额: ${body.amount}`, tenantId]
    );
  });

  res.json(ok({ payment_no: paymentNo }));
}));

// 审核通过（PENDING -> COMPLETED）
purchasePaymentRouter.post("/:paymentNo/approve", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { paymentNo } = req.params;
  const tenantId = req.tenantId!;

  const payment = await queryOne<any>(
    "SELECT id, status, source_type, source_no, amount FROM purchase_payment WHERE payment_no = ? AND tenant_id = ?",
    [paymentNo, tenantId]
  );

  if (!payment) {
    res.status(404).json({ code: "404", message: "付款单不存在" });
    return;
  }

  if (payment.status !== "PENDING") {
    res.status(400).json({ code: "400", message: "只有待审核状态的付款单可以审核" });
    return;
  }

  await transaction(async (conn) => {
    // 更新付款单状态
    await conn.execute(
      "UPDATE purchase_payment SET status = 'COMPLETED' WHERE payment_no = ?",
      [paymentNo]
    );

    // 如果是订单付款，更新采购订单的已付金额
    if (payment.source_type === "PURCHASE_ORDER" && payment.source_no) {
      const order = await conn.execute(
        "SELECT payable_amount, paid_amount FROM purchase_order WHERE order_no = ?",
        [payment.source_no]
      );

      const orderRow = (order[0] as any[])?.[0];
      if (orderRow) {
        const newPaidAmount = Number(orderRow.paid_amount) + Number(payment.amount);
        const newUnpaidAmount = Number(orderRow.payable_amount) - newPaidAmount;

        await conn.execute(
          "UPDATE purchase_order SET paid_amount = ?, unpaid_amount = ? WHERE order_no = ?",
          [newPaidAmount, Math.max(0, newUnpaidAmount), payment.source_no]
        );
      }
    }

    // 写操作日志
    await conn.execute(
      "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ["purchase_payment", "APPROVE", paymentNo, "purchase_payment", req.user!.id, req.user!.username, `审核通过: ${paymentNo}`, tenantId]
    );
  });

  res.json(ok({ payment_no: paymentNo }));
}));

// 作废付款单（PENDING -> VOIDED）
purchasePaymentRouter.post("/:paymentNo/void", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const { paymentNo } = req.params;
  const tenantId = req.tenantId!;

  const payment = await queryOne<any>(
    "SELECT id, status FROM purchase_payment WHERE payment_no = ? AND tenant_id = ?",
    [paymentNo, tenantId]
  );

  if (!payment) {
    res.status(404).json({ code: "404", message: "付款单不存在" });
    return;
  }

  if (payment.status !== "PENDING") {
    res.status(400).json({ code: "400", message: "只有待审核状态的付款单可以作废" });
    return;
  }

  await query(
    "UPDATE purchase_payment SET status = 'VOIDED' WHERE payment_no = ?",
    [paymentNo]
  );

  await query(
    "INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["purchase_payment", "VOID", paymentNo, "purchase_payment", req.user!.id, req.user!.username, `作废付款单: ${paymentNo}`, tenantId]
  );

  res.json(ok({ payment_no: paymentNo }));
}));
