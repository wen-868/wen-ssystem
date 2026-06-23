import { Router } from "express";
import { z } from "zod";
import { requireAuth, signToken, requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { verifyPassword } from "../shared/password.js";
import { ok } from "../shared/response.js";
import bcrypt from "bcryptjs";

export const adminRouter = Router();

adminRouter.post("/auth/login", asyncHandler(async (req, res) => {
  const body = z.object({ username: z.string(), password: z.string() }).parse(req.body);
  const account = await queryOne<any>(
    "SELECT id, username, password_hash, real_name, store_id, status, tenant_id FROM sys_user WHERE username = ? LIMIT 1",
    [body.username]
  );
  if (!account || account.status !== 1 || !verifyPassword(body.password, account.password_hash)) {
    res.status(401).json({ code: "401", message: "账号或密码错误" });
    return;
  }
  const roles = await query<any>(
    `SELECT r.role_code
     FROM sys_user_role ur
     JOIN sys_role r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.status = 1`,
    [account.id]
  );
  const roleCodes = roles.map((r: any) => r.role_code);
  const tenantId = account.tenant_id || 'default';
  const user = {
    id: account.id,
    username: account.username,
    realName: account.real_name,
    storeId: account.store_id,
    tenantId: tenantId,
    roles: roleCodes,
    permissions: ["*"]
  };
  res.json(ok({ token: signToken({ id: account.id, username: account.username, realName: account.real_name, roles: roleCodes, storeId: account.store_id, tenantId }), user }));
}));

adminRouter.get("/auth/me", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  res.json(ok(req.user));
}));

adminRouter.get("/staff", requireAuth, asyncHandler(async (_req, res) => {
  const records = await query<any>(
    `SELECT id AS staffId, username, real_name AS realName, store_id AS storeId, status
     FROM sys_user
     WHERE status = 1
     ORDER BY id ASC`,
    []
  );
  res.json(ok({ total: records.length, records }));
}));

adminRouter.get("/members", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const records = await query<any>(
    `SELECT m.id AS memberId, m.name, m.mobile, m.customer_type AS customerType,
            m.points, m.level_code AS levelCode, m.status,
            m.staff_id AS staffId, u.real_name AS staffName
     FROM member m
     LEFT JOIN sys_user u ON u.id = m.staff_id
     WHERE m.tenant_id = ? AND (m.name LIKE ? OR m.mobile LIKE ?)
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, keyword, keyword, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM member WHERE tenant_id = ?", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// ========== 员工管理 POST/PUT ==========
adminRouter.post("/staff", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    username: z.string(),
    realName: z.string(),
    mobile: z.string().optional(),
    roleId: z.string().optional(),
    storeId: z.number().optional(),
    status: z.number().default(1),
    password: z.string().optional()
  }).parse(req.body);
  const passwordHash = body.password
    ? await bcrypt.hash(body.password, 10)
    : await bcrypt.hash("123456", 10);
  const result = await query<any>(
    `INSERT INTO sys_user (username, real_name, mobile, store_id, status, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [body.username, body.realName, body.mobile ?? null, body.storeId ?? 1, body.status, passwordHash]
  );
  res.json(ok({ staffId: (result as any).insertId, username: body.username, realName: body.realName }));
}));

adminRouter.put("/staff/:staffId", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    username: z.string().optional(),
    realName: z.string().optional(),
    mobile: z.string().optional(),
    roleId: z.string().optional(),
    storeId: z.number().optional(),
    status: z.number().optional()
  }).parse(req.body);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.username !== undefined) { sets.push("username = ?"); params.push(body.username); }
  if (body.realName !== undefined) { sets.push("real_name = ?"); params.push(body.realName); }
  if (body.mobile !== undefined) { sets.push("mobile = ?"); params.push(body.mobile); }
  if (body.storeId !== undefined) { sets.push("store_id = ?"); params.push(body.storeId); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (sets.length === 0) { res.json(ok({})); return; }
  params.push(Number(req.params.staffId));
  await query(`UPDATE sys_user SET ${sets.join(", ")} WHERE id = ?`, params);
  res.json(ok({ staffId: Number(req.params.staffId) }));
}));

// ========== 员工管理：停用员工 ==========
adminRouter.delete("/staff/:id", requireAuth, asyncHandler(async (req, res) => {
  const staffId = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, username, status FROM sys_user WHERE id = ?", [staffId]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "员工不存在" });
    return;
  }
  if (existing.status !== 1) {
    res.status(400).json({ code: "400", message: "员工已停用" });
    return;
  }
  await query("UPDATE sys_user SET status = 0 WHERE id = ?", [staffId]);
  res.json(ok({ staffId, username: existing.username }));
}));

// ========== 门店管理 PUT ==========
adminRouter.put("/stores/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    contact: z.string().optional(),
    phone: z.string().optional(),
    deliveryRadius: z.number().optional(),
    businessStatus: z.string().optional()
  }).parse(req.body);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.address !== undefined) { sets.push("address = ?"); params.push(body.address); }
  if (body.contact !== undefined) { sets.push("contact = ?"); params.push(body.contact); }
  if (body.phone !== undefined) { sets.push("phone = ?"); params.push(body.phone); }
  if (body.deliveryRadius !== undefined) { sets.push("delivery_radius = ?"); params.push(body.deliveryRadius); }
  if (body.businessStatus !== undefined) { sets.push("business_status = ?"); params.push(body.businessStatus); }
  if (sets.length === 0) { res.json(ok({})); return; }
  params.push(Number(req.params.id), tenantId);
  await query(`UPDATE store SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, params);
  res.json(ok({ id: Number(req.params.id) }));
}));

// ========== 日结接口 ==========
adminRouter.post("/daily-settle", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    settleDate: z.string()
  }).parse(req.body);

  // 检查是否已有该日期的日结记录
  const existing = await queryOne<any>("SELECT id FROM daily_settlement WHERE settle_date = ? AND tenant_id = ?", [body.settleDate, tenantId]);
  if (existing) {
    res.status(400).json({ code: "400", message: "该日期已有日结记录" });
    return;
  }

  // 从 payment_order 表按 channel 聚合当日真实收款数据
  const channelRows = await query<any>(
    `SELECT channel, COALESCE(SUM(amount), 0) AS amount
     FROM payment_order
     WHERE DATE(paid_at) = ? AND status = 'SUCCESS' AND tenant_id = ?
     GROUP BY channel`,
    [body.settleDate, tenantId]
  );

  const channelMap: Record<string, number> = {};
  for (const row of channelRows) {
    channelMap[row.channel] = Number(row.amount);
  }

  const cashAmount = channelMap["CASH"] ?? 0;
  const wechatAmount = channelMap["WECHAT"] ?? 0;
  const alipayAmount = channelMap["ALIPAY"] ?? 0;
  const transferAmount = channelMap["TRANSFER"] ?? 0;
  const otherAmount = channelMap["OTHER"] ?? 0;
  const totalReceived = cashAmount + wechatAmount + alipayAmount + transferAmount + otherAmount;

  // 从 sale_bill 聚合当日销售额和退款
  const salesRow = await queryOne<any>(
    `SELECT COALESCE(SUM(receivable_amount), 0) AS totalSales
     FROM sale_bill
     WHERE DATE(created_at) = ? AND business_status NOT IN ('DRAFT', 'VOIDED') AND tenant_id = ?`,
    [body.settleDate, tenantId]
  );
  const totalSales = Number(salesRow?.totalSales ?? 0);

  const refundRow = await queryOne<any>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS totalRefund
     FROM sale_return
     WHERE DATE(created_at) = ? AND return_status NOT IN ('VOIDED') AND tenant_id = ?`,
    [body.settleDate, tenantId]
  );
  const totalRefund = Number(refundRow?.totalRefund ?? 0);

  await query(
    `INSERT INTO daily_settlement (settle_date, total_sales, total_received, total_refund,
       cash_amount, wechat_amount, alipay_amount, transfer_amount, other_amount, operator_id, created_at, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [body.settleDate, totalSales, totalReceived, totalRefund,
     cashAmount, wechatAmount, alipayAmount, transferAmount, otherAmount,
     req.user!.id ?? 0, tenantId]
  );
  res.json(ok({
    settleDate: body.settleDate,
    totalSales,
    totalReceived,
    totalRefund,
    cashAmount,
    wechatAmount,
    alipayAmount,
    transferAmount,
    otherAmount,
    message: "日结成功"
  }));
}));

// ========== 日结历史列表 ==========
adminRouter.get("/daily-settle", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.dateStart) {
    conditions.push("settle_date >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("settle_date <= ?");
    params.push(req.query.dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT id, settle_date AS settleDate, total_sales AS totalSales,
            total_received AS totalReceived, total_refund AS totalRefund,
            cash_amount AS cashAmount, wechat_amount AS wechatAmount,
            alipay_amount AS alipayAmount, transfer_amount AS transferAmount,
            other_amount AS otherAmount, operator_id AS operatorId, created_at AS createdAt
     FROM daily_settlement
     ${where}
     ORDER BY settle_date DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(`SELECT COUNT(*) AS total FROM daily_settlement ${where}`, params);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// ========== 日结详情 ==========
adminRouter.get("/daily-settle/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const settleId = Number(req.params.id);
  const record = await queryOne<any>(
    `SELECT id, settle_date AS settleDate, total_sales AS totalSales,
            total_received AS totalReceived, total_refund AS totalRefund,
            cash_amount AS cashAmount, wechat_amount AS wechatAmount,
            alipay_amount AS alipayAmount, transfer_amount AS transferAmount,
            other_amount AS otherAmount, operator_id AS operatorId, created_at AS createdAt
     FROM daily_settlement WHERE id = ? AND tenant_id = ?`,
    [settleId, tenantId]
  );
  if (!record) {
    res.status(404).json({ code: "404", message: "日结记录不存在" });
    return;
  }
  res.json(ok(record));
}));

// ========== 任务4：销售退货API ==========

// 新建销售退货单
adminRouter.post("/sale-returns", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    sourceBillNo: z.string().optional(),
    storeId: z.number(),
    customerId: z.number().optional(),
    customerName: z.string().optional(),
    customerMobile: z.string().optional(),
    discountAmount: z.number().default(0),
    refundMethod: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number(),
      skuName: z.string(),
      boxQty: z.number().default(0),
      bottleQty: z.number().default(0),
      totalBottleQty: z.number(),
      unitPrice: z.number(),
      reason: z.string().optional()
    })).min(1)
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    const returnNo = makeBizNo("XSTH");
    let goodsAmount = 0;

    for (const item of body.items) {
      goodsAmount += item.totalBottleQty * item.unitPrice;
    }
    const refundAmount = goodsAmount - body.discountAmount;

    const [returnResult] = await conn.execute<any>(
      `INSERT INTO sale_return (return_no, source_bill_no, store_id, customer_id, customer_name, customer_mobile,
        return_status, goods_amount, discount_amount, refund_amount, refunded_amount,
        refund_method, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 0, ?, ?, ?, ?)`,
      [returnNo, body.sourceBillNo ?? null, body.storeId,
       body.customerId ?? null, body.customerName ?? null, body.customerMobile ?? null,
       goodsAmount, body.discountAmount, refundAmount,
       body.refundMethod ?? null, req.user!.id ?? 0, body.remark ?? null, tenantId]
    );

    for (const item of body.items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      await conn.execute(
        `INSERT INTO sale_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty,
          total_bottle_qty, unit_price, subtotal_amount, reason, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [returnNo, item.skuId, item.skuName, item.boxQty, item.bottleQty,
         item.totalBottleQty, item.unitPrice, subtotal, item.reason ?? null, tenantId]
      );

      // 退回库存
      await conn.execute(
        `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, available_qty, tenant_id)
         VALUES (?, ?, 'OFFLINE', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           physical_qty = physical_qty + VALUES(physical_qty),
           available_qty = available_qty + VALUES(available_qty),
           updated_at = NOW()`,
        [body.storeId, item.skuId, item.totalBottleQty, item.totalBottleQty, tenantId]
      );
    }

    return { returnId: returnResult.insertId as number, returnNo };
  });
  res.json(ok(result));
}));

