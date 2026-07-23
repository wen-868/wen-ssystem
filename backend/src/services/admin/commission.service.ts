import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";
import type { ResultSetHeader } from "mysql2/promise";

/** t_sales_commission_rule 提成规则列表行（queryWithTenant 用，驼峰别名） */
interface CommissionRuleRow {
  id: number | string;
  ruleName: string;
  ruleType: string;
  config: string | null;
  effectiveStart: string | Date | null;
  effectiveEnd: string | Date | null;
  status: number | string;
  remark: string | null;
  createdAt: string | Date;
}

/** t_sales_commission_rule ID 校验行 */
interface CommissionRuleIdRow {
  id: number | string;
}

/** t_sales_commission_rule 配置查询行（用于提成计算） */
interface CommissionRuleConfigRow {
  id: number | string;
  ruleName: string;
  ruleType: string;
  config: string | null;
}

/** t_sale_bill 提成计算查询行（queryWithTenant 用，驼峰别名） */
interface SaleBillCommissionRow {
  billNo: string;
  staffId: number | string;
  receivableAmount: number | string;
  receivedAmount: number | string | null;
}

/** t_sales_commission_record ID 校验行 */
interface CommissionRecordIdRow {
  id: number | string;
}

/** t_sales_commission_record 列表行（queryWithTenant 用，驼峰别名，含 JOIN） */
interface CommissionRecordRow {
  recordNo: string;
  billNo: string;
  staffId: number | string;
  commissionAmount: number | string;
  baseAmount: number | string;
  rate: number | string | null;
  status: string;
  settledAt: string | Date | null;
  createdAt: string | Date;
  ruleName: string | null;
  ruleType: string | null;
  staffName: string | null;
}

/** COUNT(*) AS total 通用行 */
interface CountTotalRow {
  total: number;
}

// ===== 提成规则 CRUD =====

export async function listCommissionRules(tenantId: string) {
  return queryWithTenant<CommissionRuleRow>(
    `SELECT id, rule_name AS ruleName, rule_type AS ruleType, config,
            effective_start AS effectiveStart, effective_end AS effectiveEnd,
            status, remark, created_at AS createdAt
     FROM t_sales_commission_rule
     WHERE tenant_id = ?
     ORDER BY id DESC`,
    [tenantId],
    tenantId
  );
}

export async function createCommissionRule(params: {
  ruleName: string; ruleType: string; config: any;
  effectiveStart?: string; effectiveEnd?: string; remark?: string; tenantId: string;
}) {
  const { ruleName, ruleType, config, effectiveStart, effectiveEnd, remark, tenantId } = params;
  const result = await queryWithTenant<ResultSetHeader>(
    `INSERT INTO t_sales_commission_rule (rule_name, rule_type, config, effective_start, effective_end, remark, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ruleName, ruleType, JSON.stringify(config), effectiveStart ?? null, effectiveEnd ?? null, remark ?? null, tenantId],
    tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, ruleName, ruleType, config };
}

export async function updateCommissionRule(id: number, params: {
  ruleName?: string; ruleType?: string; config?: any;
  effectiveStart?: string; effectiveEnd?: string; status?: number; remark?: string;
  tenantId: string;
}) {
  const existing = await queryOneWithTenant<CommissionRuleIdRow>(
    "SELECT id FROM t_sales_commission_rule WHERE id = ? AND tenant_id = ?",
    [id, params.tenantId],
    params.tenantId
  );
  if (!existing) throw new Error("规则不存在");
  const fields: string[] = [];
  const values: unknown[] = [];
  if (params.ruleName !== undefined) { fields.push("rule_name = ?"); values.push(params.ruleName); }
  if (params.ruleType !== undefined) { fields.push("rule_type = ?"); values.push(params.ruleType); }
  if (params.config !== undefined) { fields.push("config = ?"); values.push(JSON.stringify(params.config)); }
  if (params.effectiveStart !== undefined) { fields.push("effective_start = ?"); values.push(params.effectiveStart); }
  if (params.effectiveEnd !== undefined) { fields.push("effective_end = ?"); values.push(params.effectiveEnd); }
  if (params.status !== undefined) { fields.push("status = ?"); values.push(params.status); }
  if (params.remark !== undefined) { fields.push("remark = ?"); values.push(params.remark); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(id, params.tenantId);
  await queryWithTenant<ResultSetHeader>(
    `UPDATE t_sales_commission_rule SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
    values,
    params.tenantId
  );
  return { id, ...params };
}

