import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import type { ServiceContext, PageResult } from "../../types/index.js";

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

export interface CollectionCreateDTO {
  customerId: number;
  receivableNo?: string;
  overdueDays: number;
  overdueAmount: number;
  collectionLevel: string;
  collectionMethod: string;
  collectionContent?: string;
  contactPerson: string;
  contactResult?: string;
  promisedAmount?: number;
  promisedDate?: string | null;
  nextFollowUpDate?: string | null;
}

export interface CollectionUpdateDTO {
  contactResult?: string;
  promisedAmount?: number;
  promisedDate?: string | null;
  nextFollowUpDate?: string | null;
  collectionContent?: string;
}

export interface BatchRemindDTO {
  customerIds: number[];
  method: string;
  content: string;
  collectionLevel: string;
}

export class CreditService {
  async getCreditList(
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

    const records = await queryWithTenant<any>(
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
      [...params, pageSize, offset],
      ctx.tenantId
    );

    const totalRow = await queryOneWithTenant<any>(
      `SELECT COUNT(*) AS total FROM customer_credit cc
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

  async getCreditDetail(customerId: number, ctx: ServiceContext): Promise<any | null> {
    const record = await queryOneWithTenant<any>(
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
       WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    return record;
  }

  async initCredit(customerId: number, dto: CreditInitDTO, ctx: ServiceContext): Promise<any> {
    const customer = await queryOneWithTenant<any>(
      "SELECT id, name FROM member WHERE id = ?",
      [customerId],
      ctx.tenantId
    );
    if (!customer) {
      const err: any = new Error("客户不存在");
      err.statusCode = 404;
      throw err;
    }

    const existing = await queryOneWithTenant<any>(
      "SELECT id, status FROM customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    if (existing) {
      const err: any = new Error("该客户已有授信记录，请使用调整接口");
      err.statusCode = 400;
      throw err;
    }

    await queryWithTenant(
      `INSERT INTO customer_credit (customer_id, credit_limit, payment_term, late_fee_rate,
         max_late_fee_rate, warning_threshold, overdue_freeze_days, status, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [customerId, dto.creditLimit, dto.paymentTerm, dto.lateFeeRate,
       dto.maxLateFeeRate, dto.warningThreshold, dto.overdueFreezeDays, ctx.tenantId],
      ctx.tenantId
    );

    await queryWithTenant(
      `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
       VALUES (?, 'ADJUST_LIMIT', ?, 0, ?, ?, '初始化授信额度', ?)`,
      [customerId, dto.creditLimit, dto.creditLimit, ctx.userId, ctx.tenantId],
      ctx.tenantId
    );

    const record = await queryOneWithTenant<any>(
      `SELECT cc.id, cc.customer_id AS customerId, cc.credit_limit AS creditLimit,
              cc.credit_used AS creditUsed, cc.credit_frozen AS creditFrozen,
              cc.credit_available AS creditAvailable, cc.payment_term AS paymentTerm,
              cc.status, cc.version, cc.created_at AS createdAt
       FROM customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
      [customerId, ctx.tenantId],
      ctx.tenantId
    );

    return record;
  }

  async checkCredit(customerId: number, amount: number, ctx: ServiceContext): Promise<any> {
    const credit = await queryOneWithTenant<any>(
      `SELECT cc.credit_limit, cc.credit_used, cc.credit_frozen, cc.credit_available,
              cc.status, cc.warning_threshold, cc.payment_term
       FROM customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
      [customerId, ctx.tenantId],
      ctx.tenantId
    );

    if (!credit) {
      const err: any = new Error("该客户尚未开通授信");
      err.statusCode = 404;
      throw err;
    }

    const available = Number(credit.credit_available);
    const isWarning = credit.warning_threshold > 0
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

  async occupyCredit(customerId: number, dto: CreditOccupyDTO, ctx: ServiceContext): Promise<any> {
    await transaction(async (conn) => {
      const rows = await (conn as any).execute(
        `SELECT id, credit_limit, credit_used, credit_frozen, credit_available, status, version
         FROM customer_credit
         WHERE customer_id = ? AND tenant_id = ? AND status = 'ACTIVE'
         FOR UPDATE`,
        [customerId, ctx.tenantId]
      );
      const credit = (rows[0] as any[])[0];

      if (!credit) {
        const err: any = new Error("授信记录不存在或非ACTIVE状态");
        err.statusCode = 404;
        throw err;
      }

      const available = Number(credit.credit_available);
      if (available < dto.amount) {
        const err: any = new Error(`可用额度不足，当前可用: ${available}，需要: ${dto.amount}`);
        err.statusCode = 400;
        throw err;
      }

      const balanceBefore = available;
      const balanceAfter = available - dto.amount;

      await (conn as any).execute(
        `UPDATE customer_credit
         SET credit_used = credit_used + ?, version = version + 1, updated_at = NOW()
         WHERE customer_id = ? AND tenant_id = ? AND version = ?`,
        [dto.amount, customerId, ctx.tenantId, credit.version]
      );

      await (conn as any).execute(
        `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, related_order_no, operator_id, remark, tenant_id)
         VALUES (?, 'OCCUPY', ?, ?, ?, ?, ?, '下单占用额度', ?)`,
        [customerId, dto.amount, balanceBefore, balanceAfter, dto.orderNo, ctx.userId, ctx.tenantId]
      );
    });

    const credit = await queryOneWithTenant<any>(
      `SELECT cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
              cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
              cc.status, cc.version
       FROM customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
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

  async releaseCredit(customerId: number, dto: CreditReleaseDTO, ctx: ServiceContext): Promise<any> {
    await transaction(async (conn) => {
      const rows = await (conn as any).execute(
        `SELECT id, credit_limit, credit_used, credit_frozen, credit_available, status, version
         FROM customer_credit
         WHERE customer_id = ? AND tenant_id = ?
         FOR UPDATE`,
        [customerId, ctx.tenantId]
      );
      const credit = (rows[0] as any[])[0];

      if (!credit) {
        const err: any = new Error("授信记录不存在");
        err.statusCode = 404;
        throw err;
      }

      const balanceBefore = Number(credit.credit_available);
      const newUsed = Math.max(0, Number(credit.credit_used) - dto.amount);
      const balanceAfter = Number(credit.credit_limit) - newUsed - Number(credit.credit_frozen);

      await (conn as any).execute(
        `UPDATE customer_credit
         SET credit_used = ?, version = version + 1, updated_at = NOW()
         WHERE customer_id = ? AND tenant_id = ? AND version = ?`,
        [newUsed, customerId, ctx.tenantId, credit.version]
      );

      await (conn as any).execute(
        `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, related_order_no, operator_id, remark, tenant_id)
         VALUES (?, 'RELEASE', ?, ?, ?, ?, ?, ?, ?)`,
        [customerId, dto.amount, balanceBefore, balanceAfter, dto.orderNo, ctx.userId, dto.remark, ctx.tenantId]
      );
    });

    const credit = await queryOneWithTenant<any>(
      `SELECT cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
              cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
              cc.status, cc.version
       FROM customer_credit cc WHERE cc.customer_id = ? AND cc.tenant_id = ?`,
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

  async freezeCredit(customerId: number, dto: CreditFreezeDTO, ctx: ServiceContext): Promise<any> {
    const existing = await queryOneWithTenant<any>(
      "SELECT id, status, credit_available, version FROM customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    if (!existing) {
      const err: any = new Error("授信记录不存在");
      err.statusCode = 404;
      throw err;
    }
    if (existing.status === "FROZEN") {
      const err: any = new Error("授信已处于冻结状态");
      err.statusCode = 400;
      throw err;
    }
    if (existing.status === "CLOSED") {
      const err: any = new Error("授信已关闭，无法冻结");
      err.statusCode = 400;
      throw err;
    }

    const balanceBefore = Number(existing.credit_available);

    await queryWithTenant(
      `UPDATE customer_credit
       SET status = 'FROZEN', credit_frozen = credit_frozen + ?, freeze_reason = ?,
           frozen_at = NOW(), version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND tenant_id = ?`,
      [dto.freezeAmount, dto.reason, customerId, ctx.tenantId],
      ctx.tenantId
    );

    const afterCredit = await queryOneWithTenant<any>(
      "SELECT credit_available FROM customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    const balanceAfter = Number(afterCredit?.credit_available ?? 0);

    await queryWithTenant(
      `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
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

  async unfreezeCredit(customerId: number, dto: CreditUnfreezeDTO, ctx: ServiceContext): Promise<any> {
    const existing = await queryOneWithTenant<any>(
      "SELECT id, status, credit_available, credit_frozen, version FROM customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    if (!existing) {
      const err: any = new Error("授信记录不存在");
      err.statusCode = 404;
      throw err;
    }
    if (existing.status !== "FROZEN") {
      const err: any = new Error("授信未处于冻结状态");
      err.statusCode = 400;
      throw err;
    }

    const balanceBefore = Number(existing.credit_available);

    await queryWithTenant(
      `UPDATE customer_credit
       SET status = 'ACTIVE', credit_frozen = GREATEST(0, credit_frozen - ?),
           freeze_reason = NULL, unfrozen_at = NOW(),
           version = version + 1, updated_at = NOW()
       WHERE customer_id = ? AND tenant_id = ?`,
      [dto.unfreezeAmount, customerId, ctx.tenantId],
      ctx.tenantId
    );

    const afterCredit = await queryOneWithTenant<any>(
      "SELECT credit_available FROM customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [customerId, ctx.tenantId],
      ctx.tenantId
    );
    const balanceAfter = Number(afterCredit?.credit_available ?? 0);

    await queryWithTenant(
      `INSERT INTO credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
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

  async getCollectionList(
    collectionLevel: string | undefined,
    customerId: string | undefined,
    contactResult: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any>> {
    const conditions: string[] = ["cr.tenant_id = ?"];
    const params: unknown[] = [ctx.tenantId];

    if (collectionLevel) {
      conditions.push("cr.collection_level = ?");
      params.push(collectionLevel);
    }
    if (customerId) {
      conditions.push("cr.customer_id = ?");
      params.push(Number(customerId));
    }
    if (contactResult) {
      conditions.push("cr.contact_result = ?");
      params.push(contactResult);
    }
    if (startDate) {
      conditions.push("cr.created_at >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("cr.created_at <= ?");
      params.push(endDate);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const offset = (page - 1) * pageSize;

    const records = await queryWithTenant<any>(
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
      [...params, pageSize, offset],
      ctx.tenantId
    );

    const totalRow = await queryOneWithTenant<any>(
      `SELECT COUNT(*) AS total FROM collection_record cr
       LEFT JOIN member m ON m.id = cr.customer_id
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

  async createCollection(dto: CollectionCreateDTO, ctx: ServiceContext): Promise<any> {
    const customer = await queryOneWithTenant<any>(
      "SELECT id, name FROM member WHERE id = ?",
      [dto.customerId],
      ctx.tenantId
    );
    if (!customer) {
      const err: any = new Error("客户不存在");
      err.statusCode = 404;
      throw err;
    }

    await queryWithTenant(
      `INSERT INTO collection_record (customer_id, receivable_no, overdue_days, overdue_amount,
         collection_level, collection_method, collection_content, contact_person,
         contact_result, promised_amount, promised_date, next_follow_up_date, operator_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dto.customerId, dto.receivableNo ?? null, dto.overdueDays, dto.overdueAmount,
       dto.collectionLevel, dto.collectionMethod, dto.collectionContent ?? null,
       dto.contactPerson, dto.contactResult ?? null, dto.promisedAmount ?? null,
       dto.promisedDate ?? null, dto.nextFollowUpDate ?? null, ctx.userId, ctx.tenantId],
      ctx.tenantId
    );

    const record = await queryOneWithTenant<any>(
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
       WHERE cr.id = LAST_INSERT_ID() AND cr.tenant_id = ?`,
      [ctx.tenantId],
      ctx.tenantId
    );

    return record;
  }

  async updateCollection(collectionId: number, dto: CollectionUpdateDTO, ctx: ServiceContext): Promise<any> {
    const existing = await queryOneWithTenant<any>(
      "SELECT id FROM collection_record WHERE id = ? AND tenant_id = ?",
      [collectionId, ctx.tenantId],
      ctx.tenantId
    );
    if (!existing) {
      const err: any = new Error("催收记录不存在");
      err.statusCode = 404;
      throw err;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (dto.contactResult !== undefined) { updates.push("contact_result = ?"); params.push(dto.contactResult); }
    if (dto.promisedAmount !== undefined) { updates.push("promised_amount = ?"); params.push(dto.promisedAmount); }
    if (dto.promisedDate !== undefined) { updates.push("promised_date = ?"); params.push(dto.promisedDate); }
    if (dto.nextFollowUpDate !== undefined) { updates.push("next_follow_up_date = ?"); params.push(dto.nextFollowUpDate); }
    if (dto.collectionContent !== undefined) { updates.push("collection_content = ?"); params.push(dto.collectionContent); }

    if (updates.length > 0) {
      await queryWithTenant(
        `UPDATE collection_record SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
        [...params, collectionId, ctx.tenantId],
        ctx.tenantId
      );
    }

    const record = await queryOneWithTenant<any>(
      `SELECT cr.id, cr.customer_id AS customerId, m.name AS customerName,
              cr.contact_result AS contactResult, cr.promised_amount AS promisedAmount,
              cr.promised_date AS promisedDate, cr.next_follow_up_date AS nextFollowUpDate,
              cr.collection_content AS collectionContent,
              cr.created_at AS createdAt
       FROM collection_record cr
       LEFT JOIN member m ON m.id = cr.customer_id
       WHERE cr.id = ? AND cr.tenant_id = ?`,
      [collectionId, ctx.tenantId],
      ctx.tenantId
    );

    return record;
  }

  async getOverdueCustomers(ctx: ServiceContext): Promise<any> {
    const records = await queryWithTenant<any>(
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
       WHERE cc.credit_used > 0 AND cc.status IN ('ACTIVE', 'FROZEN') AND cc.tenant_id = ?
       ORDER BY cc.credit_used DESC`,
      [ctx.tenantId],
      ctx.tenantId
    );

    return { total: records.length, records };
  }

  async batchRemind(dto: BatchRemindDTO, ctx: ServiceContext): Promise<any> {
    let successCount = 0;
    const errors: string[] = [];

    for (const customerId of dto.customerIds) {
      try {
        const customer = await queryOneWithTenant<any>(
          "SELECT id, name, mobile FROM member WHERE id = ?",
          [customerId],
          ctx.tenantId
        );
        if (!customer) {
          errors.push(`客户${customerId}不存在`);
          continue;
        }

        const credit = await queryOneWithTenant<any>(
          "SELECT credit_used, credit_limit FROM customer_credit WHERE customer_id = ? AND tenant_id = ?",
          [customerId, ctx.tenantId],
          ctx.tenantId
        );

        await queryWithTenant(
          `INSERT INTO collection_record (customer_id, overdue_days, overdue_amount,
             collection_level, collection_method, collection_content,
             contact_person, operator_id, tenant_id)
           VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?)`,
          [customerId, credit?.credit_used ?? 0, dto.collectionLevel, dto.method,
           dto.content, customer.name, ctx.userId, ctx.tenantId],
          ctx.tenantId
        );

        successCount++;
      } catch (err: any) {
        errors.push(`客户${customerId}处理失败: ${err.message}`);
      }
    }

    return {
      totalRequested: dto.customerIds.length,
      successCount,
      failCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async getCollectionStatistics(ctx: ServiceContext): Promise<any> {
    const levelStats = await queryWithTenant<any>(
      `SELECT collection_level AS collectionLevel, COUNT(*) AS count
       FROM collection_record
       WHERE tenant_id = ?
       GROUP BY collection_level
       ORDER BY FIELD(collection_level, 'REMIND', 'LIGHT', 'MEDIUM', 'HEAVY', 'SEVERE')`,
      [ctx.tenantId],
      ctx.tenantId
    );

    const resultStats = await queryWithTenant<any>(
      `SELECT contact_result AS contactResult, COUNT(*) AS count
       FROM collection_record
       WHERE contact_result IS NOT NULL AND tenant_id = ?
       GROUP BY contact_result`,
      [ctx.tenantId],
      ctx.tenantId
    );

    const totalCount = await queryOneWithTenant<any>(
      "SELECT COUNT(*) AS count FROM collection_record WHERE tenant_id = ?",
      [ctx.tenantId],
      ctx.tenantId
    );

    const promisedTotal = await queryOneWithTenant<any>(
      "SELECT COALESCE(SUM(promised_amount), 0) AS total FROM collection_record WHERE contact_result = 'PROMISED' AND tenant_id = ?",
      [ctx.tenantId],
      ctx.tenantId
    );

    const monthCount = await queryOneWithTenant<any>(
      `SELECT COUNT(*) AS count FROM collection_record
       WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND tenant_id = ?`,
      [ctx.tenantId],
      ctx.tenantId
    );

    const followUpCount = await queryOneWithTenant<any>(
      `SELECT COUNT(*) AS count FROM collection_record
       WHERE next_follow_up_date IS NOT NULL AND next_follow_up_date <= CURDATE()
         AND contact_result NOT IN ('PARTIAL_PAID') AND tenant_id = ?`,
      [ctx.tenantId],
      ctx.tenantId
    );

    const byLevel: Record<string, number> = {};
    for (const row of levelStats) {
      byLevel[row.collectionLevel] = Number(row.count);
    }

    const byResult: Record<string, number> = {};
    for (const row of resultStats) {
      byResult[row.contactResult] = Number(row.count);
    }

    return {
      totalCollections: Number(totalCount?.count ?? 0),
      monthCollections: Number(monthCount?.count ?? 0),
      totalPromisedAmount: Number(promisedTotal?.total ?? 0),
      pendingFollowUps: Number(followUpCount?.count ?? 0),
      byLevel,
      byResult
    };
  }

  async getRiskCustomers(
    page: number,
    pageSize: number,
    ctx: ServiceContext
  ): Promise<PageResult<any>> {
    const offset = (page - 1) * pageSize;

    const records = await queryWithTenant<any>(
      `SELECT cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
              cc.credit_limit AS creditLimit, cc.credit_used AS creditUsed,
              cc.credit_frozen AS creditFrozen, cc.credit_available AS creditAvailable,
              cc.payment_term AS paymentTerm, cc.warning_threshold AS warningThreshold,
              cc.status AS creditStatus, cc.freeze_reason AS freezeReason,
              cc.frozen_at AS frozenAt,
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
              CASE
                WHEN cc.status = 'FROZEN' THEN 'FROZEN'
                WHEN cc.credit_limit > 0 AND (cc.credit_used / cc.credit_limit) >= cc.warning_threshold THEN 'WARNING'
                WHEN cc.payment_term != 'COD' AND cc.credit_used > 0 AND
                     DATEDIFF(NOW(),
                       CASE cc.payment_term
                         WHEN 'NET_7' THEN DATE_SUB(NOW(), INTERVAL 7 DAY)
                         WHEN 'NET_15' THEN DATE_SUB(NOW(), INTERVAL 15 DAY)
                         WHEN 'NET_30' THEN DATE_SUB(NOW(), INTERVAL 30 DAY)
                         WHEN 'NET_60' THEN DATE_SUB(NOW(), INTERVAL 60 DAY)
                         WHEN 'NET_90' THEN DATE_SUB(NOW(), INTERVAL 90 DAY)
                       END
                     ) > 0 THEN 'OVERDUE'
                ELSE 'NORMAL'
              END AS riskLevel
       FROM customer_credit cc
       LEFT JOIN member m ON m.id = cc.customer_id
       WHERE cc.tenant_id = ?
         AND (
           cc.status = 'FROZEN'
           OR (cc.credit_limit > 0 AND cc.credit_used / cc.credit_limit >= cc.warning_threshold)
           OR (cc.payment_term != 'COD' AND cc.credit_used > 0)
         )
       ORDER BY
         CASE cc.status WHEN 'FROZEN' THEN 0 WHEN 'ACTIVE' THEN 1 ELSE 2 END,
         cc.credit_used DESC
       LIMIT ? OFFSET ?`,
      [ctx.tenantId, pageSize, offset],
      ctx.tenantId
    );

    const totalRow = await queryOneWithTenant<any>(
      `SELECT COUNT(*) AS total
       FROM customer_credit cc
       WHERE cc.tenant_id = ?
         AND (
           cc.status = 'FROZEN'
           OR (cc.credit_limit > 0 AND cc.credit_used / cc.credit_limit >= cc.warning_threshold)
           OR (cc.payment_term != 'COD' AND cc.credit_used > 0)
         )`,
      [ctx.tenantId],
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

export const creditService = new CreditService();