// 销售退货列表
adminRouter.get("/sale-returns", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.customerId) {
    conditions.push("customer_id = ?");
    params.push(Number(req.query.customerId));
  }
  if (req.query.returnStatus) {
    conditions.push("return_status = ?");
    params.push(req.query.returnStatus);
  }
  if (req.query.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(req.query.dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT id, return_no AS returnNo, source_bill_no AS sourceBillNo,
            store_id AS storeId, customer_id AS customerId,
            customer_name AS customerName, customer_mobile AS customerMobile,
            return_status AS returnStatus,
            goods_amount AS goodsAmount, discount_amount AS discountAmount,
            refund_amount AS refundAmount, refunded_amount AS refundedAmount,
            refund_method AS refundMethod,
            operator_id AS operatorId, remark, created_at AS createdAt
     FROM sale_return
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM sale_return ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 销售退货详情
adminRouter.get("/sale-returns/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const returnId = Number(req.params.id);
  const ret = await queryOne<any>(
    `SELECT id, return_no AS returnNo, source_bill_no AS sourceBillNo,
            store_id AS storeId, customer_id AS customerId,
            customer_name AS customerName, customer_mobile AS customerMobile,
            return_status AS returnStatus,
            goods_amount AS goodsAmount, discount_amount AS discountAmount,
            refund_amount AS refundAmount, refunded_amount AS refundedAmount,
            refund_method AS refundMethod,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt
     FROM sale_return WHERE id = ? AND tenant_id = ?`,
    [returnId, tenantId]
  );
  if (!ret) {
    res.status(404).json({ code: "404", message: "销售退货单不存在" });
    return;
  }
  const items = await query<any>(
    `SELECT id, return_no AS returnNo, sku_id AS skuId, sku_name AS skuName,
            box_qty AS boxQty, bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, subtotal_amount AS subtotalAmount,
            reason
     FROM sale_return_item WHERE return_no = ? AND tenant_id = ?`,
    [ret.returnNo, tenantId]
  );
  res.json(ok({ ...ret, items }));
}));

// ========== 任务5：客户对账/付款API ==========

// 客户对账单列表
adminRouter.get("/customer-statements", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.customerId) {
    conditions.push("customer_id = ?");
    params.push(Number(req.query.customerId));
  }
  if (req.query.status) {
    conditions.push("status = ?");
    params.push(req.query.status);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT id, statement_no AS statementNo, customer_id AS customerId,
            customer_name AS customerName, customer_mobile AS customerMobile,
            statement_type AS statementType, start_date AS startDate, end_date AS endDate,
            opening_balance AS openingBalance, total_sales AS totalSales,
            total_returns AS totalReturns, total_payments AS totalPayments,
            closing_balance AS closingBalance,
            status, confirmed_at AS confirmedAt, operator_id AS operatorId,
            remark, created_at AS createdAt
     FROM customer_statement
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM customer_statement ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 对账单详情
adminRouter.get("/customer-statements/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const statementId = Number(req.params.id);
  const statement = await queryOne<any>(
    `SELECT id, statement_no AS statementNo, customer_id AS customerId,
            customer_name AS customerName, customer_mobile AS customerMobile,
            statement_type AS statementType, start_date AS startDate, end_date AS endDate,
            opening_balance AS openingBalance, total_sales AS totalSales,
            total_returns AS totalReturns, total_payments AS totalPayments,
            closing_balance AS closingBalance,
            status, confirmed_at AS confirmedAt, operator_id AS operatorId,
            remark, created_at AS createdAt
     FROM customer_statement WHERE id = ? AND tenant_id = ?`,
    [statementId, tenantId]
  );
  if (!statement) {
    res.status(404).json({ code: "404", message: "对账单不存在" });
    return;
  }

  // 查询对账周期内的销售单
  const saleBills = await query<any>(
    `SELECT bill_no AS billNo, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            created_at AS createdAt
     FROM sale_bill
     WHERE customer_id = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?
       AND business_status NOT IN ('DRAFT', 'VOIDED') AND tenant_id = ?
     ORDER BY created_at ASC`,
    [statement.customerId, statement.startDate, statement.endDate, tenantId]
  );

  // 查询对账周期内的退货单
  const saleReturns = await query<any>(
    `SELECT return_no AS returnNo, refund_amount AS refundAmount, created_at AS createdAt
     FROM sale_return
     WHERE customer_id = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?
       AND return_status NOT IN ('VOIDED') AND tenant_id = ?
     ORDER BY created_at ASC`,
    [statement.customerId, statement.startDate, statement.endDate, tenantId]
  );

  // 查询对账周期内的收款记录
  const payments = await query<any>(
    `SELECT receipt_no AS receiptNo, amount, payment_method AS paymentMethod,
            payment_date AS paymentDate, created_at AS createdAt
     FROM customer_payment
     WHERE customer_id = ? AND payment_date >= ? AND payment_date <= ?
       AND status NOT IN ('VOIDED') AND tenant_id = ?
     ORDER BY payment_date ASC`,
    [statement.customerId, statement.startDate, statement.endDate, tenantId]
  );

  res.json(ok({ ...statement, saleBills, saleReturns, payments }));
}));

// 生成对账单
adminRouter.post("/customer-statements/generate", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    customerId: z.number(),
    statementType: z.string().default("MONTHLY"),
    startDate: z.string(),
    endDate: z.string(),
    remark: z.string().optional()
  }).parse(req.body);

  const customer = await queryOne<any>(
    "SELECT id, name, mobile FROM member WHERE id = ? AND tenant_id = ?",
    [body.customerId, tenantId]
  );
  if (!customer) {
    res.status(400).json({ code: "400", message: "客户不存在" });
    return;
  }

  const result = await transaction(async (conn) => {
    const statementNo = makeBizNo("DZ");

    // 计算期初余额：该日期之前的未收金额
    const openingRow = await conn.execute<any>(
      `SELECT COALESCE(SUM(unreceived_amount), 0) AS balance
       FROM sale_bill
       WHERE customer_id = ? AND DATE(created_at) < ?
         AND business_status NOT IN ('DRAFT', 'VOIDED') AND tenant_id = ?`,
      [body.customerId, body.startDate, tenantId]
    );
    const openingBalance = Number((openingRow as any)[0]?.[0]?.balance ?? 0);

    // 本期销售
    const salesRow = await conn.execute<any>(
      `SELECT COALESCE(SUM(receivable_amount), 0) AS total
       FROM sale_bill
       WHERE customer_id = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?
         AND business_status NOT IN ('DRAFT', 'VOIDED') AND tenant_id = ?`,
      [body.customerId, body.startDate, body.endDate, tenantId]
    );
    const totalSales = Number((salesRow as any)[0]?.[0]?.total ?? 0);

    // 本期退货
    const returnRow = await conn.execute<any>(
      `SELECT COALESCE(SUM(refund_amount), 0) AS total
       FROM sale_return
       WHERE customer_id = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?
         AND return_status NOT IN ('VOIDED') AND tenant_id = ?`,
      [body.customerId, body.startDate, body.endDate, tenantId]
    );
    const totalReturns = Number((returnRow as any)[0]?.[0]?.total ?? 0);

    // 本期收款
    const paymentRow = await conn.execute<any>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM customer_payment
       WHERE customer_id = ? AND payment_date >= ? AND payment_date <= ?
         AND status NOT IN ('VOIDED') AND tenant_id = ?`,
      [body.customerId, body.startDate, body.endDate, tenantId]
    );
    const totalPayments = Number((paymentRow as any)[0]?.[0]?.total ?? 0);

    // 期末余额 = 期初 + 本期销售 - 本期退货 - 本期收款
    const closingBalance = openingBalance + totalSales - totalReturns - totalPayments;

    const [stmtResult] = await conn.execute<any>(
      `INSERT INTO customer_statement (statement_no, customer_id, customer_name, customer_mobile,
        statement_type, start_date, end_date,
        opening_balance, total_sales, total_returns, total_payments, closing_balance,
        status, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      [statementNo, body.customerId, customer.name, customer.mobile,
       body.statementType, body.startDate, body.endDate,
       openingBalance, totalSales, totalReturns, totalPayments, closingBalance,
       req.user!.id ?? 0, body.remark ?? null, tenantId]
    );

    return {
      statementId: stmtResult.insertId as number,
      statementNo,
      openingBalance,
      totalSales,
      totalReturns,
      totalPayments,
      closingBalance
    };
  });
  res.json(ok(result));
}));

