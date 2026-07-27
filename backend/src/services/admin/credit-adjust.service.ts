﻿﻿﻿import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { ServiceContext, PageResult } from "../../types/index";
import type { ResultSetHeader } from "mysql2/promise";

export interface AdjustLimitDTO {
  creditLimit: number;
  reason: string;
}

export interface AdjustTermDTO {
  paymentTerm: string;
  reason: string;
}

/** t_customer_credit 可用额度查询行 */
interface CreditAvailableRow {
  credit_available: number | string;
}

/** t_customer_credit 授信记录行（queryOneWithTenant 用，驼峰别名） */
interface CreditRecordRow {
  id: number | string;
  customerId: number | string;
  creditLimit: number | string;
  creditUsed?: number | string;
  creditFrozen?: number | string;
  creditAvailable: number | string;
  paymentTerm: string;
  status: string;
  version: number | string;
  updatedAt: string | Date;
}

/** t_customer_credit 存在性/状态校验行 */
interface CreditExistingRow {
  id: number | string;
  payment_term: string;
  status: string;
}

/** t_credit_operation_log 操作日志行（queryWithTenant 用，驼峰别名） */
interface CreditOperationLogRow {
  id: number | string;
  customerId: number | string;
  operationType: string;
  amount: number | string;
  balanceBefore: number | string;
  balanceAfter: number | string;
  relatedOrderNo: string | null;
  operatorId: number | string | null;
  remark: string | null;
  createdAt: string | Date;
}

/** COUNT(*) AS total 通用行 */
interface CountTotalRow {
  total: number;
}

export class CreditAdjustService {
  async adjustLimit(customerId: number, dto: AdjustLimitDTO, ctx: ServiceContext): Promise<CreditRecordRow | null> {
    const result = await queryWithTenant<ResultSetHeader>(
      `UPDATE t_customer_credit
       SET credit_limit = ?, version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND tenant_id = ? AND status != 'CLOSED'`,
      [dto.creditLimit, customerId, ctx.tenantId],
      ctx.tenantId
    );

    if ((result as unknown as { affectedRows: number }).affectedRows === 0) {
      throw Object.assign(new Error("授信记录不存在或已关闭"), { statusCode: 404 });
    }

    const credit = await queryOneWithTenant<CreditAvailableRow>(
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

    const record = await queryOneWithTenant<CreditRecordRow>(
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

  async adjustTerm(customerId: number, dto: AdjustTermDTO, ctx: ServiceContext): Promise<CreditRecordRow | null> {
    const existing = await queryOneWithTenant<CreditExistingRow>(
      "SELECT id, payment_term, status FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    if (!existing) {
      throw Object.assign(new Error("授信记录不存在"), { statusCode: 404 });
    }
    if (existing.status === "CLOSED") {
      throw Object.assign(new Error("授信已关闭，无法调整账期"), { statusCode: 400 });
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

    const record = await queryOneWithTenant<CreditRecordRow>(
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
  ): Promise<PageResult<CreditOperationLogRow>> {
    const offset = (page - 1) * pageSize;

    const records = await queryWithTenant<CreditOperationLogRow>(
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

    const totalRow = await queryOneWithTenant<CountTotalRow>(
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
