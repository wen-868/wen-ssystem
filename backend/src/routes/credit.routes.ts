import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok } from "../shared/response.js";

export const creditRouter = Router();

// ========== 授信额度管理 ==========

// 获取授信列表（支持搜索/状态筛选/分页）
creditRouter.get("/credits", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.status) {
    conditions.push("cc.status = ?");
    params.push(req.query.status);
  }
  if (req.query.keyword) {
    conditions.push("(m.name LIKE ? OR m.mobile LIKE ?)");
    const kw = `%${String(req.query.keyword)}%`;
    params.push(kw, kw);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT cc.id, cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.payment_term AS paymentTerm, cc.late_fee_rate AS lateFeeRate,
            cc.max_late_fee_rate AS maxLateFeeRate, cc.warning_threshold AS warningThreshold,
            cc.overdue_freeze_days AS overdueFreezeDays,
            cc.status, cc.freeze_reason AS freezeReason,
            cc.frozen_at AS frozenAt, cc.unfrozen_at AS unfrozenAt,
            cc.version, cc.created_at AS createdAt, cc.updated_at AS updatedAt
     FROM customer_credit cc
     LEFT JOIN member m ON m.id = cc.customer_id
     ${where}
     ORDER BY cc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM customer_credit cc
     LEFT JOIN member m ON m.id = cc.customer_id
     ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 获取客户授信详情
creditRouter.get("/credits/:customerId", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);
  const record = await queryOne<any>(
    `SELECT cc.id, cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.payment_term AS paymentTerm, cc.late_fee_rate AS lateFeeRate,
            cc.max_late_fee_rate AS maxLateFeeRate, cc.warning_threshold AS warningThreshold,
            cc.overdue_freeze_days AS overdueFreezeDays,
            cc.status, cc.freeze_reason AS freezeReason,
            cc.frozen_at AS frozenAt, cc.unfrozen_at AS unfrozenAt,
            cc.version, cc.created_at AS createdAt, cc.updated_at AS updatedAt
     FROM customer_credit cc
     LEFT JOIN member m ON m.id = cc.customer_id
     WHERE cc.customer_id = ?`,
    [customerId]
  );

  if (!record) {
    res.status(404).json({ code: "404", message: "该客户尚未开通授信" });
    return;
  }

  res.json(ok(record));
}));