// 客户付款记录
adminRouter.get("/customer-payments", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.customerId) {
    conditions.push("customer_id = ?");
    params.push(Number(req.query.customerId));
  }
  if (req.query.paymentMethod) {
    conditions.push("payment_method = ?");
    params.push(req.query.paymentMethod);
  }
  if (req.query.dateStart) {
    conditions.push("payment_date >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("payment_date <= ?");
    params.push(req.query.dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT id, receipt_no AS receiptNo, customer_id AS customerId,
            customer_name AS customerName, amount,
            payment_method AS paymentMethod,
            source_type AS sourceType, source_no AS sourceNo,
            voucher_no AS voucherNo, payment_date AS paymentDate,
            operator_id AS operatorId, status, remark, created_at AS createdAt
     FROM customer_payment
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM customer_payment ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 登记客户付款
adminRouter.post("/customer-payments", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    customerId: z.number(),
    amount: z.number(),
    paymentMethod: z.string().default("CASH"),
    sourceType: z.string().optional(),
    sourceNo: z.string().optional(),
    voucherNo: z.string().optional(),
    paymentDate: z.string(),
    remark: z.string().optional()
  }).parse(req.body);

  const customer = await queryOne<any>(
    "SELECT id, name FROM member WHERE id = ? AND tenant_id = ?",
    [body.customerId, tenantId]
  );
  if (!customer) {
    res.status(400).json({ code: "400", message: "客户不存在" });
    return;
  }

  const result = await transaction(async (conn) => {
    const receiptNo = makeBizNo("SK");

    const [paymentResult] = await conn.execute<any>(
      `INSERT INTO customer_payment (receipt_no, customer_id, customer_name, amount,
        payment_method, source_type, source_no, voucher_no, payment_date,
        operator_id, status, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
      [receiptNo, body.customerId, customer.name, body.amount,
       body.paymentMethod, body.sourceType ?? null, body.sourceNo ?? null,
       body.voucherNo ?? null, body.paymentDate,
       req.user!.id ?? 0, body.remark ?? null, tenantId]
    );

    // 更新关联销售单的已收金额
    if (body.sourceType === "SALE_BILL" && body.sourceNo) {
      await conn.execute(
        `UPDATE sale_bill
         SET received_amount = LEAST(receivable_amount, received_amount + ?),
             unreceived_amount = GREATEST(0, receivable_amount - received_amount - ?),
             last_payment_time = NOW(),
             updated_at = NOW()
         WHERE bill_no = ? AND tenant_id = ?`,
        [body.amount, body.amount, body.sourceNo, tenantId]
      );

      // 更新收款状态
      await conn.execute(
        `UPDATE sale_bill
         SET collection_status = CASE
           WHEN received_amount + ? >= receivable_amount THEN 'PAID'
           WHEN received_amount + ? > 0 THEN 'PARTIAL'
           ELSE collection_status
           END,
           updated_at = NOW()
         WHERE bill_no = ? AND business_status NOT IN ('DRAFT', 'VOIDED') AND tenant_id = ?`,
        [body.amount, body.amount, body.sourceNo, tenantId]
      );
    }

    return {
      paymentId: paymentResult.insertId as number,
      receiptNo,
      customerId: body.customerId,
      customerName: customer.name,
      amount: body.amount
    };
  });
  res.json(ok(result));
}));

adminRouter.post("/members", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    name: z.string(),
    mobile: z.string(),
    customerType: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
    staffId: z.number().optional()
  }).parse(req.body);
  const result = await query<any>(
    `INSERT INTO member (name, mobile, customer_type, staff_id, points, level_code, status, tenant_id)
     VALUES (?, ?, ?, ?, 0, ?, 1, ?)`,
    [body.name, body.mobile, body.customerType, body.staffId ?? null, body.customerType === "WHOLESALE" ? "WHOLESALE" : "NORMAL", tenantId]
  );
  const memberId = result?.[0]?.insertId ?? Date.now();
  res.json(ok({ memberId, name: body.name, mobile: body.mobile, customerType: body.customerType, staffId: body.staffId ?? null }));
}));

adminRouter.get("/members/:memberId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const member = await queryOne<any>(
    `SELECT m.id AS memberId, m.name, m.mobile, m.customer_type AS customerType,
            m.points, m.level_code AS levelCode, m.status,
            m.staff_id AS staffId, u.real_name AS staffName
     FROM member m
     LEFT JOIN sys_user u ON u.id = m.staff_id
     WHERE m.id = ? AND m.tenant_id = ?`,
    [Number(req.params.memberId), tenantId]
  );
  if (!member) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }
  res.json(ok(member));
}));

// ========== 客户管理：编辑客户信息 ==========
adminRouter.put("/members/:memberId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = Number(req.params.memberId);
  const existing = await queryOne<any>("SELECT id FROM member WHERE id = ? AND tenant_id = ?", [memberId, tenantId]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }
  const body = z.object({
    name: z.string().optional(),
    mobile: z.string().optional(),
    address: z.string().optional(),
    customerType: z.enum(["RETAIL", "WHOLESALE"]).optional(),
    levelCode: z.string().optional(),
    settlementType: z.string().optional(),
    remark: z.string().optional()
  }).parse(req.body);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.mobile !== undefined) { sets.push("mobile = ?"); params.push(body.mobile); }
  if (body.address !== undefined) { sets.push("address = ?"); params.push(body.address); }
  if (body.customerType !== undefined) { sets.push("customer_type = ?"); params.push(body.customerType); }
  if (body.levelCode !== undefined) { sets.push("level_code = ?"); params.push(body.levelCode); }
  if (body.settlementType !== undefined) { sets.push("settlement_type = ?"); params.push(body.settlementType); }
  if (body.remark !== undefined) { sets.push("remark = ?"); params.push(body.remark); }
  if (sets.length === 0) { res.json(ok({ memberId })); return; }
  sets.push("updated_at = NOW()");
  params.push(memberId, tenantId);
  await query(`UPDATE member SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, params);
  res.json(ok({ memberId }));
}));

// ========== 客户管理：停用客户 ==========
adminRouter.delete("/members/:memberId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = Number(req.params.memberId);
  const existing = await queryOne<any>("SELECT id, name, status FROM member WHERE id = ? AND tenant_id = ?", [memberId, tenantId]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }
  if (existing.status === "INACTIVE") {
    res.status(400).json({ code: "400", message: "客户已停用" });
    return;
  }
  await query("UPDATE member SET status = 'INACTIVE', updated_at = NOW() WHERE id = ? AND tenant_id = ?", [memberId, tenantId]);
  res.json(ok({ memberId, name: existing.name }));
}));

adminRouter.get("/members/:memberId/assign", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({ staffId: z.number() }).parse(req.body);
  const memberId = Number(req.params.memberId);
  const member = await queryOne<any>("SELECT id FROM member WHERE id = ? AND tenant_id = ?", [memberId, tenantId]);
  if (!member) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }
  const staff = await queryOne<any>("SELECT id FROM sys_user WHERE id = ? AND status = 1", [body.staffId]);
  if (!staff) {
    res.status(404).json({ code: "404", message: "员工不存在" });
    return;
  }
  await query("UPDATE member SET staff_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?", [body.staffId, memberId, tenantId]);
  res.json(ok({ memberId, staffId: body.staffId }));
}));

adminRouter.get("/members/:memberId/price-history", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = Number(req.params.memberId);
  const skuId = z.number().positive().parse(Number(req.query.skuId));
  const records = await query<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName, sbi.unit_price AS unitPrice,
            sb.bill_no AS billNo, sb.created_at AS createdAt
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.customer_id = ? AND sbi.sku_id = ? AND sb.tenant_id = ?
     ORDER BY sb.created_at DESC`,
    [memberId, skuId, tenantId]
  );
  if (records.length === 0) {
    res.json(ok([]));
    return;
  }
  const prices = records.map((r: any) => Number(r.unitPrice));
  res.json(ok([{
    skuId,
    skuName: records[0].skuName,
    lastPrice: prices[0],
    highestPrice: Math.max(...prices),
    lowestPrice: Math.min(...prices),
    billCount: records.length,
    lastBillNo: records[0].billNo
  }]));
}));

adminRouter.get("/stores", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = `%${String(req.query.keyword || "")}%`;
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store
     WHERE tenant_id = ? AND (name LIKE ? OR store_code LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, keyword, keyword, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM store WHERE tenant_id = ? AND (name LIKE ? OR store_code LIKE ?)", [tenantId, keyword, keyword]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.post("/stores", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    name: z.string(),
    address: z.string(),
    lng: z.number().optional(),
    lat: z.number().optional(),
    contact: z.string().optional(),
    phone: z.string().optional(),
    deliveryRadius: z.number().default(3)
  }).parse(req.body);
  const storeCode = makeBizNo("MD");
  const result = await queryOne<any>(
    `SELECT 1 AS ok`
  );
  await query(
    `INSERT INTO store (store_code, name, address, lng, lat, contact, phone, delivery_radius, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [storeCode, body.name, body.address, body.lng ?? null, body.lat ?? null, body.contact ?? null, body.phone ?? null, body.deliveryRadius, tenantId]
  );
  void result;
  const created = await queryOne<any>("SELECT id, store_code AS storeCode, name FROM store WHERE store_code = ? AND tenant_id = ?", [storeCode, tenantId]);
  res.json(ok(created));
}));

adminRouter.get("/stores/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const store = await queryOne<any>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store WHERE id = ? AND tenant_id = ?`,
    [Number(req.params.id), tenantId]
  );
  if (!store) {
    res.status(404).json({ code: "1", message: "门店不存在" });
    return;
  }
  res.json(ok(store));
}));

