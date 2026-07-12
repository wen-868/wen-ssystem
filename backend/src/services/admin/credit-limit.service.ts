import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import type { ServiceContext, PageResult } from "../../types/index";

export interface CreditInitDTO {
  creditLimit: number;
  paymentTerm: string;
  lateFeeRate: number;
  maxLateFeeRate: number;
  warningThreshold: number;
  overdueFreezeDays: number;
}

export interface CreditOccupyDTO {
  amount: number;
  orderNo: string;
}

export interface CreditReleaseDTO {
  amount: number;
  orderNo: string;
  remark: string;
}

export interface CreditFreezeDTO {
  freezeAmount: number;
  reason: string;
}

export interface CreditUnfreezeDTO {
  unfreezeAmount: number;
  reason: string;
}

export async function getCreditList(
  status: string | undefined,
  keyword: string | undefined,
  page: number,
  pageSize: number,
  ctx: ServiceContext
): Promise<PageResult<any>> {
  const conditions: string[] = ["cc.tenant_id = ?"];
  const params: unknown[] = [ctx.tenantId];

  if (status) {
    conditions.push("cc.status = ?");
    params.push(status);
  }
  if (keyword) {
    conditions.push("(m.name LIKE ? OR m.mobile LIKE ?)");
    const kw = `%${keyword}%`;
    params.push(kw, kw);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const offset = (page - 1) * pageSize;

  const records = await queryWithTenant<Record<string, unknown>>(
    `SELECT cc.id, cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.payment_term AS paymentTerm, cc.late_fee_rate AS lateFeeRate,
            cc.max_late_fee_rate AS maxLateFeeRate, cc.warning_threshold AS warningThreshold,
            cc.overdue_freeze_days AS overdueFreezeDays,
            cc.status, cc.freeze_reason AS freezeReason,
            cc.frozen_at AS frozenAt, cc.unfrozen_at AS unfrozenAt,
            cc.version, cc.created_at AS createdAt, cc.updated_at AS updatedAt
     FROM t_customer_credit cc
     LEFT JOIN member m ON m.id = cc.customer_id
     ${where}
     ORDER BY cc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    ctx.tenantId
  );

  const totalRow = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT COUNT(*) AS total FROM t_customer_credit cc
     LEFT JOIN member m ON m.id = cc.customer_id
     ${where}`,
    params,
    ctx.tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function getCreditDetail(customerId: number, ctx: ServiceContext): Promise<Record<string, unknown> | null> {
  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT cc.id, cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.payment_term AS paymentTerm, cc.late_fee_rate AS lateFeeRate,
            cc.max_late_fee_rate AS maxLateFeeRate, cc.warning_threshold AS warningThreshold,
            cc.overdue_freeze_days AS overdueFreezeDays,
            cc.status, cc.freeze_reason AS freezeReason,
            cc.frozen_at AS frozenAt, cc.unfrozen_at AS unfrozenAt,
            cc.version, cc.created_at AS createdAt, cc.updated_at AS updatedAt
     FROM t_customer_credit cc
     LEFT JOIN member m ON m.id = cc.customer_id
     WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
    [customerId, ctx.tenantId],
    ctx.tenantId
  );
  return record;
}

export async function initCredit(customerId: number, dto: CreditInitDTO, ctx: ServiceContext): Promise<Record<string, unknown> | null> {
  const customer = await queryOneWithTenant<Record<string, unknown>>(
    "SELECT id, name FROM member WHERE id = ?",
    [customerId],
    ctx.tenantId
  );
  if (!customer) {
    const err: Error & { statusCode?: number } = new Error("客户不存在");
    err.statusCode = 404;
    throw err;
  }

  const existing = await queryOneWithTenant<Record<string, unknown>>(
    "SELECT id, status FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
    [customerId, ctx.tenantId],
    ctx.tenantId
  );
  if (existing) {
    const err: Error & { statusCode?: number } = new Error("该客户已有授信记录，请使用调整接口");
    err.statusCode = 400;
    throw err;
  }

  await queryWithTenant(
    `INSERT INTO t_customer_credit (customer_id, credit_limit, payment_term, late_fee_rate,
       max_late_fee_rate, warning_threshold, overdue_freeze_days, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    [customerId, dto.creditLimit, dto.paymentTerm, dto.lateFeeRate,
     dto.maxLateFeeRate, dto.warningThreshold, dto.overdueFreezeDays, ctx.tenantId],
    ctx.tenantId
  );

  await queryWithTenant(
    `INSERT INTO t_credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
     VALUES (?, 'ADJUST_LIMIT', ?, 0, ?, ?, '初始化授信额度', ?)`,
    [customerId, dto.creditLimit, dto.creditLimit, ctx.userId, ctx.tenantId],
    ctx.tenantId
  );

  const record = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT cc.id, cc.customer_id AS customerId, cc.credit_limit AS creditLimit,
            cc.credit_used AS creditUsed, cc.credit_frozen AS creditFrozen,
            cc.credit_available AS creditAvailable, cc.payment_term AS paymentTerm,
            cc.status, cc.version, cc.created_at AS createdAt
     FROM t_customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
    [customerId, ctx.tenantId],
    ctx.tenantId
  );

  return record;
}

export async function checkCredit(customerId: number, amount: number, ctx: ServiceContext): Promise<Record<string, unknown>> {
  const credit = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT cc.credit_limit, cc.credit_used, cc.credit_frozen, cc.credit_available,
            cc.status, cc.warning_threshold, cc.payment_term
     FROM t_customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
    [customerId, ctx.tenantId],
    ctx.tenantId
  );

  if (!credit) {
    const err: Error & { statusCode?: number } = new Error("该客户尚未开通授信");
    err.statusCode = 404;
    throw err;
  }

  const available = Number(credit.credit_available);
  const isWarning = Number(credit.warning_threshold) > 0
    ? (Number(credit.credit_used) / Number(credit.credit_limit)) >= Number(credit.warning_threshold)
    : false;

  return {
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
  };
}

export async function occupyCredit(customerId: number, dto: CreditOccupyDTO, ctx: ServiceContext): Promise<Record<string, unknown>> {
  await transaction(async (conn) => {
    const rows = await (conn as unknown as { execute: (sql: string, params: unknown[]) => Promise<[unknown[], unknown]> }).execute(
      `SELECT id, credit_limit, credit_used, credit_frozen, credit_available, status, version
       FROM t_customer_credit
       WHERE customer_id = ? AND tenant_id = ? AND status = 'ACTIVE'
       FOR UPDATE`,
      [customerId, ctx.tenantId]
    );
    const credit = (rows[0] as unknown as Record<string, unknown>[])[0];

    if (!credit) {
      const err: Error & { statusCode?: number } = new Error("授信记录不存在或非ACTIVE状态");
      err.statusCode = 404;
      throw err;
    }

    const available = Number(credit.credit_available);
    if (available < dto.amount) {
      const err: Error & { statusCode?: number } = new Error(`可用额度不足，当前可用: ${available}，需要: ${dto.amount}`);
      err.statusCode = 400;
      throw err;
    }

    const balanceBefore = available;
    const balanceAfter = available - dto.amount;

    await (conn as unknown as { execute: (sql: string, params: unknown[]) => Promise<[unknown[], unknown]> }).execute(
      `UPDATE t_customer_credit
       SET credit_used = credit_used + ?, version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND tenant_id = ? AND version = ?`,
      [dto.amount, customerId, ctx.tenantId, credit.version]
    );

    await (conn as unknown as { execute: (sql: string, params: unknown[]) => Promise<[unknown[], unknown]> }).execute(
      `INSERT INTO t_credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, related_order_no, operator_id, remark, tenant_id)
       VALUES (?, 'OCCUPY', ?, ?, ?, ?, ?, '下单占用额度', ?)`,
      [customerId, dto.amount, balanceBefore, balanceAfter, dto.orderNo, ctx.userId, ctx.tenantId]
    );
  });

  const credit = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.status, cc.version
     FROM t_customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
    [customerId, ctx.tenantId],
    ctx.tenantId
  );

  return {
    customerId,
    occupiedAmount: dto.amount,
    orderNo: dto.orderNo,
    ...credit
  };
}

export async function releaseCredit(customerId: number, dto: CreditReleaseDTO, ctx: ServiceContext): Promise<Record<string, unknown>> {
  await transaction(async (conn) => {
    const rows = await (conn as unknown as { execute: (sql: string, params: unknown[]) => Promise<[unknown[], unknown]> }).execute(
      `SELECT id, credit_limit, credit_used, credit_frozen, credit_available, status, version
       FROM t_customer_credit
       WHERE customer_id = ? AND tenant_id = ?
       FOR UPDATE`,
      [customerId, ctx.tenantId]
    );
    const credit = (rows[0] as unknown as Record<string, unknown>[])[0];

    if (!credit) {
      const err: Error & { statusCode?: number } = new Error("授信记录不存在");
      err.statusCode = 404;
      throw err;
    }

    const balanceBefore = Number(credit.credit_available);
    const newUsed = Math.max(0, Number(credit.credit_used) - dto.amount);
    const balanceAfter = Number(credit.credit_limit) - newUsed - Number(credit.credit_frozen);

    await (conn as unknown as { execute: (sql: string, params: unknown[]) => Promise<[unknown[], unknown]> }).execute(
      `UPDATE t_customer_credit
       SET credit_used = ?, version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND tenant_id = ? AND version = ?`,
      [newUsed, customerId, ctx.tenantId, credit.version]
    );

    await (conn as unknown as { execute: (sql: string, params: unknown[]) => Promise<[unknown[], unknown]> }).execute(
      `INSERT INTO t_credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, related_order_no, operator_id, remark, tenant_id)
       VALUES (?, 'RELEASE', ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, dto.amount, balanceBefore, balanceAfter, dto.orderNo, ctx.userId, dto.remark, ctx.tenantId]
    );
  });

  const credit = await queryOneWithTenant<Record<string, unknown>>(
    `SELECT cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
            cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
            cc.status, cc.version
     FROM t_customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
    [customerId, ctx.tenantId],
    ctx.tenantId
  );

  return {
    customerId,
    releasedAmount: dto.amount,
    orderNo: dto.orderNo,
    ...credit
  };
}

export async function freezeCredit(customerId: number, dto: CreditFreezeDTO, ctx: ServiceContext): Promise<Record<string, unknown>> {
  const existing = await queryOneWithTenant<Record<string, unknown>>(
    "SELECT id, status, credit_available, version FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
    [customerId, ctx.tenantId],
    ctx.tenantId
  );
  if (!existing) {
    const err: Error & { statusCode?: number } = new Error("授信记录不存在");
    err.statusCode = 404;
    throw err;
  }
  if (existing.status === "FROZEN") {
    const err: Error & { statusCode?: number } = new Error("授信已处于冻结状态");
    err.statusCode = 400;
    throw err;
  }
  if (existing.status === "CLOSED") {
    const err: Error & { statusCode?: number } = new Error("授信已关闭，无法冻结");
    err.statusCode = 400;
    throw err;
  }

  const balanceBefore = Number(existing.credit_available);

  await queryWithTenant(
    `UPDATE t_customer_credit
     SET status = 'FROZEN', credit_frozen = credit_frozen + ?, freeze_reason = ?,
         frozen_at = NOW(), version = version + 1, updated_at = NOW()
     WHERE customer_id = ? AND tenant_id = ?`,
    [dto.freezeAmount, dto.reason, customerId, ctx.tenantId],
    ctx.tenantId
  );

  const afterCredit = await queryOneWithTenant<Record<string, unknown>>(
    "SELECT credit_available FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
    [customerId, ctx.tenantId],
    ctx.tenantId
  );
  const balanceAfter = Number(afterCredit?.credit_available ?? 0);

  await queryWithTenant(
    `INSERT INTO t_credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
     VALUES (?, 'FREEZE', ?, ?, ?, ?, ?, ?)`,
    [customerId, dto.freezeAmount, balanceBefore, balanceAfter, ctx.userId, dto.reason, ctx.tenantId],
    ctx.tenantId
  );

  return {
    customerId,
    status: "FROZEN",
    frozenAmount: dto.freezeAmount,
    freezeReason: dto.reason,
    frozenAt: new Date().toISOString()
  };
}

export async function unfreezeCredit(customerId: number, dto: CreditUnfreezeDTO, ctx: ServiceContext): Promise<Record<string, unknown>> {
  const existing = await queryOneWithTenant<Record<string, unknown>>(
    "SELECT id, status, credit_available, credit_frozen, version FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
    [customerId, ctx.tenantId],
    ctx.tenantId
  );
  if (!existing) {
    const err: Error & { statusCode?: number } = new Error("授信记录不存在");
    err.statusCode = 404;
    throw err;
  }
  if (existing.status !== "FROZEN") {
    const err: Error & { statusCode?: number } = new Error("授信未处于冻结状态");
    err.statusCode = 400;
    throw err;
  }

  const balanceBefore = Number(existing.credit_available);

  await queryWithTenant(
    `UPDATE t_customer_credit
     SET status = 'ACTIVE', credit_frozen = GREATEST(0, credit_frozen - ?),
         freeze_reason = NULL, unfrozen_at = NOW(),
         version = version + 1, updated_at = NOW()
     WHERE customer_id = ? AND tenant_id = ?`,
    [dto.unfreezeAmount, customerId, ctx.tenantId],
    ctx.tenantId
  );

  const afterCredit = await queryOneWithTenant<Record<string, unknown>>(
    "SELECT credit_available FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
    [customerId, ctx.tenantId],
    ctx.tenantId
  );
  const balanceAfter = Number(afterCredit?.credit_available ?? 0);

  await queryWithTenant(
    `INSERT INTO t_credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
     VALUES (?, 'UNFREEZE', ?, ?, ?, ?, ?, ?)`,
    [customerId, dto.unfreezeAmount, balanceBefore, balanceAfter, ctx.userId, dto.reason, ctx.tenantId],
    ctx.tenantId
  );

  return {
    customerId,
    status: "ACTIVE",
    unfrozenAmount: dto.unfreezeAmount,
    unfrozenAt: new Date().toISOString()
  };
}