// 初始化/设置授信额度
creditRouter.post("/credits/:customerId", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);

  const body = z.object({
    creditLimit: z.number().min(0),
    paymentTerm: z.enum(["COD", "NET_7", "NET_15", "NET_30", "NET_60", "NET_90"]).default("COD"),
    lateFeeRate: z.number().min(0).max(1).default(0.0005),
    maxLateFeeRate: z.number().min(0).max(1).default(0.3),
    warningThreshold: z.number().min(0).max(1).default(0.80),
    overdueFreezeDays: z.number().int().min(0).default(15)
  }).parse(req.body);

  // 检查客户是否存在
  const customer = await queryOne<any>(
    "SELECT id, name FROM member WHERE id = ?",
    [customerId]
  );
  if (!customer) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }

  // 检查是否已有授信记录
  const existing = await queryOne<any>(
    "SELECT id, status FROM customer_credit WHERE customer_id = ?",
    [customerId]
  );
  if (existing) {
    res.status(400).json({ code: "400", message: "该客户已有授信记录，请使用调整接口" });
    return;
  }

  await query(
    `INSERT INTO customer_credit (customer_id, credit_limit, payment_term, late_fee_rate,
       max_late_fee_rate, warning_threshold, overdue_freeze_days, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [customerId, body.creditLimit, body.paymentTerm, body.lateFeeRate,
     body.maxLateFeeRate, body.warningThreshold, body.overdueFreezeDays]
  );

  // 记录操作日志
  await query(
    `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark)
     VALUES (?, 'ADJUST_LIMIT', ?, 0, ?, ?, '初始化授信额度')`,
    [customerId, body.creditLimit, body.creditLimit, req.user!.id]
  );

  const record = await queryOne<any>(
    `SELECT cc.id, cc.customer_id AS customerId, cc.credit_limit AS creditLimit,
            cc.credit_used AS creditUsed, cc.credit_frozen AS creditFrozen,
            cc.credit_available AS creditAvailable, cc.payment_term AS paymentTerm,
            cc.status, cc.version, cc.created_at AS createdAt
     FROM customer_credit cc WHERE cc.customer_id = ?`,
    [customerId]
  );

  res.json(ok(record));
}));

// 调整授信额度（需记录日志）
creditRouter.put("/credits/:customerId/limit", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);

  const body = z.object({
    creditLimit: z.number().min(0),
    reason: z.string().max(255).default("调整授信额度")
  }).parse(req.body);

  // 使用乐观锁更新
  const result = await query<any>(
    `UPDATE customer_credit
     SET credit_limit = ?, version = version + 1, updated_at = NOW()
     WHERE customer_id = ? AND status != 'CLOSED'`,
    [body.creditLimit, customerId]
  );

  if ((result as any).affectedRows === 0) {
    res.status(404).json({ code: "404", message: "授信记录不存在或已关闭" });
    return;
  }

  // 记录操作日志
  const credit = await queryOne<any>(
    "SELECT credit_available FROM customer_credit WHERE customer_id = ?",
    [customerId]
  );
  await query(
    `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark)
     VALUES (?, 'ADJUST_LIMIT', ?, ?, ?, ?, ?)`,
    [customerId, body.creditLimit, credit?.credit_available ?? 0, credit?.credit_available ?? 0, req.user!.id, body.reason]
  );

  const record = await queryOne<any>(
    `SELECT cc.id, cc.customer_id AS customerId, cc.credit_limit AS creditLimit,
            cc.credit_used AS creditUsed, cc.credit_frozen AS creditFrozen,
            cc.credit_available AS creditAvailable, cc.payment_term AS paymentTerm,
            cc.status, cc.version, cc.updated_at AS updatedAt
     FROM customer_credit cc WHERE cc.customer_id = ?`,
    [customerId]
  );

  res.json(ok(record));
}));

// 调整账期
creditRouter.put("/credits/:customerId/term", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);

  const body = z.object({
    paymentTerm: z.enum(["COD", "NET_7", "NET_15", "NET_30", "NET_60", "NET_90"]),
    reason: z.string().max(255).default("调整账期")
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, payment_term, status FROM customer_credit WHERE customer_id = ?",
    [customerId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "授信记录不存在" });
    return;
  }
  if (existing.status === "CLOSED") {
    res.status(400).json({ code: "400", message: "授信已关闭，无法调整账期" });
    return;
  }

  await query(
    `UPDATE customer_credit SET payment_term = ?, version = version + 1, updated_at = NOW()
     WHERE customer_id = ?`,
    [body.paymentTerm, customerId]
  );

  // 记录操作日志
  await query(
    `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark)
     VALUES (?, 'MANUAL_ADJUST', 0, 0, 0, ?, ?)`,
    [customerId, req.user!.id, `账期调整: ${existing.payment_term} -> ${body.paymentTerm}, ${body.reason}`]
  );

  const record = await queryOne<any>(
    `SELECT cc.id, cc.customer_id AS customerId, cc.credit_limit AS creditLimit,
            cc.credit_available AS creditAvailable, cc.payment_term AS paymentTerm,
            cc.status, cc.version, cc.updated_at AS updatedAt
     FROM customer_credit cc WHERE cc.customer_id = ?`,
    [customerId]
  );

  res.json(ok(record));
}));

// 校验可用额度
creditRouter.get("/credits/:customerId/check", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);
  const amount = Number(req.query.amount || 0);

  const credit = await queryOne<any>(
    `SELECT cc.credit_limit, cc.credit_used, cc.credit_frozen, cc.credit_available,
            cc.status, cc.warning_threshold, cc.payment_term
     FROM customer_credit cc WHERE cc.customer_id = ?`,
    [customerId]
  );

  if (!credit) {
    res.status(404).json({ code: "404", message: "该客户尚未开通授信" });
    return;
  }

  const available = Number(credit.credit_available);
  const isWarning = credit.warning_threshold > 0
    ? (Number(credit.credit_used) / Number(credit.credit_limit)) >= Number(credit.warning_threshold)
    : false;

  res.json(ok({
    customerId,
    creditLimit: Number(credit.credit_limit),
    creditUsed: Number(credit.credit_used),
    creditFrozen: Number(credit.credit_frozen),
    creditAvailable: available,
    status: credit.status,
    paymentTerm: credit.payment_term,
    isWarning,
    amount,
    sufficient: amount <= 0 || available >= amount
  }));
}));

// 占用额度（下单时调用，需FOR UPDATE防并发）
creditRouter.post("/credits/:customerId/occupy", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);

  const body = z.object({
    amount: z.number().positive(),
    orderNo: z.string().max(64)
  }).parse(req.body);

  await transaction(async (conn) => {
    // SELECT FOR UPDATE 锁定记录
    const rows = await (conn as any).execute(
      `SELECT id, credit_limit, credit_used, credit_frozen, credit_available, status, version
       FROM customer_credit
       WHERE customer_id = ? AND status = 'ACTIVE'
       FOR UPDATE`,
      [customerId]
    );
    const credit = (rows[0] as any[])[0];

    if (!credit) {
      res.status(404).json({ code: "404", message: "授信记录不存在或非ACTIVE状态" });
      return;
    }

    const available = Number(credit.credit_available);
    if (available < body.amount) {
      res.status(400).json({ code: "400", message: `可用额度不足，当前可用: ${available}，需要: ${body.amount}` });
      return;
    }

    const balanceBefore = available;
    const balanceAfter = available - body.amount;

    // 更新已用额度（乐观锁）
    await (conn as any).execute(
      `UPDATE customer_credit
       SET credit_used = credit_used + ?, version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND version = ?`,
      [body.amount, customerId, credit.version]
    );

    // 记录操作日志
    await (conn as any).execute(
      `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, related_order_no, operator_id, remark)
       VALUES (?, 'OCCUPY', ?, ?, ?, ?, ?, '下单占用额度')`,
      [customerId, body.amount, balanceBefore, balanceAfter, body.orderNo, req.user!.id]
    );
  });

  // 返回最新状态
  const credit = await queryOne<any>(
    `SELECT cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.status, cc.version
     FROM customer_credit cc WHERE cc.customer_id = ?`,
    [customerId]
  );

  res.json(ok({
    customerId,
    occupiedAmount: body.amount,
    orderNo: body.orderNo,
    ...credit
  }));
}));

// 释放额度（取消/完成时调用）
creditRouter.post("/credits/:customerId/release", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);

  const body = z.object({
    amount: z.number().positive(),
    orderNo: z.string().max(64),
    remark: z.string().max(255).default("释放额度")
  }).parse(req.body);

  await transaction(async (conn) => {
    // SELECT FOR UPDATE 锁定记录
    const rows = await (conn as any).execute(
      `SELECT id, credit_limit, credit_used, credit_frozen, credit_available, status, version
       FROM customer_credit
       WHERE customer_id = ?
       FOR UPDATE`,
      [customerId]
    );
    const credit = (rows[0] as any[])[0];

    if (!credit) {
      res.status(404).json({ code: "404", message: "授信记录不存在" });
      return;
    }

    const balanceBefore = Number(credit.credit_available);
    const newUsed = Math.max(0, Number(credit.credit_used) - body.amount);
    const balanceAfter = Number(credit.credit_limit) - newUsed - Number(credit.credit_frozen);

    // 更新已用额度
    await (conn as any).execute(
      `UPDATE customer_credit
       SET credit_used = ?, version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND version = ?`,
      [newUsed, customerId, credit.version]
    );

    // 记录操作日志
    await (conn as any).execute(
      `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, related_order_no, operator_id, remark)
       VALUES (?, 'RELEASE', ?, ?, ?, ?, ?, ?)`,
      [customerId, body.amount, balanceBefore, balanceAfter, body.orderNo, req.user!.id, body.remark]
    );
  });

  const credit = await queryOne<any>(
    `SELECT cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.status, cc.version
     FROM customer_credit cc WHERE cc.customer_id = ?`,
    [customerId]
  );

  res.json(ok({
    customerId,
    releasedAmount: body.amount,
    orderNo: body.orderNo,
    ...credit
  }));
}));

// 冻结授信（逾期自动/手动）
creditRouter.post("/credits/:customerId/freeze", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);

  const body = z.object({
    freezeAmount: z.number().min(0).default(0),
    reason: z.string().max(255).default("手动冻结")
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, status, credit_available, version FROM customer_credit WHERE customer_id = ?",
    [customerId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "授信记录不存在" });
    return;
  }
  if (existing.status === "FROZEN") {
    res.status(400).json({ code: "400", message: "授信已处于冻结状态" });
    return;
  }
  if (existing.status === "CLOSED") {
    res.status(400).json({ code: "400", message: "授信已关闭，无法冻结" });
    return;
  }

  const balanceBefore = Number(existing.credit_available);

  await query(
    `UPDATE customer_credit
     SET status = 'FROZEN', credit_frozen = credit_frozen + ?, freeze_reason = ?,
         frozen_at = NOW(), version = version + 1, updated_at = NOW()
     WHERE customer_id = ?`,
    [body.freezeAmount, body.reason, customerId]
  );

  const afterCredit = await queryOne<any>(
    "SELECT credit_available FROM customer_credit WHERE customer_id = ?",
    [customerId]
  );
  const balanceAfter = Number(afterCredit?.credit_available ?? 0);

  // 记录操作日志
  await query(
    `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark)
     VALUES (?, 'FREEZE', ?, ?, ?, ?, ?)`,
    [customerId, body.freezeAmount, balanceBefore, balanceAfter, req.user!.id, body.reason]
  );

  res.json(ok({
    customerId,
    status: "FROZEN",
    frozenAmount: body.freezeAmount,
    freezeReason: body.reason,
    frozenAt: new Date().toISOString()
  }));
}));

// 解冻授信
creditRouter.post("/credits/:customerId/unfreeze", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);

  const body = z.object({
    unfreezeAmount: z.number().min(0).default(0),
    reason: z.string().max(255).default("手动解冻")
  }).parse(req.body);

  const existing = await queryOne<any>(
    "SELECT id, status, credit_available, credit_frozen, version FROM customer_credit WHERE customer_id = ?",
    [customerId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "授信记录不存在" });
    return;
  }
  if (existing.status !== "FROZEN") {
    res.status(400).json({ code: "400", message: "授信未处于冻结状态" });
    return;
  }

  const balanceBefore = Number(existing.credit_available);

  await query(
    `UPDATE customer_credit
     SET status = 'ACTIVE', credit_frozen = GREATEST(0, credit_frozen - ?),
         freeze_reason = NULL, unfrozen_at = NOW(),
         version = version + 1, updated_at = NOW()
     WHERE customer_id = ?`,
    [body.unfreezeAmount, customerId]
  );

  const afterCredit = await queryOne<any>(
    "SELECT credit_available FROM customer_credit WHERE customer_id = ?",
    [customerId]
  );
  const balanceAfter = Number(afterCredit?.credit_available ?? 0);

  // 记录操作日志
  await query(
    `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark)
     VALUES (?, 'UNFREEZE', ?, ?, ?, ?, ?)`,
    [customerId, body.unfreezeAmount, balanceBefore, balanceAfter, req.user!.id, body.reason]
  );

  res.json(ok({
    customerId,
    status: "ACTIVE",
    unfrozenAmount: body.unfreezeAmount,
    unfrozenAt: new Date().toISOString()
  }));
}));

// 授信操作日志
creditRouter.get("/credits/:customerId/logs", requireAuth, asyncHandler(async (req, res) => {
  const customerId = Number(req.params.customerId);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;

  const records = await query<any>(
    `SELECT col.id, col.customer_id AS customerId,
            col.operation_type AS operationType, col.amount,
            col.balance_before AS balanceBefore, col.balance_after AS balanceAfter,
            col.related_order_no AS relatedOrderNo,
            col.operator_id AS operatorId, col.remark,
            col.created_at AS createdAt
     FROM credit_operation_log col
     WHERE col.customer_id = ?
     ORDER BY col.created_at DESC
     LIMIT ? OFFSET ?`,
    [customerId, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM credit_operation_log WHERE customer_id = ?",
    [customerId]
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// ========== 催收管理 ==========

// 催收记录列表（支持等级/客户/日期筛选）
creditRouter.get("/collections", requireAuth, asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.collectionLevel) {
    conditions.push("cr.collection_level = ?");
    params.push(req.query.collectionLevel);
  }
  if (req.query.customerId) {
    conditions.push("cr.customer_id = ?");
    params.push(Number(req.query.customerId));
  }
  if (req.query.contactResult) {
    conditions.push("cr.contact_result = ?");
    params.push(req.query.contactResult);
  }
  if (req.query.startDate) {
    conditions.push("cr.created_at >= ?");
    params.push(req.query.startDate);
  }
  if (req.query.endDate) {
    conditions.push("cr.created_at <= ?");
    params.push(req.query.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await query<any>(
    `SELECT cr.id, cr.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cr.receivable_no AS receivableNo,
            cr.overdue_days AS overdueDays, cr.overdue_amount AS overdueAmount,
            cr.collection_level AS collectionLevel, cr.collection_method AS collectionMethod,
            cr.collection_content AS collectionContent,
            cr.contact_person AS contactPerson, cr.contact_result AS contactResult,
            cr.promised_amount AS promisedAmount, cr.promised_date AS promisedDate,
            cr.next_follow_up_date AS nextFollowUpDate,
            cr.operator_id AS operatorId, cr.created_at AS createdAt
     FROM collection_record cr
     LEFT JOIN member m ON m.id = cr.customer_id
     ${where}
     ORDER BY cr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM collection_record cr
     LEFT JOIN member m ON m.id = cr.customer_id
     ${where}`,
    params
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  }));
}));

// 新增催收记录
creditRouter.post("/collections", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    customerId: z.number().int().positive(),
    receivableNo: z.string().max(64).optional(),
    overdueDays: z.number().int().min(0).default(0),
    overdueAmount: z.number().min(0).default(0),
    collectionLevel: z.enum(["REMIND", "LIGHT", "MEDIUM", "HEAVY", "SEVERE"]),
    collectionMethod: z.enum(["SMS", "PHONE", "VISIT", "LETTER", "LEGAL"]),
    collectionContent: z.string().optional(),
    contactPerson: z.string().max(64).default(""),
    contactResult: z.enum(["PROMISED", "REFUSED", "NO_ANSWER", "PARTIAL_PAID", "DISPUTED"]).optional(),
    promisedAmount: z.number().min(0).optional(),
    promisedDate: z.string().nullable().optional(),
    nextFollowUpDate: z.string().nullable().optional()
  }).parse(req.body);

  // 校验客户是否存在
  const customer = await queryOne<any>(
    "SELECT id, name FROM member WHERE id = ?",
    [body.customerId]
  );
  if (!customer) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }

  await query(
    `INSERT INTO collection_record (customer_id, receivable_no, overdue_days, overdue_amount,
       collection_level, collection_method, collection_content, contact_person,
       contact_result, promised_amount, promised_date, next_follow_up_date, operator_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.customerId, body.receivableNo ?? null, body.overdueDays, body.overdueAmount,
     body.collectionLevel, body.collectionMethod, body.collectionContent ?? null,
     body.contactPerson, body.contactResult ?? null, body.promisedAmount ?? null,
     body.promisedDate ?? null, body.nextFollowUpDate ?? null, req.user!.id]
  );

  const record = await queryOne<any>(
    `SELECT cr.id, cr.customer_id AS customerId, m.name AS customerName,
            cr.receivable_no AS receivableNo,
            cr.overdue_days AS overdueDays, cr.overdue_amount AS overdueAmount,
            cr.collection_level AS collectionLevel, cr.collection_method AS collectionMethod,
            cr.collection_content AS collectionContent,
            cr.contact_person AS contactPerson, cr.contact_result AS contactResult,
            cr.promised_amount AS promisedAmount, cr.promised_date AS promisedDate,
            cr.next_follow_up_date AS nextFollowUpDate,
            cr.operator_id AS operatorId, cr.created_at AS createdAt
     FROM collection_record cr
     LEFT JOIN member m ON m.id = cr.customer_id
     WHERE cr.id = LAST_INSERT_ID()`
  );

  res.json(ok(record));
}));