adminRouter.patch("/stores/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id FROM store WHERE id = ? AND tenant_id = ?", [storeId, tenantId]);
  if (!existing) {
    res.status(404).json({ code: "1", message: "门店不存在" });
    return;
  }

  const body = z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    status: z.number().optional(),
    longitude: z.number().optional(),
    latitude: z.number().optional()
  }).parse(req.body);
  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
  if (body.address !== undefined) { updates.push("address = ?"); params.push(body.address); }
  if (body.phone !== undefined) { updates.push("phone = ?"); params.push(body.phone); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }
  if (body.longitude !== undefined) { updates.push("longitude = ?"); params.push(body.longitude); }
  if (body.latitude !== undefined) { updates.push("latitude = ?"); params.push(body.latitude); }

  if (updates.length > 0) {
    updates.push("updated_at = NOW()");
    await query(`UPDATE store SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, storeId, tenantId]);
  }

  const store = await queryOne<any>(
    `SELECT id, store_code AS storeCode, name, address, contact, phone, delivery_radius AS deliveryRadius,
            business_status AS businessStatus, status,
            miniapp_appid AS miniappAppid, wx_merchant_name AS wxMerchantName,
            wx_service_phone AS wxServicePhone, wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store WHERE id = ? AND tenant_id = ?`,
    [storeId, tenantId]
  );
  res.json(ok(store));
}));

adminRouter.post("/stores/:id/fetch-wx-info", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const storeId = Number(req.params.id);
  const store = await queryOne<any>(
    `SELECT id, name, phone, miniapp_appid AS miniappAppid,
            wx_merchant_name AS wxMerchantName, wx_service_phone AS wxServicePhone,
            wx_head_img AS wxHeadImg, wx_qrcode_url AS wxQrcodeUrl
     FROM store WHERE id = ? AND tenant_id = ?`,
    [storeId, tenantId]
  );
  if (!store) {
    res.status(404).json({ code: "1", message: "门店不存在" });
    return;
  }

  const appid = store.miniappAppid;
  if (!appid) {
    res.status(400).json({ code: "1", message: "请先设置小程序 AppID" });
    return;
  }

  // 模拟通过微信 API 根据 appid 拉取商户信息
  // 真实环境需要调用微信开放平台 API：https://open.weixin.qq.com
  // 需要配置 access_token 和对应的 API secret
  const mockWxInfo = {
    merchantName: store.name || "未命名商户",
    servicePhone: store.phone || "400-000-0000",
    headImg: "https://thirdwx.qlogo.cn/mmopen/test/132",
    qrcodeUrl: `https://mp.weixin.qq.com/a/~${appid}~`
  };

  // 更新到数据库
  await query(
    `UPDATE store SET wx_merchant_name = ?, wx_service_phone = ?, wx_head_img = ?, wx_qrcode_url = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [mockWxInfo.merchantName, mockWxInfo.servicePhone, mockWxInfo.headImg, mockWxInfo.qrcodeUrl, storeId, tenantId]
  );

  res.json(ok({
    miniappAppid: appid,
    wxMerchantName: mockWxInfo.merchantName,
    wxServicePhone: mockWxInfo.servicePhone,
    wxHeadImg: mockWxInfo.headImg,
    wxQrcodeUrl: mockWxInfo.qrcodeUrl
  }));
}));

adminRouter.get("/products", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = `%${String(req.query.keyword || "")}%`;
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT p.id AS spuId, s.id AS skuId, p.name, p.main_image AS mainImage, s.sku_name AS skuName, s.sku_code AS skuCode, s.barcode,
            pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, p.status
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     JOIN product_price pp ON pp.sku_id = s.id
     WHERE p.tenant_id = ? AND (p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)
     ORDER BY p.id DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, keyword, keyword, keyword, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total
     FROM product_sku s
     JOIN product_spu p ON p.id = s.spu_id
     WHERE p.tenant_id = ? AND (p.name LIKE ? OR s.sku_code LIKE ? OR s.barcode LIKE ?)`,
    [tenantId, keyword, keyword, keyword]
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.post("/products", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const rawBody = req.body;
  const body = z.object({
    name: z.string(),
    categoryId: z.number(),
    mainImage: z.string().optional(),
    saleChannels: z.array(z.string()).default(["MINIAPP", "STORE"]),
    skus: z.array(z.object({
      skuName: z.string(),
      barcode: z.string().optional(),
      boxRatio: z.number().default(1),
      temperature: z.enum(["NORMAL", "CHILLED"]).default("NORMAL"),
      traceEnabled: z.boolean().default(false),
      warningThreshold: z.number().default(0),
      costPrice: z.number().default(0),
      retailPrice: z.number(),
      wholesalePrice: z.number().nullable().optional(),
      miniappPrice: z.number().nullable().optional(),
      storePrice: z.number().nullable().optional()
    })).min(1)
  }).parse({
    ...rawBody,
    skus: rawBody.skus ?? [{
      skuName: rawBody.skuName,
      barcode: rawBody.barcode,
      retailPrice: rawBody.retailPrice,
      wholesalePrice: rawBody.wholesalePrice,
      miniappPrice: rawBody.miniappPrice,
      storePrice: rawBody.storePrice,
      warningThreshold: rawBody.warningThreshold ?? 0
    }]
  });
  const result = await transaction(async (conn) => {
    const spuCode = makeBizNo("SPU");
    const [spuResult] = await conn.execute<any>(
      `INSERT INTO product_spu (spu_code, name, category_id, main_image, sale_channels, status, tenant_id)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), 'DRAFT', ?)`,
      [spuCode, body.name, body.categoryId, body.mainImage ?? null, JSON.stringify(body.saleChannels), tenantId]
    );
    const spuId = spuResult.insertId as number;
    let firstSkuId: number | null = null;
    for (const sku of body.skus) {
      const skuCode = makeBizNo("SKU");
      const [skuResult] = await conn.execute<any>(
        `INSERT INTO product_sku (spu_id, sku_code, barcode, sku_name, box_ratio, temperature, trace_enabled, warning_threshold, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [spuId, skuCode, sku.barcode ?? null, sku.skuName, sku.boxRatio, sku.temperature, sku.traceEnabled ? 1 : 0, sku.warningThreshold, tenantId]
      );
      const skuId = skuResult.insertId as number;
      firstSkuId ??= skuId;
      await conn.execute(
        `INSERT INTO product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [skuId, sku.costPrice, sku.retailPrice, sku.wholesalePrice ?? null, sku.miniappPrice ?? null, sku.storePrice ?? null, tenantId]
      );
      if (rawBody.initialQty !== undefined) {
        await conn.execute(
          `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty, tenant_id)
           VALUES (1, ?, ?, ?, 0, ?, ?)
           ON DUPLICATE KEY UPDATE physical_qty = VALUES(physical_qty), available_qty = VALUES(available_qty), updated_at = NOW()`,
          [skuId, rawBody.stockType ?? "OFFLINE", rawBody.initialQty, rawBody.initialQty, tenantId]
        );
      }
    }
    return { id: spuId, spuId, skuId: firstSkuId, spuCode };
  });
  res.json(ok(result));
}));

adminRouter.patch("/products/:spuId/status", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({ status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]) }).parse(req.body);
  const result = await query("UPDATE product_spu SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?", [body.status, Number(req.params.spuId), tenantId]);
  if (!result || (result as any).affectedRows === 0) {
    res.status(404).json({ code: "404", message: "商品不存在" });
    return;
  }
  res.json(ok({ spuId: Number(req.params.spuId), status: body.status }));
}));

// ========== 商品管理：编辑商品基本信息 ==========
adminRouter.put("/products/:spuId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const spuId = Number(req.params.spuId);
  const existing = await queryOne<any>("SELECT id FROM product_spu WHERE id = ? AND tenant_id = ?", [spuId, tenantId]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "商品不存在" });
    return;
  }
  const body = z.object({
    name: z.string().optional(),
    barcode: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    unit: z.string().optional(),
    boxRatio: z.number().optional(),
    specs: z.string().optional(),
    status: z.enum(["DRAFT", "ON_SALE", "OFF_SALE"]).optional()
  }).parse(req.body);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { sets.push("name = ?"); params.push(body.name); }
  if (body.category !== undefined) { sets.push("category_id = ?"); params.push(body.category); }
  if (body.brand !== undefined) { sets.push("brand = ?"); params.push(body.brand); }
  if (body.unit !== undefined) { sets.push("unit = ?"); params.push(body.unit); }
  if (body.specs !== undefined) { sets.push("specs = ?"); params.push(body.specs); }
  if (body.status !== undefined) { sets.push("status = ?"); params.push(body.status); }
  if (sets.length === 0) { res.json(ok({ spuId })); return; }
  sets.push("updated_at = NOW()");
  params.push(spuId, tenantId);
  await query(`UPDATE product_spu SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, params);

  // 如果传了 barcode，更新关联 SKU 的 barcode
  if (body.barcode !== undefined) {
    await query("UPDATE product_sku SET barcode = ? WHERE spu_id = ? AND tenant_id = ?", [body.barcode, spuId, tenantId]);
  }
  // 如果传了 boxRatio，更新关联 SKU 的 box_ratio
  if (body.boxRatio !== undefined) {
    await query("UPDATE product_sku SET box_ratio = ? WHERE spu_id = ? AND tenant_id = ?", [body.boxRatio, spuId, tenantId]);
  }

  res.json(ok({ spuId }));
}));

// ========== 商品管理：停用商品 ==========
adminRouter.delete("/products/:spuId", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const spuId = Number(req.params.spuId);
  const existing = await queryOne<any>("SELECT id, name, status FROM product_spu WHERE id = ? AND tenant_id = ?", [spuId, tenantId]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "商品不存在" });
    return;
  }
  if (existing.status === "OFF_SALE") {
    res.status(400).json({ code: "400", message: "商品已停售" });
    return;
  }
  await query("UPDATE product_spu SET status = 'OFF_SALE', updated_at = NOW() WHERE id = ? AND tenant_id = ?", [spuId, tenantId]);
  res.json(ok({ spuId, name: existing.name }));
}));

adminRouter.get("/products/:skuId/price-logs", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const records = await query<any>(
    `SELECT id, sku_id AS skuId, price_type AS priceType, old_price AS oldPrice,
            new_price AS newPrice, action_type AS actionType, operator_id AS operatorId, created_at AS createdAt
     FROM product_price_log
     WHERE sku_id = ? AND tenant_id = ?
     ORDER BY id DESC
     LIMIT 50`,
    [Number(req.params.skuId), tenantId]
  );
  res.json(ok({ records }));
}));

adminRouter.put("/products/:skuId/price", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const skuId = Number(req.params.skuId);
  const body = z.object({
    costPrice: z.number().optional(),
    retailPrice: z.number().optional(),
    wholesalePrice: z.number().nullable().optional(),
    miniappPrice: z.number().nullable().optional(),
    storePrice: z.number().nullable().optional()
  }).parse(req.body);
  const result = await transaction(async (conn) => {
    const [oldRows] = await conn.query<any[]>("SELECT * FROM product_price WHERE sku_id = ? AND tenant_id = ?", [skuId, tenantId]);
    const oldPrice = oldRows[0];
    if (!oldPrice) throw Object.assign(new Error("SKU价格不存在"), { statusCode: 404 });
    const changes = [
      ["COST", oldPrice.cost_price, body.costPrice],
      ["RETAIL", oldPrice.retail_price, body.retailPrice],
      ["WHOLESALE", oldPrice.wholesale_price, body.wholesalePrice],
      ["MINIAPP", oldPrice.miniapp_price, body.miniappPrice],
      ["STORE", oldPrice.store_price, body.storePrice]
    ].filter(([, oldValue, newValue]) => newValue !== undefined && Number(oldValue ?? 0) !== Number(newValue ?? 0));
    await conn.execute(
      `UPDATE product_price
       SET cost_price = COALESCE(?, cost_price),
           retail_price = COALESCE(?, retail_price),
           wholesale_price = ?,
           miniapp_price = ?,
           store_price = ?
       WHERE sku_id = ? AND tenant_id = ?`,
      [
        body.costPrice ?? null,
        body.retailPrice ?? null,
        body.wholesalePrice === undefined ? oldPrice.wholesale_price : body.wholesalePrice,
        body.miniappPrice === undefined ? oldPrice.miniapp_price : body.miniappPrice,
        body.storePrice === undefined ? oldPrice.store_price : body.storePrice,
        skuId,
        tenantId
      ]
    );
    for (const [priceType, oldValue, newValue] of changes) {
      await conn.execute(
        `INSERT INTO product_price_log (sku_id, operator_id, price_type, old_price, new_price, action_type, tenant_id)
         VALUES (?, ?, ?, ?, ?, 'UPDATE', ?)`,
        [skuId, req.user!.id ?? 0, priceType, oldValue ?? null, newValue ?? null, tenantId]
      );
    }
    return { skuId };
  });
  res.json(ok(result));
}));

adminRouter.get("/reports/dashboard", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const sales = await queryOne<any>("SELECT COALESCE(SUM(received_amount),0) AS amount, COUNT(*) AS count FROM sale_bill WHERE DATE(created_at)=CURRENT_DATE AND tenant_id = ?", [tenantId]);
  const pending = await queryOne<any>("SELECT COALESCE(SUM(unreceived_amount),0) AS amount FROM sale_bill WHERE collection_status IN ('UNPAID','PENDING','SHARED','PARTIAL') AND tenant_id = ?", [tenantId]);
  const orders = await queryOne<any>("SELECT COUNT(*) AS count FROM miniapp_order WHERE DATE(created_at)=CURRENT_DATE AND tenant_id = ?", [tenantId]);
  const warnings = await queryOne<any>(
    `SELECT COUNT(*) AS count
     FROM inventory_balance ib
     JOIN product_sku s ON s.id = ib.sku_id
     WHERE ib.available_qty <= s.warning_threshold AND ib.tenant_id = ?`,
    [tenantId]
  );
  const pendingOrders = await queryOne<any>(
    "SELECT COUNT(*) AS cnt FROM miniapp_order WHERE order_status = 'PENDING_PAYMENT' AND tenant_id = ?",
    [tenantId]
  );
  res.json(ok({
    salesAmount: Number(sales?.amount ?? 0),
    orderCount: Number(orders?.count ?? 0),
    saleBillCount: Number(sales?.count ?? 0),
    pendingCollectionAmount: Number(pending?.amount ?? 0),
    inventoryWarningCount: Number(warnings?.count ?? 0),
    pendingOrderCount: Number(pendingOrders?.cnt ?? 0)
  }));
}));

adminRouter.get("/orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const status = String(req.query.status || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.keyword) {
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)");
    params.push(keyword, keyword, keyword);
  }
  if (status) {
    conditions.push("order_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt
     FROM miniapp_order ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM miniapp_order ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/orders/export.csv", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const status = String(req.query.status || "");
  const dateStart = String(req.query.dateStart || "");
  const dateEnd = String(req.query.dateEnd || "");
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  if (req.query.keyword) {
    conditions.push("(order_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)");
    params.push(keyword, keyword, keyword);
  }
  if (status) {
    conditions.push("order_status = ?");
    params.push(status);
  }
  if (dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(dateStart);
  }
  if (dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(dateEnd);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt
     FROM miniapp_order ${where}
     ORDER BY created_at DESC
     LIMIT 1000`,
    params
  );
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["订单号", "门店ID", "客户类型", "履约方式", "订单状态", "支付状态", "金额", "收货人", "手机号", "创建时间"];
  const rows = records.map((row: any) => [
    row.orderNo,
    row.storeId,
    row.customerType,
    row.fulfillmentType,
    row.orderStatus,
    row.payStatus,
    row.payableAmount,
    row.receiverName,
    row.receiverMobile,
    row.createdAt
  ]);
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

