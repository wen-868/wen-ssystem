import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { ServiceContext, PageResult } from "../../types/index";

export interface AdjustLimitDTO {
  creditLimit: number;
  reason: string;
}

export interface AdjustTermDTO {
  paymentTerm: string;
  reason: string;
}

export class CreditAdjustService {
  async adjustLimit(customerId: number, dto: AdjustLimitDTO, ctx: ServiceContext): Promise<any> {
    const result = await queryWithTenant<any>(
      `UPDATE t_customer_credit
       SET credit_limit = ?, version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND tenant_id = ? AND status != 'CLOSED'`,
      [dto.creditLimit, customerId, ctx.tenantId],
      ctx.tenantId
    );

    if ((result as unknown as { affectedRows: number }).affectedRows === 0) {
      const err: any = new Error("授信记录不存在或已关闭");
      err.statusCode = 404;
      throw err;
    }

    const credit = await queryOneWithTenant<any>(
      "SELECT credit_available FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    await queryWithTenant(
      `INSERT INTO t_credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
       VALUES (?, 'ADJUST_LIMIT', ?, ?, ?, ?, ?, ?)`,
      [customerId, dto.creditLimit, credit?.credit_available ?? 0, credit?.credit_available ?? 0, ctx.userId, dto.reason, ctx.tenantId],
      ctx.tenantId
    );

    const record = await queryOneWithTenant<any>(
      `SELECT cc.id, cc.customer_id AS customerId, cc.credit_limit AS creditLimit,
              cc.credit_used AS creditUsed, cc.credit_frozen AS creditFrozen,
              cc.credit_available AS creditAvailable, cc.payment_term AS paymentTerm,
              cc.status, cc.version, cc.updated_at AS updatedAt
       FROM t_customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
      [customerId, ctx.tenantId],
      ctx.tenantId
    );

    return record;
  }

  async adjustTerm(customerId: number, dto: AdjustTermDTO, ctx: ServiceContext): Promise<any> {
    const existing = await queryOneWithTenant<any>(
      "SELECT id, payment_term, status FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    if (!existing) {
      const err: any = new Error("授信记录不存在");
      err.statusCode = 404;
      throw err;
    }
    if (existing.status === "CLOSED") {
      const err: any = new Error("授信已关闭，无法调整账期");
      err.statusCode = 400;
      throw err;
    }

    await queryWithTenant(
      `UPDATE t_customer_credit SET payment_term = ?, version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND tenant_id = ?`,
      [dto.paymentTerm, customerId, ctx.tenantId],
      ctx.tenantId
    );

    await queryWithTenant(
      `INSERT INTO t_credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
       VALUES (?, 'MANUAL_ADJUST', 0, 0, 0, ?, ?, ?)`,
      [customerId, ctx.userId, `账期调整: ${existing.payment_term} -> ${dto.paymentTerm}, ${dto.reason}`, ctx.tenantId],
      ctx.tenantId
    );

    const record = await queryOneWithTenant<any>(
      `SELECT cc.id, cc.customer_id AS customerId, cc.credit_limit AS creditLimit,
              cc.credit_available AS creditAvailable, cc.payment_term AS paymentTerm,
              cc.status, cc.version, cc.updated_at AS updatedAt
       FROM t_customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
      [customerId, ctx.tenantId],
      ctx.tenantId
    );

    return record;
  }

  async getOperationLogs(
    customerId: number,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any>> {
    const offset = (page - 1) * pageSize;

    const records = await queryWithTenant<any>(
      `SELECT col.id, col.customer_id AS customerId,
              col.operation_type AS operationType, col.amount,
              col.balance_before AS balanceBefore, col.balance_after AS balanceAfter,
              col.related_order_no AS relatedOrderNo,
              col.operator_id AS operatorId, col.remark,
              col.created_at AS createdAt
       FROM t_credit_operation_log col
       WHERE col.customer_id = ? AND col.tenant_id = ?
       ORDER BY col.created_at DESC
       LIMIT ? OFFSET ?`,
      [customerId, ctx.tenantId, pageSize, offset],
      ctx.tenantId
    );

    const totalRow = await queryOneWithTenant<any>(
      "SELECT COUNT(*) AS total FROM t_credit_operation_log WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );

    return {
      total: Number(totalRow?.total ?? 0),
      page,
      pageSize,
      records
    };
  }
}

export const creditAdjustService = new CreditAdjustService();