// 更新催收结果
creditRouter.put("/collections/:id", requireAuth, asyncHandler(async (req, res) => {
  const collectionId = Number(req.params.id);
  const existing = await queryOne<any>(
    "SELECT id FROM collection_record WHERE id = ?",
    [collectionId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "催收记录不存在" });
    return;
  }

  const body = z.object({
    contactResult: z.enum(["PROMISED", "REFUSED", "NO_ANSWER", "PARTIAL_PAID", "DISPUTED"]).optional(),
    promisedAmount: z.number().min(0).optional(),
    promisedDate: z.string().nullable().optional(),
    nextFollowUpDate: z.string().nullable().optional(),
    collectionContent: z.string().optional()
  }).parse(req.body);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.contactResult !== undefined) { updates.push("contact_result = ?"); params.push(body.contactResult); }
  if (body.promisedAmount !== undefined) { updates.push("promised_amount = ?"); params.push(body.promisedAmount); }
  if (body.promisedDate !== undefined) { updates.push("promised_date = ?"); params.push(body.promisedDate); }
  if (body.nextFollowUpDate !== undefined) { updates.push("next_follow_up_date = ?"); params.push(body.nextFollowUpDate); }
  if (body.collectionContent !== undefined) { updates.push("collection_content = ?"); params.push(body.collectionContent); }

  if (updates.length > 0) {
    await query(
      `UPDATE collection_record SET ${updates.join(", ")} WHERE id = ?`,
      [...params, collectionId]
    );
  }

  const record = await queryOne<any>(
    `SELECT cr.id, cr.customer_id AS customerId, m.name AS customerName,
            cr.contact_result AS contactResult, cr.promised_amount AS promisedAmount,
            cr.promised_date AS promisedDate, cr.next_follow_up_date AS nextFollowUpDate,
            cr.collection_content AS collectionContent,
            cr.created_at AS createdAt
     FROM collection_record cr
     LEFT JOIN member m ON m.id = cr.customer_id
     WHERE cr.id = ?`,
    [collectionId]
  );

  res.json(ok(record));
}));