adminRouter.get("/sale-bills", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.keyword) {
    const keyword = `%${String(req.query.keyword)}%`;
    conditions.push("(bill_no LIKE ? OR customer_name LIKE ?)");
    params.push(keyword, keyword);
  }
  if (req.query.status) {
    conditions.push("collection_status = ?");
    params.push(req.query.status);
  }
  if (req.query.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(req.query.dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM sale_bill
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(`SELECT COUNT(*) AS total FROM sale_bill ${where}`, params);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// ========== 销售单导出CSV ==========
adminRouter.get("/sale-bills/export.csv", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.keyword) {
    const keyword = `%${String(req.query.keyword)}%`;
    conditions.push("(bill_no LIKE ? OR customer_name LIKE ?)");
    params.push(keyword, keyword);
  }
  if (req.query.status) {
    conditions.push("collection_status = ?");
    params.push(req.query.status);
  }
  if (req.query.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(req.query.dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, receivable_amount AS receivableAmount,
            received_amount AS receivedAmount, unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM sale_bill
     ${where}
     ORDER BY created_at DESC
     LIMIT 5000`,
    params
  );
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["销售单号", "门店ID", "客户名称", "客户手机", "应收金额", "已收金额", "未收金额", "收款状态", "业务状态", "创建时间"];
  const rows = records.map((row: any) => [
    row.billNo, row.storeId, row.customerName, row.customerMobile,
    row.receivableAmount, row.receivedAmount, row.unreceivedAmount,
    row.collectionStatus, row.businessStatus, row.createdAt
  ]);
  const csv = `\uFEFF${[header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")}`;
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="sale-bills-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

adminRouter.get("/inventory/logs", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT il.ledger_no AS logNo, il.store_id AS storeId, il.sku_id AS skuId,
            ps.sku_name AS skuName, il.change_qty AS changeQty,
            il.before_qty AS beforeQty, il.after_qty AS afterQty,
            il.remark AS reason, il.operator_id AS operatorId, il.created_at AS createdAt
     FROM inventory_ledger il
     LEFT JOIN product_sku ps ON ps.id = il.sku_id
     WHERE il.tenant_id = ?
     ORDER BY il.created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM inventory_ledger WHERE tenant_id = ?", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/collection-links", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT cl.link_no AS linkNo, cl.source_type AS sourceType, cl.source_no AS sourceNo,
            cl.amount, cl.paid_amount AS paidAmount, cl.status,
            cl.share_channel AS shareChannel, cl.token,
            cl.expire_at AS expireAt, cl.created_at AS createdAt
     FROM collection_link cl
     WHERE cl.tenant_id = ?
     ORDER BY cl.created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM collection_link WHERE tenant_id = ?", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/payment-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT pay_no AS payNo, source_type AS sourceType, source_no AS sourceNo,
            amount, status, channel AS paymentMethod,
            paid_at AS paidAt, created_at AS createdAt
     FROM payment_order
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM payment_order WHERE tenant_id = ?", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/refund-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT refund_no AS refundNo, pay_no AS payNo, source_type AS sourceType,
            source_no AS sourceNo, amount, reason, status, created_at AS createdAt
     FROM refund_order
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM refund_order WHERE tenant_id = ?", [tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/inventory/balances", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["ib.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.keyword) {
    const keyword = `%${String(req.query.keyword)}%`;
    conditions.push("(ps.sku_name LIKE ? OR ps.sku_code LIKE ? OR ps.barcode LIKE ?)");
    params.push(keyword, keyword, keyword);
  }
  if (req.query.storeId) {
    conditions.push("ib.store_id = ?");
    params.push(Number(req.query.storeId));
  }
  if (req.query.category) {
    conditions.push("psp.category_id = ?");
    params.push(Number(req.query.category));
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT ib.store_id AS storeId, s.name AS storeName, ib.sku_id AS skuId,
            ps.sku_name AS skuName, ps.barcode, ib.stock_type AS stockType,
            ib.physical_qty AS physicalQty, ib.available_qty AS availableQty,
            ib.locked_qty AS lockedQty
     FROM inventory_balance ib
     LEFT JOIN store s ON s.id = ib.store_id
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id
     LEFT JOIN product_spu psp ON psp.id = ps.spu_id
     ${where}
     ORDER BY ib.store_id, ib.sku_id
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total
     FROM inventory_balance ib
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id
     LEFT JOIN product_spu psp ON psp.id = ps.spu_id
     ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

adminRouter.get("/orders/:orderNo", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const order = await queryOne<any>(
    `SELECT order_no AS orderNo, store_id AS storeId, customer_type AS customerType,
            fulfillment_type AS fulfillmentType, order_status AS orderStatus,
            pay_status AS payStatus, payable_amount AS payableAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_address AS receiverAddress, created_at AS createdAt
     FROM miniapp_order WHERE order_no = ? AND tenant_id = ?`,
    [req.params.orderNo, tenantId]
  );
  if (!order) { res.status(404).json({ code: "404", message: "订单不存在" }); return; }
  const items = await query<any>(
    `SELECT sku_id AS skuId, sku_name AS skuName, qty AS quantity, unit_price AS unitPrice,
            subtotal_amount AS subtotalAmount
     FROM miniapp_order_item WHERE order_no = ?`,
    [req.params.orderNo]
  );
  res.json(ok({ ...order, items }));
}));

adminRouter.get("/reports/daily-sales", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const records = await query<any>(
    `SELECT DATE(created_at) AS date,
            COUNT(DISTINCT bill_no) AS count,
            COALESCE(SUM(receivable_amount), 0) AS amount
     FROM sale_bill
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND tenant_id = ?
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [tenantId]
  );
  res.json(ok(records));
}));

adminRouter.get("/reports/order-stats", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const records = await query<any>(
    `SELECT order_status AS status, COUNT(*) AS count
     FROM miniapp_order
     WHERE tenant_id = ?
     GROUP BY order_status`,
    [tenantId]
  );
  res.json(ok(records));
}));

adminRouter.get("/reports/store-performance", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const records = await query<any>(
    `SELECT s.id AS storeId, s.name AS storeName,
            COALESCE(SUM(sb.receivable_amount), 0) AS totalSales,
            COUNT(DISTINCT sb.bill_no) AS billCount
     FROM store s
     LEFT JOIN sale_bill sb ON sb.store_id = s.id AND sb.tenant_id = ?
     WHERE s.tenant_id = ?
     GROUP BY s.id, s.name`,
    [tenantId, tenantId]
  );
  res.json(ok(records));
}));

adminRouter.get("/inventory/alerts", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const records = await query<any>(
    `SELECT ib.store_id AS storeId, s.name AS storeName,
            ib.sku_id AS skuId, ps.sku_name AS skuName,
            ib.stock_type AS stockType, ib.available_qty AS availableQty
     FROM inventory_balance ib
     LEFT JOIN store s ON s.id = ib.store_id
     LEFT JOIN product_sku ps ON ps.id = ib.sku_id
     WHERE ib.tenant_id = ? AND ib.available_qty <= 5
     ORDER BY ib.available_qty ASC, ib.store_id`,
    [tenantId]
  );
  res.json(ok(records));
}));

// ========== 任务1：供应商管理全套API ==========

// 供应商列表（支持筛选：类型/评级/合作状态/负责采购员）
adminRouter.get("/suppliers", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const conditions: string[] = ["s.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.keyword) {
    conditions.push("(s.name LIKE ? OR s.supplier_code LIKE ? OR s.short_name LIKE ?)");
    params.push(keyword, keyword, keyword);
  }
  if (req.query.category) {
    conditions.push("s.category = ?");
    params.push(req.query.category);
  }
  if (req.query.creditLevel) {
    conditions.push("s.credit_level = ?");
    params.push(req.query.creditLevel);
  }
  if (req.query.status !== undefined && req.query.status !== "") {
    conditions.push("s.status = ?");
    params.push(Number(req.query.status));
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT s.id AS supplierId, s.supplier_code AS supplierCode, s.name, s.short_name AS shortName,
            s.category, s.province, s.city, s.district, s.address,
            s.credit_level AS creditLevel, s.settlement_type AS settlementType,
            s.settlement_day AS settlementDay, s.tax_rate AS taxRate,
            s.bank_name AS bankName, s.bank_account AS bankAccount, s.bank_account_name AS bankAccountName,
            s.status, s.remark, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM supplier s
     ${where}
     ORDER BY s.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM supplier s ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 供应商详情（包含联系人和绩效评估数据）
adminRouter.get("/suppliers/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const supplierId = Number(req.params.id);
  const supplier = await queryOne<any>(
    `SELECT id AS supplierId, supplier_code AS supplierCode, name, short_name AS shortName,
            category, province, city, district, address,
            credit_level AS creditLevel, settlement_type AS settlementType,
            settlement_day AS settlementDay, tax_rate AS taxRate,
            bank_name AS bankName, bank_account AS bankAccount, bank_account_name AS bankAccountName,
            status, remark, created_at AS createdAt, updated_at AS updatedAt
     FROM supplier WHERE id = ? AND tenant_id = ?`,
    [supplierId, tenantId]
  );
  if (!supplier) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }
  const contacts = await query<any>(
    `SELECT id AS contactId, supplier_id AS supplierId, name, mobile, phone, email, wechat,
            is_primary AS isPrimary, position, remark, created_at AS createdAt
     FROM supplier_contact WHERE supplier_id = ? ORDER BY is_primary DESC, id ASC`,
    [supplierId]
  );
  res.json(ok({ ...supplier, contacts }));
}));

// 新增供应商
adminRouter.post("/suppliers", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    name: z.string(),
    shortName: z.string().optional(),
    category: z.string().optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    creditLevel: z.string().default("B"),
    settlementType: z.string().default("CASH"),
    settlementDay: z.number().nullable().optional(),
    taxRate: z.number().default(0),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    bankAccountName: z.string().optional(),
    remark: z.string().optional(),
    contacts: z.array(z.object({
      name: z.string(),
      mobile: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      wechat: z.string().optional(),
      isPrimary: z.boolean().default(false),
      position: z.string().optional(),
      remark: z.string().optional()
    })).optional()
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    const supplierCode = makeBizNo("GYS");
    const [supplierResult] = await conn.execute<any>(
      `INSERT INTO supplier (supplier_code, name, short_name, category, province, city, district, address,
        credit_level, settlement_type, settlement_day, tax_rate, bank_name, bank_account, bank_account_name, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [supplierCode, body.name, body.shortName ?? null, body.category ?? null,
       body.province ?? null, body.city ?? null, body.district ?? null, body.address ?? null,
       body.creditLevel, body.settlementType, body.settlementDay ?? null, body.taxRate,
       body.bankName ?? null, body.bankAccount ?? null, body.bankAccountName ?? null, body.remark ?? null, tenantId]
    );
    const supplierId = supplierResult.insertId as number;

    if (body.contacts && body.contacts.length > 0) {
      for (const contact of body.contacts) {
        await conn.execute(
          `INSERT INTO supplier_contact (supplier_id, name, mobile, phone, email, wechat, is_primary, position, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [supplierId, contact.name, contact.mobile ?? null, contact.phone ?? null,
           contact.email ?? null, contact.wechat ?? null, contact.isPrimary ? 1 : 0,
           contact.position ?? null, contact.remark ?? null]
        );
      }
    }
    return { supplierId, supplierCode };
  });
  res.json(ok(result));
}));

// 修改供应商
adminRouter.put("/suppliers/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const supplierId = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id FROM supplier WHERE id = ? AND tenant_id = ?", [supplierId, tenantId]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }

  const body = z.object({
    name: z.string().optional(),
    shortName: z.string().optional(),
    category: z.string().optional(),
    province: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    creditLevel: z.string().optional(),
    settlementType: z.string().optional(),
    settlementDay: z.number().nullable().optional(),
    taxRate: z.number().optional(),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    bankAccountName: z.string().optional(),
    status: z.number().optional(),
    remark: z.string().optional()
  }).parse(req.body);

  const updates: string[] = [];
  const params: unknown[] = [];
  const fieldMap: Record<string, string> = {
    name: "name", shortName: "short_name", category: "category",
    province: "province", city: "city", district: "district", address: "address",
    creditLevel: "credit_level", settlementType: "settlement_type",
    settlementDay: "settlement_day", taxRate: "tax_rate",
    bankName: "bank_name", bankAccount: "bank_account", bankAccountName: "bank_account_name",
    status: "status", remark: "remark"
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((body as any)[key] !== undefined) {
      updates.push(`${col} = ?`);
      params.push((body as any)[key]);
    }
  }
  if (updates.length > 0) {
    updates.push("updated_at = NOW()");
    params.push(supplierId, tenantId);
    await query(`UPDATE supplier SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, params);
  }

  const supplier = await queryOne<any>(
    `SELECT id AS supplierId, supplier_code AS supplierCode, name, short_name AS shortName,
            category, province, city, district, address,
            credit_level AS creditLevel, settlement_type AS settlementType,
            settlement_day AS settlementDay, tax_rate AS taxRate,
            bank_name AS bankName, bank_account AS bankAccount, bank_account_name AS bankAccountName,
            status, remark, created_at AS createdAt, updated_at AS updatedAt
     FROM supplier WHERE id = ? AND tenant_id = ?`,
    [supplierId, tenantId]
  );
  res.json(ok(supplier));
}));

// 删除供应商
adminRouter.delete("/suppliers/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const supplierId = Number(req.params.id);
  const existing = await queryOne<any>("SELECT id, name FROM supplier WHERE id = ? AND tenant_id = ?", [supplierId, tenantId]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "供应商不存在" });
    return;
  }
  // 检查是否有关联采购订单
  const orderCount = await queryOne<any>("SELECT COUNT(*) AS cnt FROM purchase_order WHERE supplier_id = ? AND tenant_id = ?", [supplierId, tenantId]);
  if (Number(orderCount?.cnt ?? 0) > 0) {
    res.status(400).json({ code: "400", message: "该供应商存在关联采购订单，无法删除" });
    return;
  }
  await transaction(async (conn) => {
    await conn.execute("DELETE FROM supplier_contact WHERE supplier_id = ?", [supplierId]);
    await conn.execute("DELETE FROM supplier WHERE id = ? AND tenant_id = ?", [supplierId, tenantId]);
  });
  res.json(ok({ supplierId, name: existing.name }));
}));

// 该供应商的采购订单
adminRouter.get("/suppliers/:id/purchase-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const supplierId = Number(req.params.id);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            created_at AS createdAt
     FROM purchase_order
     WHERE supplier_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [supplierId, tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM purchase_order WHERE supplier_id = ? AND tenant_id = ?", [supplierId, tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 该供应商的付款记录
adminRouter.get("/suppliers/:id/payments", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const supplierId = Number(req.params.id);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT id, payment_no AS paymentNo, supplier_id AS supplierId, supplier_name AS supplierName,
            payment_type AS paymentType, source_type AS sourceType, source_no AS sourceNo,
            amount, payment_method AS paymentMethod,
            bank_account AS bankAccount, bank_account_name AS bankAccountName, bank_name AS bankName,
            voucher_no AS voucherNo, payment_date AS paymentDate,
            status, remark, created_at AS createdAt
     FROM purchase_payment
     WHERE supplier_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [supplierId, tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM purchase_payment WHERE supplier_id = ? AND tenant_id = ?", [supplierId, tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 该供应商供货的商品列表
adminRouter.get("/suppliers/:id/products", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const supplierId = Number(req.params.id);
  const records = await query<any>(
    `SELECT DISTINCT poi.sku_id AS skuId, poi.sku_name AS skuName, poi.barcode,
            poi.unit_price AS lastPrice, poi.tax_rate AS taxRate
     FROM purchase_order_item poi
     JOIN purchase_order po ON po.order_no = poi.order_no
     WHERE po.supplier_id = ? AND po.tenant_id = ?
     ORDER BY poi.sku_name`,
    [supplierId, tenantId]
  );
  res.json(ok({ records }));
}));

// 供应商绩效统计
adminRouter.get("/suppliers/:id/stats", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const supplierId = Number(req.params.id);
  // 准时交付率：在预计到货日期前完成入库的订单比例
  const deliveryStats = await queryOne<any>(
    `SELECT
        COUNT(*) AS totalOrders,
        SUM(CASE WHEN actual_date IS NOT NULL AND actual_date <= expected_date THEN 1 ELSE 0 END) AS onTimeOrders,
        SUM(CASE WHEN actual_date IS NOT NULL AND actual_date > expected_date THEN 1 ELSE 0 END) AS lateOrders
     FROM purchase_order
     WHERE supplier_id = ? AND tenant_id = ? AND order_status IN ('COMPLETED', 'PARTIAL')`,
    [supplierId, tenantId]
  );
  const totalOrders = Number(deliveryStats?.totalOrders ?? 0);
  const onTimeOrders = Number(deliveryStats?.onTimeOrders ?? 0);
  const onTimeRate = totalOrders > 0 ? Math.round((onTimeOrders / totalOrders) * 10000) / 100 : 0;

  // 采购金额统计
  const amountStats = await queryOne<any>(
    `SELECT
        COALESCE(SUM(payable_amount), 0) AS totalAmount,
        COALESCE(SUM(paid_amount), 0) AS paidAmount,
        COALESCE(SUM(unpaid_amount), 0) AS unpaidAmount
     FROM purchase_order
     WHERE supplier_id = ? AND tenant_id = ? AND order_status NOT IN ('DRAFT', 'CANCELLED')`,
    [supplierId, tenantId]
  );

  // 退货金额统计
  const returnStats = await queryOne<any>(
    `SELECT COUNT(*) AS returnCount, COALESCE(SUM(total_amount), 0) AS returnAmount
     FROM purchase_return
     WHERE supplier_id = ? AND tenant_id = ? AND return_status NOT IN ('VOIDED')`,
    [supplierId, tenantId]
  );

  // 采购次数
  const orderCount = await queryOne<any>(
    `SELECT COUNT(*) AS cnt FROM purchase_order WHERE supplier_id = ? AND tenant_id = ? AND order_status NOT IN ('DRAFT', 'CANCELLED')`,
    [supplierId, tenantId]
  );

  res.json(ok({
    supplierId,
    onTimeRate,
    totalOrders,
    onTimeOrders,
    lateOrders: Number(deliveryStats?.lateOrders ?? 0),
    totalAmount: Number(amountStats?.totalAmount ?? 0),
    paidAmount: Number(amountStats?.paidAmount ?? 0),
    unpaidAmount: Number(amountStats?.unpaidAmount ?? 0),
    returnCount: Number(returnStats?.returnCount ?? 0),
    returnAmount: Number(returnStats?.returnAmount ?? 0),
    orderCount: Number(orderCount?.cnt ?? 0)
  }));
}));

// ========== 任务3：客户管理API深度扩展 ==========

// 该客户的销售单列表
adminRouter.get("/members/:memberId/sale-bills", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = Number(req.params.memberId);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const records = await query<any>(
    `SELECT bill_no AS billNo, store_id AS storeId, customer_name AS customerName,
            customer_mobile AS customerMobile, customer_type AS customerType,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount,
            unreceived_amount AS unreceivedAmount,
            collection_status AS collectionStatus, business_status AS businessStatus,
            created_at AS createdAt
     FROM sale_bill
     WHERE customer_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [memberId, tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM sale_bill WHERE customer_id = ? AND tenant_id = ?", [memberId, tenantId]);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 该客户的回款记录
adminRouter.get("/members/:memberId/payments", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = Number(req.params.memberId);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;

  // 从 sale_payment 和 customer_payment 两张表汇总
  const salePayments = await query<any>(
    `SELECT id, receipt_no AS receiptNo, source_type AS sourceType, source_no AS sourceNo,
            customer_id AS customerId, customer_name AS customerName,
            amount, payment_method AS paymentMethod,
            voucher_no AS voucherNo, payment_date AS paymentDate,
            status, remark, created_at AS createdAt, 'SALE_PAYMENT' AS paymentTable
     FROM sale_payment
     WHERE customer_id = ? AND tenant_id = ?
     UNION ALL
     SELECT id, receipt_no AS receiptNo, source_type AS sourceType, source_no AS sourceNo,
            customer_id AS customerId, customer_name AS customerName,
            amount, payment_method AS paymentMethod,
            voucher_no AS voucherNo, payment_date AS paymentDate,
            status, remark, created_at AS createdAt, 'CUSTOMER_PAYMENT' AS paymentTable
     FROM customer_payment
     WHERE customer_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [memberId, tenantId, memberId, tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT
        (SELECT COUNT(*) FROM sale_payment WHERE customer_id = ? AND tenant_id = ?) +
        (SELECT COUNT(*) FROM customer_payment WHERE customer_id = ? AND tenant_id = ?) AS total`,
    [memberId, tenantId, memberId, tenantId]
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records: salePayments }));
}));

// 该客户的往来账务流水
adminRouter.get("/members/:memberId/statements", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = Number(req.params.memberId);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;

  const records = await query<any>(
    `SELECT id, statement_no AS statementNo, customer_id AS customerId, customer_name AS customerName,
            statement_type AS statementType, start_date AS startDate, end_date AS endDate,
            opening_balance AS openingBalance, total_sales AS totalSales,
            total_returns AS totalReturns, total_payments AS totalPayments,
            closing_balance AS closingBalance,
            status, confirmed_at AS confirmedAt, created_at AS createdAt
     FROM customer_statement
     WHERE customer_id = ? AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [memberId, tenantId, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    "SELECT COUNT(*) AS total FROM customer_statement WHERE customer_id = ? AND tenant_id = ?",
    [memberId, tenantId]
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 该客户的购买统计
adminRouter.get("/members/:memberId/stats", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = Number(req.params.memberId);

  // 订单数和金额
  const billStats = await queryOne<any>(
    `SELECT COUNT(*) AS billCount,
            COALESCE(SUM(receivable_amount), 0) AS totalAmount,
            COALESCE(SUM(received_amount), 0) AS receivedAmount,
            COALESCE(SUM(unreceived_amount), 0) AS unpaidAmount
     FROM sale_bill
     WHERE customer_id = ? AND tenant_id = ? AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [memberId, tenantId]
  );

  // TOP商品（按购买瓶数排序）
  const topProducts = await query<any>(
    `SELECT sbi.sku_id AS skuId, sbi.sku_name AS skuName,
            SUM(sbi.total_bottle_qty) AS totalQty,
            SUM(sbi.subtotal_amount) AS totalAmount
     FROM sale_bill_item sbi
     JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
     WHERE sb.customer_id = ? AND sb.tenant_id = ? AND sb.business_status NOT IN ('DRAFT', 'VOIDED')
     GROUP BY sbi.sku_id, sbi.sku_name
     ORDER BY totalQty DESC
     LIMIT 10`,
    [memberId, tenantId]
  );

  // 最近下单时间
  const lastOrder = await queryOne<any>(
    `SELECT MAX(created_at) AS lastOrderAt FROM sale_bill WHERE customer_id = ? AND tenant_id = ? AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [memberId, tenantId]
  );

  res.json(ok({
    memberId,
    billCount: Number(billStats?.billCount ?? 0),
    totalAmount: Number(billStats?.totalAmount ?? 0),
    receivedAmount: Number(billStats?.receivedAmount ?? 0),
    unpaidAmount: Number(billStats?.unpaidAmount ?? 0),
    lastOrderAt: lastOrder?.lastOrderAt ?? null,
    topProducts
  }));
}));

// 客户列表统计
adminRouter.get("/members/stats", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  // 总数
  const totalRow = await queryOne<any>("SELECT COUNT(*) AS total FROM member WHERE status = 1 AND tenant_id = ?", [tenantId]);
  // 本月新增
  const newMonthRow = await queryOne<any>(
    "SELECT COUNT(*) AS cnt FROM member WHERE status = 1 AND tenant_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')",
    [tenantId]
  );
  // 活跃数（最近30天有销售单）
  const activeRow = await queryOne<any>(
    `SELECT COUNT(DISTINCT customer_id) AS cnt
     FROM sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
       AND business_status NOT IN ('DRAFT', 'VOIDED')
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [tenantId]
  );
  // 欠款数（有未收金额的客户数）
  const debtRow = await queryOne<any>(
    `SELECT COUNT(DISTINCT customer_id) AS cnt
     FROM sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
       AND unreceived_amount > 0
       AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [tenantId]
  );
  // 总应收
  const receivableRow = await queryOne<any>(
    `SELECT COALESCE(SUM(unreceived_amount), 0) AS total
     FROM sale_bill
     WHERE customer_id IS NOT NULL
       AND tenant_id = ?
       AND unreceived_amount > 0
       AND business_status NOT IN ('DRAFT', 'VOIDED')`,
    [tenantId]
  );

  res.json(ok({
    total: Number(totalRow?.total ?? 0),
    newThisMonth: Number(newMonthRow?.cnt ?? 0),
    activeCount: Number(activeRow?.cnt ?? 0),
    debtCount: Number(debtRow?.cnt ?? 0),
    totalReceivable: Number(receivableRow?.total ?? 0)
  }));
}));

// ========== 任务2：采购管理全套API ==========

// 采购订单列表（支持筛选：日期/供应商/采购员/状态）
adminRouter.get("/purchase-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.supplierId) {
    conditions.push("supplier_id = ?");
    params.push(Number(req.query.supplierId));
  }
  if (req.query.orderStatus) {
    conditions.push("order_status = ?");
    params.push(req.query.orderStatus);
  }
  if (req.query.operatorId) {
    conditions.push("operator_id = ?");
    params.push(Number(req.query.operatorId));
  }
  if (req.query.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(req.query.dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            operator_id AS operatorId, auditor_id AS auditorId,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_order
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM purchase_order ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 采购订单详情（含明细）
adminRouter.get("/purchase-orders/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderId = Number(req.params.id);
  const order = await queryOne<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [orderId, tenantId]
  );
  if (!order) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }
  const items = await query<any>(
    `SELECT id, order_no AS orderNo, sku_id AS skuId, sku_name AS skuName, barcode,
            box_qty AS boxQty, bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, tax_rate AS taxRate,
            subtotal_amount AS subtotalAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            in_stocked_qty AS inStockedQty, remark
     FROM purchase_order_item WHERE order_no = ?`,
    [order.orderNo]
  );
  res.json(ok({ ...order, items }));
}));