export async function deleteCommissionRule(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<CommissionRuleIdRow>(
    "SELECT id FROM t_sales_commission_rule WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!existing) throw new Error("规则不存在");
  await queryWithTenant<ResultSetHeader>(
    "DELETE FROM t_sales_commission_rule WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  return { id };
}

// ===== 提成计算引擎 =====

// 计算单笔提成
function calculateCommission(
  ruleType: string, config: any, baseAmount: number
): { amount: number; rate: number | null } {
  switch (ruleType) {
    case "FIXED_AMOUNT":
      return { amount: config.fixedAmount ?? 0, rate: null };
    case "FIXED_RATE":
      return { amount: Math.round(baseAmount * (config.rate ?? 0) * 100) / 100, rate: config.rate ?? 0 };
    case "TIERED": {
      const tiers = config.tiers ?? [];
      for (const tier of tiers.sort((a: any, b: any) => b.min - a.min)) {
        if (baseAmount >= tier.min) {
          return { amount: Math.round(baseAmount * tier.rate * 100) / 100, rate: tier.rate };
        }
      }
      return { amount: 0, rate: null };
    }
    default:
      return { amount: 0, rate: null };
  }
}

// 手动触发提成计算
export async function calculateCommissions(params: {
  startDate: string; endDate: string; tenantId: string;
}) {
  const { startDate, endDate, tenantId } = params;
  const bills = await queryWithTenant<SaleBillCommissionRow>(
    `SELECT sb.bill_no AS billNo, sb.operator_id AS staffId, sb.receivable_amount AS receivableAmount,
            sb.received_amount AS receivedAmount
     FROM t_sale_bill sb
     WHERE sb.tenant_id = ? AND sb.business_status = 'CREATED'
       AND sb.created_at >= ? AND sb.created_at <= ?
       AND sb.operator_id IS NOT NULL`,
    [tenantId, startDate, endDate],
    tenantId
  );
  const rules = await queryWithTenant<CommissionRuleConfigRow>(
    `SELECT id, rule_name AS ruleName, rule_type AS ruleType, config
     FROM t_sales_commission_rule
     WHERE tenant_id = ? AND status = 1
       AND (effective_start IS NULL OR effective_start <= ?)
       AND (effective_end IS NULL OR effective_end >= ?)`,
    [tenantId, endDate, startDate],
    tenantId
  );
  if (rules.length === 0) return { calculated: 0, records: [] };
  const records: any[] = [];
  for (const bill of bills) {
    const rule = rules[0]; // 使用第一条匹配规则
    const config = typeof rule.config === "string" ? JSON.parse(rule.config) : rule.config;
    const baseAmount = Number(bill.receivableAmount);
    const { amount, rate } = calculateCommission(rule.ruleType, config, baseAmount);
    if (amount <= 0) continue;
    // 检查是否已存在记录
    const existing = await queryOneWithTenant<CommissionRecordIdRow>(
      "SELECT id FROM t_sales_commission_record WHERE bill_no = ? AND staff_id = ? AND tenant_id = ?",
      [bill.billNo, bill.staffId, tenantId],
      tenantId
    );
    if (existing) continue;
    const recordNo = makeBizNo("TC");
    await queryWithTenant<ResultSetHeader>(
      `INSERT INTO t_sales_commission_record (record_no, bill_no, staff_id, rule_id, commission_amount, base_amount, rate, status, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [recordNo, bill.billNo, bill.staffId, rule.id, amount, baseAmount, rate, tenantId],
      tenantId
    );
    records.push({ recordNo, billNo: bill.billNo, staffId: bill.staffId, ruleName: rule.ruleName, commissionAmount: amount });
  }
  return { calculated: records.length, records };
}

// 提成结算
export async function settleCommissions(params: {
  recordNos: string[]; tenantId: string;
}) {
  const { recordNos, tenantId } = params;
  const placeholders = recordNos.map(() => "?").join(",");
  await queryWithTenant<ResultSetHeader>(
    `UPDATE t_sales_commission_record SET status = 'SETTLED', settled_at = NOW()
     WHERE record_no IN (${placeholders}) AND tenant_id = ? AND status = 'PENDING'`,
    [...recordNos, tenantId],
    tenantId
  );
  return { settled: recordNos.length, recordNos };
}

// 提成记录列表
export async function listCommissionRecords(params: {
  page: number; pageSize: number; staffId?: number; status?: string; tenantId: string;
}) {
  const { page, pageSize, staffId, status, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["cr.tenant_id = ?"];
  const queryParams: unknown[] = [tenantId];
  if (staffId !== undefined) { conditions.push("cr.staff_id = ?"); queryParams.push(staffId); }
  if (status) { conditions.push("cr.status = ?"); queryParams.push(status); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<CommissionRecordRow>(
    `SELECT cr.record_no AS recordNo, cr.bill_no AS billNo, cr.staff_id AS staffId,
            cr.commission_amount AS commissionAmount, cr.base_amount AS baseAmount,
            cr.rate, cr.status, cr.settled_at AS settledAt, cr.created_at AS createdAt,
            sr.rule_name AS ruleName, sr.rule_type AS ruleType,
            u.real_name AS staffName
     FROM t_sales_commission_record cr
     LEFT JOIN t_sales_commission_rule sr ON sr.id = cr.rule_id
     LEFT JOIN t_sys_user u ON u.id = cr.staff_id
     ${where}
     ORDER BY cr.id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset],
    tenantId
  );
  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_sales_commission_record cr ${where}`,
    queryParams,
    tenantId
  );
  return { total: totalRow?.total ?? 0, page, pageSize, records };
}