// 逾期客户列表（自动计算逾期天数和金额）
creditRouter.get("/collections/overdue", requireAuth, asyncHandler(async (_req, res) => {
  // 查找所有有授信且未结清的客户，结合账期计算逾期
  const records = await query<any>(
    `SELECT cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cc.credit_used AS creditUsed, cc.credit_limit AS creditLimit,
            cc.payment_term AS paymentTerm, cc.overdue_freeze_days AS overdueFreezeDays,
            cc.status AS creditStatus,
            COALESCE(
              DATEDIFF(NOW(),
                CASE cc.payment_term
                  WHEN 'COD' THEN NOW()
                  WHEN 'NET_7' THEN DATE_SUB(NOW(), INTERVAL 7 DAY)
                  WHEN 'NET_15' THEN DATE_SUB(NOW(), INTERVAL 15 DAY)
                  WHEN 'NET_30' THEN DATE_SUB(NOW(), INTERVAL 30 DAY)
                  WHEN 'NET_60' THEN DATE_SUB(NOW(), INTERVAL 60 DAY)
                  WHEN 'NET_90' THEN DATE_SUB(NOW(), INTERVAL 90 DAY)
                END
              ), 0
            ) AS estimatedOverdueDays,
            cc.credit_used AS estimatedOverdueAmount
     FROM customer_credit cc
     LEFT JOIN member m ON m.id = cc.customer_id
     WHERE cc.credit_used > 0 AND cc.status IN ('ACTIVE', 'FROZEN')
     ORDER BY cc.credit_used DESC`
  );

  res.json(ok({ total: records.length, records }));
}));

