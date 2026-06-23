import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const purchasePaymentRouter = Router();

// ========== 付款单管理 ==========

// 创建付款单
purchasePaymentRouter.post("/", asyncHandler(async (req, res) => {
  const body = z.object({
    purchaseOrderId: z.number().int().positive(),
    supplierId: z.number().int().positive(),
    paymentAmount: z.number().min(0),
    paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "CHECK", "OTHER"]).default("BANK_TRANSFER"),
    bankAccount: z.string().max(100).optional(),
    remark: z.string().max(500).optional()
  }).parse(req.body);

  const paymentNo = makeBizNo("PP");

  await transaction(async (conn) => {
    await (conn as any).execute(
      `INSERT INTO purchase_payment (payment_no, purchase_order_id, supplier_id, payment_amount, payment_method, bank_account, remark, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [paymentNo, body.purchaseOrderId, body.supplierId, body.paymentAmount, body.paymentMethod, body.bankAccount ?? null, body.remark ?? null]
    );
  });

  const record = await queryOne<any>(
    `SELECT id, payment_no AS paymentNo, purchase_order_id AS purchaseOrderId, supplier_id AS supplierId,
            payment_amount AS paymentAmount, payment_method AS paymentMethod, bank_account AS bankAccount,
            remark, status, created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_payment WHERE payment_no = ?`,
    [paymentNo]
  );

  res.json(ok(record));
}));

// 付款单列表
purchasePaymentRouter.get("/", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.supplierId) {
    conditions.push("pp.supplier_id = ?");
    params.push(Number(req.query.supplierId));
  }
  if (req.query.status) {
    conditions.push("pp.status = ?");
    params.push(req.query.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT pp.id, pp.payment_no AS paymentNo, pp.purchase_order_id AS purchaseOrderId, pp.supplier_id AS supplierId,
            s.name AS supplierName,
            pp.payment_amount AS paymentAmount, pp.payment_method AS paymentMethod, pp.bank_account AS bankAccount,
            pp.remark, pp.status,
            pp.approved_by AS approvedBy, pp.approved_at AS approvedAt,
            pp.paid_at AS paidAt, pp.paid_by AS paidBy,
            pp.created_at AS createdAt, pp.updated_at AS updatedAt
     FROM purchase_payment pp
     LEFT JOIN supplier s ON s.id = pp.supplier_id
     ${where}
     ORDER BY pp.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM purchase_payment pp ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 付款单详情
purchasePaymentRouter.get("/statistics", asyncHandler(async (_req, res) => {
  const monthTotal = await queryOne<any>(
    `SELECT COALESCE(SUM(payment_amount), 0) AS total
     FROM purchase_payment
     WHERE status = 'PAID' AND MONTH(paid_at) = MONTH(NOW()) AND YEAR(paid_at) = YEAR(NOW())`
  );

  const pendingApprove = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM purchase_payment WHERE status = 'PENDING'`
  );

  const pendingPay = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM purchase_payment WHERE status = 'APPROVED'`
  );

  res.json(ok({
    monthPaidTotal: Number(monthTotal?.total ?? 0),
    pendingApproveCount: Number(pendingApprove?.count ?? 0),
    pendingPayCount: Number(pendingPay?.count ?? 0)
  }));
}));

// 付款单详情
purchasePaymentRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const record = await queryOne<any>(
    `SELECT pp.id, pp.payment_no AS paymentNo, pp.purchase_order_id AS purchaseOrderId, pp.supplier_id AS supplierId,
            s.name AS supplierName,
            pp.payment_amount AS paymentAmount, pp.payment_method AS paymentMethod, pp.bank_account AS bankAccount,
            pp.remark, pp.status,
            pp.approved_by AS approvedBy, pp.approved_at AS approvedAt,
            pp.paid_at AS paidAt, pp.paid_by AS paidBy,
            pp.created_at AS createdAt, pp.updated_at AS updatedAt
     FROM purchase_payment pp
     LEFT JOIN supplier s ON s.id = pp.supplier_id
     WHERE pp.id = ?`,
    [id]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "付款单不存在" });
    return;
  }

  res.json(ok(record));
}));

// 更新付款单
purchasePaymentRouter.put("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, status FROM purchase_payment WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "付款单不存在" });
    return;
  }
  if (existing.status !== "PENDING") {
    res.status(400).json({ code: "400", message: "仅待审核状态的付款单可编辑" });
    return;
  }

  const body = z.object({
    paymentAmount: z.number().min(0).optional(),
    paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "CHECK", "OTHER"]).optional(),
    bankAccount: z.string().max(100).optional(),
    remark: z.string().max(500).optional()
  }).parse(req.body);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.paymentAmount !== undefined) { updates.push("payment_amount = ?"); params.push(body.paymentAmount); }
  if (body.paymentMethod !== undefined) { updates.push("payment_method = ?"); params.push(body.paymentMethod); }
  if (body.bankAccount !== undefined) { updates.push("bank_account = ?"); params.push(body.bankAccount); }
  if (body.remark !== undefined) { updates.push("remark = ?"); params.push(body.remark); }

  if (updates.length > 0) {
    await query(`UPDATE purchase_payment SET ${updates.join(", ")} WHERE id = ?`, [...params, id]);
  }

  const record = await queryOne<any>(
    `SELECT id, payment_no AS paymentNo, purchase_order_id AS purchaseOrderId, supplier_id AS supplierId,
            payment_amount AS paymentAmount, payment_method AS paymentMethod, bank_account AS bankAccount,
            remark, status, created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_payment WHERE id = ?`,
    [id]
  );

  res.json(ok(record));
}));

// 审核付款单
purchasePaymentRouter.post("/:id/approve", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, status FROM purchase_payment WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "付款单不存在" });
    return;
  }
  if (existing.status !== "PENDING") {
    res.status(400).json({ code: "400", message: "仅待审核状态的付款单可审核" });
    return;
  }

  await query(
    `UPDATE purchase_payment SET status = 'APPROVED', approved_by = ?, approved_at = NOW() WHERE id = ?`,
    [req.user!.id, id]
  );

  const record = await queryOne<any>(
    `SELECT id, payment_no AS paymentNo, status, approved_by AS approvedBy, approved_at AS approvedAt, updated_at AS updatedAt
     FROM purchase_payment WHERE id = ?`,
    [id]
  );

  res.json(ok(record));
}));

// 确认付款
purchasePaymentRouter.post("/:id/pay", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, status FROM purchase_payment WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "付款单不存在" });
    return;
  }
  if (existing.status !== "APPROVED") {
    res.status(400).json({ code: "400", message: "仅已审核状态的付款单可确认付款" });
    return;
  }

  await transaction(async (conn) => {
    await (conn as any).execute(
      `UPDATE purchase_payment SET status = 'PAID', paid_at = NOW(), paid_by = ? WHERE id = ?`,
      [req.user!.id, id]
    );
    // 更新采购单已付金额
    const payment = await queryOne<any>("SELECT purchase_order_id, payment_amount FROM purchase_payment WHERE id = ?", [id]);
    if (payment) {
      await (conn as any).execute(
        `UPDATE purchase_order SET paid_amount = COALESCE(paid_amount, 0) + ? WHERE id = ?`,
        [payment.payment_amount, payment.purchase_order_id]
      );
    }
  });

  const record = await queryOne<any>(
    `SELECT id, payment_no AS paymentNo, status, paid_at AS paidAt, paid_by AS paidBy, updated_at AS updatedAt
     FROM purchase_payment WHERE id = ?`,
    [id]
  );

  res.json(ok(record));
}));

// 取消付款单
purchasePaymentRouter.post("/:id/cancel", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, status FROM purchase_payment WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "付款单不存在" });
    return;
  }
  if (existing.status === "PAID" || existing.status === "CANCELLED") {
    res.status(400).json({ code: "400", message: "已付款或已取消的付款单不可取消" });
    return;
  }

  await query(`UPDATE purchase_payment SET status = 'CANCELLED' WHERE id = ?`, [id]);

  const record = await queryOne<any>(
    `SELECT id, payment_no AS paymentNo, status, updated_at AS updatedAt
     FROM purchase_payment WHERE id = ?`,
    [id]
  );

  res.json(ok(record));
}));

// ========== 供应商对账 ==========

// 生成对账单
purchasePaymentRouter.post("/supplier-statements/generate", asyncHandler(async (req, res) => {
  const body = z.object({
    supplierId: z.number().int().positive(),
    periodStart: z.string(),
    periodEnd: z.string(),
    remark: z.string().max(500).optional()
  }).parse(req.body);

  const statementNo = makeBizNo("SS");

  const result = await transaction(async (conn) => {
    // 查询时间段内的采购订单
    const purchaseOrders = await (conn as any).execute(
      `SELECT id, purchase_no, total_amount
       FROM purchase_order
       WHERE supplier_id = ? AND status IN ('APPROVED', 'WAREHOUSED')
         AND created_at >= ? AND created_at <= DATE_ADD(?, INTERVAL 1 DAY)`,
      [body.supplierId, body.periodStart, body.periodEnd]
    ) as any;
    const poList = (purchaseOrders[0] as any[]) || [];

    // 查询时间段内的付款
    const payments = await (conn as any).execute(
      `SELECT purchase_order_id, payment_amount
       FROM purchase_payment
       WHERE supplier_id = ? AND status = 'PAID'
         AND paid_at >= ? AND paid_at <= DATE_ADD(?, INTERVAL 1 DAY)`,
      [body.supplierId, body.periodStart, body.periodEnd]
    ) as any;
    const payList = (payments[0] as any[]) || [];

    // 查询时间段内的退货
    const returns = await (conn as any).execute(
      `SELECT purchase_order_id, return_amount
       FROM purchase_return
       WHERE supplier_id = ? AND status IN ('APPROVED', 'COMPLETED')
         AND created_at >= ? AND created_at <= DATE_ADD(?, INTERVAL 1 DAY)`,
      [body.supplierId, body.periodStart, body.periodEnd]
    ) as any;
    const returnList = (returns[0] as any[]) || [];

    // 汇总
    let totalPurchase = 0;
    let totalPaid = 0;
    let totalReturn = 0;

    const items: any[] = [];
    for (const po of poList) {
      const poPayments = payList.filter((p: any) => p.purchase_order_id === po.id);
      const poReturns = returnList.filter((r: any) => r.purchase_order_id === po.id);
      const poPaid = poPayments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0);
      const poReturn = poReturns.reduce((s: number, r: any) => s + Number(r.return_amount), 0);

      totalPurchase += Number(po.total_amount);
      totalPaid += poPaid;
      totalReturn += poReturn;

      items.push({
        purchaseOrderId: po.id,
        purchaseAmount: po.total_amount,
        paymentAmount: poPaid,
        returnAmount: poReturn
      });
    }

    // 插入对账单
    const insertResult = await (conn as any).execute(
      `INSERT INTO supplier_statement (statement_no, supplier_id, period_start, period_end,
         total_purchase_amount, total_paid_amount, total_return_amount, status, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [statementNo, body.supplierId, body.periodStart, body.periodEnd,
       totalPurchase, totalPaid, totalReturn, body.remark ?? null]
    );
    const statementId = (insertResult as any).insertId;

    // 插入明细
    for (const item of items) {
      await (conn as any).execute(
        `INSERT INTO supplier_statement_item (statement_id, purchase_order_id, purchase_amount, payment_amount, return_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [statementId, item.purchaseOrderId, item.purchaseAmount, item.paymentAmount, item.returnAmount]
      );
    }

    return { statementId, totalPurchase, totalPaid, totalReturn };
  });

  const record = await queryOne<any>(
    `SELECT id, statement_no AS statementNo, supplier_id AS supplierId, period_start AS periodStart, period_end AS periodEnd,
            total_purchase_amount AS totalPurchaseAmount, total_paid_amount AS totalPaidAmount,
            total_return_amount AS totalReturnAmount, balance_amount AS balanceAmount,
            status, remark, created_at AS createdAt
     FROM supplier_statement WHERE id = ?`,
    [result.statementId]
  );

  res.json(ok(record));
}));

// 对账单列表
purchasePaymentRouter.get("/supplier-statements", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.supplierId) {
    conditions.push("ss.supplier_id = ?");
    params.push(Number(req.query.supplierId));
  }
  if (req.query.status) {
    conditions.push("ss.status = ?");
    params.push(req.query.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT ss.id, ss.statement_no AS statementNo, ss.supplier_id AS supplierId,
            s.name AS supplierName,
            ss.period_start AS periodStart, ss.period_end AS periodEnd,
            ss.total_purchase_amount AS totalPurchaseAmount, ss.total_paid_amount AS totalPaidAmount,
            ss.total_return_amount AS totalReturnAmount, ss.balance_amount AS balanceAmount,
            ss.status, ss.remark,
            ss.confirmed_by AS confirmedBy, ss.confirmed_at AS confirmedAt,
            ss.created_at AS createdAt, ss.updated_at AS updatedAt
     FROM supplier_statement ss
     LEFT JOIN supplier s ON s.id = ss.supplier_id
     ${where}
     ORDER BY ss.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM supplier_statement ss ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 对账单详情（含明细）
purchasePaymentRouter.get("/supplier-statements/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const record = await queryOne<any>(
    `SELECT ss.id, ss.statement_no AS statementNo, ss.supplier_id AS supplierId,
            s.name AS supplierName,
            ss.period_start AS periodStart, ss.period_end AS periodEnd,
            ss.total_purchase_amount AS totalPurchaseAmount, ss.total_paid_amount AS totalPaidAmount,
            ss.total_return_amount AS totalReturnAmount, ss.balance_amount AS balanceAmount,
            ss.status, ss.remark,
            ss.confirmed_by AS confirmedBy, ss.confirmed_at AS confirmedAt,
            ss.created_at AS createdAt, ss.updated_at AS updatedAt
     FROM supplier_statement ss
     LEFT JOIN supplier s ON s.id = ss.supplier_id
     WHERE ss.id = ?`,
    [id]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "对账单不存在" });
    return;
  }

  const items = await query<any>(
    `SELECT ssi.id, ssi.statement_id AS statementId, ssi.purchase_order_id AS purchaseOrderId,
            po.purchase_no AS purchaseNo,
            ssi.purchase_amount AS purchaseAmount, ssi.payment_amount AS paymentAmount,
            ssi.return_amount AS returnAmount, ssi.balance
     FROM supplier_statement_item ssi
     LEFT JOIN purchase_order po ON po.id = ssi.purchase_order_id
     WHERE ssi.statement_id = ?
     ORDER BY ssi.id`,
    [id]
  );

  res.json(ok({ ...record, items }));
}));

// 确认对账
purchasePaymentRouter.post("/supplier-statements/:id/confirm", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, status FROM supplier_statement WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "对账单不存在" });
    return;
  }
  if (existing.status !== "DRAFT") {
    res.status(400).json({ code: "400", message: "仅草稿状态的对账单可确认" });
    return;
  }

  await query(
    `UPDATE supplier_statement SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = NOW() WHERE id = ?`,
    [req.user!.id, id]
  );

  const record = await queryOne<any>(
    `SELECT id, statement_no AS statementNo, status, confirmed_by AS confirmedBy, confirmed_at AS confirmedAt, updated_at AS updatedAt
     FROM supplier_statement WHERE id = ?`,
    [id]
  );

  res.json(ok(record));
}));

// 标记争议
purchasePaymentRouter.post("/supplier-statements/:id/dispute", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = z.object({
    remark: z.string().max(500).optional()
  }).parse(req.body);

  const existing = await queryOne<any>("SELECT id, status FROM supplier_statement WHERE id = ?", [id]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "对账单不存在" });
    return;
  }
  if (existing.status === "CONFIRMED") {
    res.status(400).json({ code: "400", message: "已确认的对账单不可标记争议" });
    return;
  }

  await query(
    `UPDATE supplier_statement SET status = 'DISPUTED', remark = COALESCE(?, remark) WHERE id = ?`,
    [body.remark ?? null, id]
  );

  const record = await queryOne<any>(
    `SELECT id, statement_no AS statementNo, status, remark, updated_at AS updatedAt
     FROM supplier_statement WHERE id = ?`,
    [id]
  );

  res.json(ok(record));
}));