// 新建采购订单
adminRouter.post("/purchase-orders", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    supplierId: z.number(),
    storeId: z.number(),
    expectedDate: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number(),
      skuName: z.string(),
      barcode: z.string().optional(),
      boxQty: z.number().default(0),
      bottleQty: z.number().default(0),
      totalBottleQty: z.number(),
      unitPrice: z.number(),
      taxRate: z.number().default(0),
      remark: z.string().optional()
    })).min(1)
  }).parse(req.body);

  // 获取供应商信息
  const supplier = await queryOne<any>("SELECT id, name, tax_rate FROM supplier WHERE id = ? AND tenant_id = ?", [body.supplierId, tenantId]);
  if (!supplier) {
    res.status(400).json({ code: "400", message: "供应商不存在" });
    return;
  }

  const result = await transaction(async (conn) => {
    const orderNo = makeBizNo("CG");
    let goodsAmount = 0;
    let taxAmount = 0;

    for (const item of body.items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      goodsAmount += subtotal;
      taxAmount += tax;
    }

    const payableAmount = goodsAmount + taxAmount;

    const [orderResult] = await conn.execute<any>(
      `INSERT INTO purchase_order (order_no, supplier_id, supplier_name, store_id, order_status,
        goods_amount, tax_amount, discount_amount, payable_amount, paid_amount, unpaid_amount,
        expected_date, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, 0, ?, 0, ?, ?, ?, ?, ?)`,
      [orderNo, body.supplierId, supplier.name, body.storeId,
       goodsAmount, taxAmount, payableAmount, payableAmount,
       body.expectedDate ?? null, req.user!.id ?? 0, body.remark ?? null, tenantId]
    );

    for (const item of body.items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      const total = subtotal + tax;
      await conn.execute(
        `INSERT INTO purchase_order_item (order_no, sku_id, sku_name, barcode, box_qty, bottle_qty,
          total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, item.skuId, item.skuName, item.barcode ?? null,
         item.boxQty, item.bottleQty, item.totalBottleQty,
         item.unitPrice, item.taxRate, subtotal, tax, total, item.remark ?? null]
      );
    }

    return { orderId: orderResult.insertId as number, orderNo };
  });
  res.json(ok(result));
}));

// 修改采购订单
adminRouter.put("/purchase-orders/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderId = Number(req.params.id);
  const existing = await queryOne<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [orderId, tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }
  if (!["DRAFT", "PENDING"].includes(existing.orderStatus)) {
    res.status(400).json({ code: "400", message: "当前状态不允许修改" });
    return;
  }

  const body = z.object({
    expectedDate: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number(),
      skuName: z.string(),
      barcode: z.string().optional(),
      boxQty: z.number().default(0),
      bottleQty: z.number().default(0),
      totalBottleQty: z.number(),
      unitPrice: z.number(),
      taxRate: z.number().default(0),
      remark: z.string().optional()
    })).optional()
  }).parse(req.body);

  await transaction(async (conn) => {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.expectedDate !== undefined) {
      updates.push("expected_date = ?");
      params.push(body.expectedDate);
    }
    if (body.remark !== undefined) {
      updates.push("remark = ?");
      params.push(body.remark);
    }

    // 如果传了items则重新计算金额
    if (body.items && body.items.length > 0) {
      let goodsAmount = 0;
      let taxAmount = 0;
      for (const item of body.items) {
        const subtotal = item.totalBottleQty * item.unitPrice;
        const tax = subtotal * (item.taxRate || 0);
        goodsAmount += subtotal;
        taxAmount += tax;
      }
      const payableAmount = goodsAmount + taxAmount;
      updates.push("goods_amount = ?", "tax_amount = ?", "payable_amount = ?", "unpaid_amount = ?");
      params.push(goodsAmount, taxAmount, payableAmount, payableAmount);

      // 删除旧明细，重新插入
      await conn.execute("DELETE FROM purchase_order_item WHERE order_no = ?", [existing.orderNo]);
      for (const item of body.items) {
        const subtotal = item.totalBottleQty * item.unitPrice;
        const tax = subtotal * (item.taxRate || 0);
        const total = subtotal + tax;
        await conn.execute(
          `INSERT INTO purchase_order_item (order_no, sku_id, sku_name, barcode, box_qty, bottle_qty,
            total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [existing.orderNo, item.skuId, item.skuName, item.barcode ?? null,
           item.boxQty, item.bottleQty, item.totalBottleQty,
           item.unitPrice, item.taxRate, subtotal, tax, total, item.remark ?? null]
        );
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = NOW()");
      params.push(orderId, tenantId);
      await conn.execute({ sql: `UPDATE purchase_order SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, values: params } as any);
    }
  });

  const order = await queryOne<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount,
            discount_amount AS discountAmount, payable_amount AS payableAmount,
            paid_amount AS paidAmount, unpaid_amount AS unpaidAmount,
            expected_date AS expectedDate, actual_date AS actualDate,
            remark, created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [orderId, tenantId]
  );
  res.json(ok(order));
}));

// 取消采购订单
adminRouter.delete("/purchase-orders/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderId = Number(req.params.id);
  const existing = await queryOne<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [orderId, tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }
  if (!["DRAFT", "PENDING"].includes(existing.orderStatus)) {
    res.status(400).json({ code: "400", message: "当前状态不允许取消" });
    return;
  }
  await query("UPDATE purchase_order SET order_status = 'CANCELLED', updated_at = NOW() WHERE id = ? AND tenant_id = ?", [orderId, tenantId]);
  res.json(ok({ orderId, orderNo: existing.orderNo }));
}));

// 确认采购订单
adminRouter.post("/purchase-orders/:id/confirm", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderId = Number(req.params.id);
  const existing = await queryOne<any>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [orderId, tenantId]
  );
  if (!existing) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }
  if (existing.orderStatus !== "DRAFT" && existing.orderStatus !== "PENDING") {
    res.status(400).json({ code: "400", message: "当前状态不允许确认" });
    return;
  }
  await query(
    `UPDATE purchase_order SET order_status = 'APPROVED', auditor_id = ?, audited_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    [req.user!.id ?? 0, orderId, tenantId]
  );
  res.json(ok({ orderId, orderNo: existing.orderNo, orderStatus: "APPROVED" }));
}));

// 采购入库（含批次信息录入）
adminRouter.post("/purchase-orders/:id/in-stock", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderId = Number(req.params.id);
  const order = await queryOne<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus
     FROM purchase_order WHERE id = ? AND tenant_id = ?`,
    [orderId, tenantId]
  );
  if (!order) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }
  if (!["APPROVED", "PARTIAL"].includes(order.orderStatus)) {
    res.status(400).json({ code: "400", message: "当前状态不允许入库" });
    return;
  }

  const body = z.object({
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number(),
      skuName: z.string(),
      boxQty: z.number().default(0),
      bottleQty: z.number().default(0),
      totalBottleQty: z.number(),
      unitPrice: z.number(),
      taxRate: z.number().default(0),
      batchNo: z.string().optional(),
      productionDate: z.string().optional(),
      expiryDate: z.string().optional(),
      remark: z.string().optional()
    })).min(1)
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    const stockNo = makeBizNo("CGRK");
    let goodsAmount = 0;
    let taxAmount = 0;

    for (const item of body.items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      goodsAmount += subtotal;
      taxAmount += tax;
    }
    const totalAmount = goodsAmount + taxAmount;

    const [stockResult] = await conn.execute<any>(
      `INSERT INTO purchase_in_stock (stock_no, order_no, supplier_id, supplier_name, store_id,
        stock_status, goods_amount, tax_amount, total_amount, operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
      [stockNo, order.orderNo, order.supplierId, order.supplierName, order.storeId,
       goodsAmount, taxAmount, totalAmount, req.user!.id ?? 0, body.remark ?? null, tenantId]
    );

    for (const item of body.items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      const total = subtotal + tax;
      await conn.execute(
        `INSERT INTO purchase_in_stock_item (stock_no, sku_id, sku_name, box_qty, bottle_qty,
          total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount,
          batch_no, production_date, expiry_date, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [stockNo, item.skuId, item.skuName, item.boxQty, item.bottleQty, item.totalBottleQty,
         item.unitPrice, item.taxRate, subtotal, tax, total,
         item.batchNo ?? null, item.productionDate ?? null, item.expiryDate ?? null, item.remark ?? null]
      );

      // 更新采购订单明细的已入库数量
      await conn.execute(
        `UPDATE purchase_order_item SET in_stocked_qty = in_stocked_qty + ? WHERE order_no = ? AND sku_id = ?`,
        [item.totalBottleQty, order.orderNo, item.skuId]
      );

      // 更新库存余额
      await conn.execute(
        `INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, available_qty, tenant_id)
         VALUES (?, ?, 'OFFLINE', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           physical_qty = physical_qty + VALUES(physical_qty),
           available_qty = available_qty + VALUES(available_qty),
           updated_at = NOW()`,
        [order.storeId, item.skuId, item.totalBottleQty, item.totalBottleQty, tenantId]
      );
    }

    // 检查采购订单是否全部入库
    const remaining = await conn.execute<any>(
      `SELECT SUM(total_bottle_qty - in_stocked_qty) AS remainingQty
       FROM purchase_order_item WHERE order_no = ?`,
      [order.orderNo]
    );
    const remainingQty = Number((remaining as any)[0]?.[0]?.remainingQty ?? 0);
    const newStatus = remainingQty <= 0 ? "COMPLETED" : "PARTIAL";
    await conn.execute(
      `UPDATE purchase_order SET order_status = ?, actual_date = CURDATE(), updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [newStatus, orderId, tenantId]
    );

    return { stockId: stockResult.insertId as number, stockNo, orderStatus: newStatus };
  });
  res.json(ok(result));
}));