// 批量发送催收提醒（短信/站内信）
creditRouter.post("/collections/batch-remind", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    customerIds: z.array(z.number().int().positive()).min(1),
    method: z.enum(["SMS", "PHONE", "LETTER"]).default("SMS"),
    content: z.string().min(1).max(500),
    collectionLevel: z.enum(["REMIND", "LIGHT", "MEDIUM", "HEAVY", "SEVERE"]).default("REMIND")
  }).parse(req.body);

  let successCount = 0;
  const errors: string[] = [];

  for (const customerId of body.customerIds) {
    try {
      // 校验客户是否存在
      const customer = await queryOne<any>(
        "SELECT id, name, mobile FROM member WHERE id = ?",
        [customerId]
      );
      if (!customer) {
        errors.push(`客户${customerId}不存在`);
        continue;
      }

      // 获取授信信息
      const credit = await queryOne<any>(
        "SELECT credit_used, credit_limit FROM customer_credit WHERE customer_id = ?",
        [customerId]
      );

      // 创建催收记录
      await query(
        `INSERT INTO collection_record (customer_id, overdue_days, overdue_amount,
           collection_level, collection_method, collection_content,
           contact_person, operator_id)
         VALUES (?, 0, ?, ?, ?, ?, ?, ?)`,
        [customerId, credit?.credit_used ?? 0, body.collectionLevel, body.method,
         body.content, customer.name, req.user!.id]
      );

      successCount++;
    } catch (err: any) {
      errors.push(`客户${customerId}处理失败: ${err.message}`);
    }
  }

  res.json(ok({
    totalRequested: body.customerIds.length,
    successCount,
    failCount: errors.length,
    errors: errors.length > 0 ? errors : undefined
  }));
}));