// 入库单列表
adminRouter.get("/purchase-in-stocks", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.supplierId) {
    conditions.push("supplier_id = ?");
    params.push(Number(req.query.supplierId));
  }
  if (req.query.stockStatus) {
    conditions.push("stock_status = ?");
    params.push(req.query.stockStatus);
  }
  if (req.query.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(req.query.dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT id, stock_no AS stockNo, order_no AS orderNo, supplier_id AS supplierId,
            supplier_name AS supplierName, store_id AS storeId, stock_status AS stockStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt
     FROM purchase_in_stock
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM purchase_in_stock ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// 入库单详情
adminRouter.get("/purchase-in-stocks/:id", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const stockId = Number(req.params.id);
  const stock = await queryOne<any>(
    `SELECT id, stock_no AS stockNo, order_no AS orderNo, supplier_id AS supplierId,
            supplier_name AS supplierName, store_id AS storeId, stock_status AS stockStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            operator_id AS operatorId, auditor_id AS auditorId, audited_at AS auditedAt,
            remark, created_at AS createdAt
     FROM purchase_in_stock WHERE id = ? AND tenant_id = ?`,
    [stockId, tenantId]
  );
  if (!stock) {
    res.status(404).json({ code: "404", message: "入库单不存在" });
    return;
  }
  const items = await query<any>(
    `SELECT id, stock_no AS stockNo, sku_id AS skuId, sku_name AS skuName,
            box_qty AS boxQty, bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, tax_rate AS taxRate,
            subtotal_amount AS subtotalAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            batch_no AS batchNo, production_date AS productionDate, expiry_date AS expiryDate,
            remark
     FROM purchase_in_stock_item WHERE stock_no = ?`,
    [stock.stockNo]
  );
  res.json(ok({ ...stock, items }));
}));