// 催收统计（各等级数量、回款率）
creditRouter.get("/collections/statistics", requireAuth, asyncHandler(async (_req, res) => {
  // 各催收等级数量
  const levelStats = await query<any>(
    `SELECT collection_level AS collectionLevel, COUNT(*) AS count
     FROM collection_record
     GROUP BY collection_level
     ORDER BY FIELD(collection_level, 'REMIND', 'LIGHT', 'MEDIUM', 'HEAVY', 'SEVERE')`
  );

  // 各催收结果数量
  const resultStats = await query<any>(
    `SELECT contact_result AS contactResult, COUNT(*) AS count
     FROM collection_record
     WHERE contact_result IS NOT NULL
     GROUP BY contact_result`
  );

  // 总催收次数
  const totalCount = await queryOne<any>(
    "SELECT COUNT(*) AS count FROM collection_record"
  );

  // 承诺还款总金额
  const promisedTotal = await queryOne<any>(
    "SELECT COALESCE(SUM(promised_amount), 0) AS total FROM collection_record WHERE contact_result = 'PROMISED'"
  );

  // 本月催收次数
  const monthCount = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM collection_record
     WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())`
  );

  // 待跟进提醒数（next_follow_up_date <= 今天）
  const followUpCount = await queryOne<any>(
    `SELECT COUNT(*) AS count FROM collection_record
     WHERE next_follow_up_date IS NOT NULL AND next_follow_up_date <= CURDATE()
       AND contact_result NOT IN ('PARTIAL_PAID')`
  );

  const byLevel: Record<string, number> = {};
  for (const row of levelStats) {
    byLevel[row.collectionLevel] = Number(row.count);
  }

  const byResult: Record<string, number> = {};
  for (const row of resultStats) {
    byResult[row.contactResult] = Number(row.count);
  }

  res.json(ok({
    totalCollections: Number(totalCount?.count ?? 0),
    monthCollections: Number(monthCount?.count ?? 0),
    totalPromisedAmount: Number(promisedTotal?.total ?? 0),
    pendingFollowUps: Number(followUpCount?.count ?? 0),
    byLevel,
    byResult
  }));
}));