// 采购退货
adminRouter.post("/purchase-returns", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    orderNo: z.string().optional(),
    stockNo: z.string().optional(),
    supplierId: z.number(),
    storeId: z.number(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number(),
      skuName: z.string(),
      boxQty: z.number().default(0),
      bottleQty: z.number().default(0),
      totalBottleQty: z.number(),
      unitPrice: z.number(),
      taxRate: z.number().default(0),
      reason: z.string().optional()
    })).min(1)
  }).parse(req.body);

  const supplier = await queryOne<any>("SELECT id, name FROM supplier WHERE id = ? AND tenant_id = ?", [body.supplierId, tenantId]);
  if (!supplier) {
    res.status(400).json({ code: "400", message: "供应商不存在" });
    return;
  }

  const result = await transaction(async (conn) => {
    const returnNo = makeBizNo("CGTH");
    let goodsAmount = 0;
    let taxAmount = 0;

    for (const item of body.items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      goodsAmount += subtotal;
      taxAmount += tax;
    }
    const totalAmount = goodsAmount + taxAmount;

    const [returnResult] = await conn.execute<any>(
      `INSERT INTO purchase_return (return_no, order_no, stock_no, supplier_id, supplier_name, store_id,
        return_status, goods_amount, tax_amount, total_amount, refund_amount, refunded_amount,
        operator_id, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?, ?)`,
      [returnNo, body.orderNo ?? null, body.stockNo ?? null, body.supplierId, supplier.name,
       body.storeId, goodsAmount, taxAmount, totalAmount, totalAmount,
       req.user!.id ?? 0, body.remark ?? null, tenantId]
    );

    for (const item of body.items) {
      const subtotal = item.totalBottleQty * item.unitPrice;
      const tax = subtotal * (item.taxRate || 0);
      const total = subtotal + tax;
      await conn.execute(
        `INSERT INTO purchase_return_item (return_no, sku_id, sku_name, box_qty, bottle_qty,
          total_bottle_qty, unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [returnNo, item.skuId, item.skuName, item.boxQty, item.bottleQty, item.totalBottleQty,
         item.unitPrice, item.taxRate, subtotal, tax, total, item.reason ?? null]
      );

      // 扣减库存
      await conn.execute(
        `UPDATE inventory_balance
         SET physical_qty = GREATEST(physical_qty - ?, 0),
             available_qty = GREATEST(available_qty - ?, 0),
             updated_at = NOW()
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'OFFLINE' AND tenant_id = ?`,
        [item.totalBottleQty, item.totalBottleQty, body.storeId, item.skuId, tenantId]
      );
    }

    return { returnId: returnResult.insertId as number, returnNo };
  });
  res.json(ok(result));
}));

// 采购退货列表
adminRouter.get("/purchase-returns", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (req.query.supplierId) {
    conditions.push("supplier_id = ?");
    params.push(Number(req.query.supplierId));
  }
  if (req.query.returnStatus) {
    conditions.push("return_status = ?");
    params.push(req.query.returnStatus);
  }
  if (req.query.dateStart) {
    conditions.push("DATE(created_at) >= ?");
    params.push(req.query.dateStart);
  }
  if (req.query.dateEnd) {
    conditions.push("DATE(created_at) <= ?");
    params.push(req.query.dateEnd);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await query<any>(
    `SELECT id, return_no AS returnNo, order_no AS orderNo, stock_no AS stockNo,
            supplier_id AS supplierId, supplier_name AS supplierName, store_id AS storeId,
            return_status AS returnStatus,
            goods_amount AS goodsAmount, tax_amount AS taxAmount, total_amount AS totalAmount,
            refund_amount AS refundAmount, refunded_amount AS refundedAmount,
            operator_id AS operatorId, remark, created_at AS createdAt
     FROM purchase_return
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM purchase_return ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));
