import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { ResultSetHeader } from "mysql2/promise";

/** t_customer_care_rule 关怀规则行（queryWithTenant 用，驼峰别名） */
interface CareRuleRow {
  id: number | string;
  ruleName: string;
  triggerType: string;
  templateContent: string | null;
  rewardPoints: number | string;
  rewardCouponId: number | string | null;
  enabled: number | string;
}

/** t_customer_care_rule 执行查询行（queryOneWithTenant 用，驼峰别名） */
interface CareRuleExecuteRow {
  id: number | string;
  ruleName: string;
  triggerType: string;
  templateContent: string | null;
  rewardPoints: number | string;
}

/** t_customer_care_log 关怀日志行（queryWithTenant 用，驼峰别名，含 JOIN） */
interface CareLogRow {
  id: number | string;
  customerId: number | string;
  customerName: string | null;
  ruleId: number | string | null;
  ruleName: string | null;
  triggerType: string | null;
  sentContent: string | null;
  sentAt: string | Date | null;
  status: string;
}

/** COUNT(*) AS total 通用行 */
interface CountTotalRow {
  total: number;
}

/** 目标客户 ID 行（queryWithTenant 用，多源统一为 id） */
interface TargetCustomerIdRow {
  id: number | string;
}

/** t_customer_points 积分查询行（queryOneWithTenant 用） */
interface CustomerPointsRow {
  id: number | string;
  available_points: number | string;
}

/** 关怀执行日志条目 */
interface CareExecuteLogItem {
  customerId: number | string;
  ruleName: string;
  rewardPoints: number | string;
}

// ===== 关怀规则 =====
export async function listCareRules(tenantId: string) {
  return queryWithTenant<CareRuleRow>(
    "SELECT id, rule_name AS ruleName, trigger_type AS triggerType, template_content AS templateContent, reward_points AS rewardPoints, reward_coupon_id AS rewardCouponId, enabled FROM t_customer_care_rule WHERE tenant_id = ? ORDER BY id",
    [tenantId], tenantId
  );
}

export async function createCareRule(params: { ruleName: string; triggerType: string; templateContent?: string; rewardPoints?: number; rewardCouponId?: number; tenantId: string }) {
  const { ruleName, triggerType, templateContent, rewardPoints, rewardCouponId, tenantId } = params;
  const result = await queryWithTenant<ResultSetHeader>(
    "INSERT INTO t_customer_care_rule (rule_name, trigger_type, template_content, reward_points, reward_coupon_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
    [ruleName, triggerType, templateContent ?? null, rewardPoints ?? 0, rewardCouponId ?? null, tenantId], tenantId
  );
  return { id: (result as unknown as Record<string, unknown>).insertId, ruleName, triggerType };
}

export async function updateCareRule(id: number, params: { ruleName?: string; triggerType?: string; templateContent?: string; rewardPoints?: number; rewardCouponId?: number; enabled?: number; tenantId: string }) {
  const fields: string[] = []; const values: unknown[] = [];
  if (params.ruleName !== undefined) { fields.push("rule_name = ?"); values.push(params.ruleName); }
  if (params.triggerType !== undefined) { fields.push("trigger_type = ?"); values.push(params.triggerType); }
  if (params.templateContent !== undefined) { fields.push("template_content = ?"); values.push(params.templateContent); }
  if (params.rewardPoints !== undefined) { fields.push("reward_points = ?"); values.push(params.rewardPoints); }
  if (params.rewardCouponId !== undefined) { fields.push("reward_coupon_id = ?"); values.push(params.rewardCouponId); }
  if (params.enabled !== undefined) { fields.push("enabled = ?"); values.push(params.enabled); }
  if (fields.length === 0) throw new Error("没有需要更新的字段");
  values.push(id, params.tenantId);
  await queryWithTenant<ResultSetHeader>(`UPDATE t_customer_care_rule SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values, params.tenantId);
  return { id, ...params };
}

export async function deleteCareRule(id: number, tenantId: string) {
  await queryWithTenant("DELETE FROM t_customer_care_log WHERE rule_id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  await queryWithTenant("DELETE FROM t_customer_care_rule WHERE id = ? AND tenant_id = ?", [id, tenantId], tenantId);
  return { id };
}

// ===== 关怀记录 =====
export async function listCareLogs(params: { customerId?: number; page: number; pageSize: number; tenantId: string }) {
  const { customerId, page, pageSize, tenantId } = params;
  const offset = (page - 1) * pageSize;
  const conditions = ["cl.tenant_id = ?"]; const values: unknown[] = [tenantId];
  if (customerId !== undefined) { conditions.push("cl.customer_id = ?"); values.push(customerId); }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const records = await queryWithTenant<CareLogRow>(
    `SELECT cl.id, cl.customer_id AS customerId, m.name AS customerName, cl.rule_id AS ruleId, cr.rule_name AS ruleName, cl.trigger_type AS triggerType, cl.sent_content AS sentContent, cl.sent_at AS sentAt, cl.status
     FROM t_customer_care_log cl
     LEFT JOIN t_member m ON m.id = cl.customer_id
     LEFT JOIN t_customer_care_rule cr ON cr.id = cl.rule_id
     ${where} ORDER BY cl.created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset], tenantId
  );
  const total = await queryOneWithTenant<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_customer_care_log cl ${where}`, values, tenantId);
  return { total: total?.total ?? 0, page, pageSize, records };
}

// ===== 执行关怀 =====
export async function executeCareRule(ruleId: number, tenantId: string) {
  const rule = await queryOneWithTenant<CareRuleExecuteRow>(
    "SELECT id, rule_name AS ruleName, trigger_type AS triggerType, template_content AS templateContent, reward_points AS rewardPoints FROM t_customer_care_rule WHERE id = ? AND tenant_id = ? AND enabled = 1",
    [ruleId, tenantId], tenantId
  );
  if (!rule) throw new Error("关怀规则不存在或已禁用");
  let targetCustomers: TargetCustomerIdRow[] = [];
  if (rule.triggerType === "BIRTHDAY") {
    targetCustomers = await queryWithTenant<TargetCustomerIdRow>(
      "SELECT id FROM t_member WHERE tenant_id = ? AND DATE_FORMAT(birthday, '%m-%d') = DATE_FORMAT(NOW(), '%m-%d')",
      [tenantId], tenantId
    );
  } else if (rule.triggerType === "INACTIVE") {
    targetCustomers = await queryWithTenant<TargetCustomerIdRow>(
      "SELECT customer_id AS id FROM t_customer_profile WHERE tenant_id = ? AND lifecycle_stage IN ('DORMANT', 'LOST')",
      [tenantId], tenantId
    );
  } else if (rule.triggerType === "LEVEL_UP") {
    targetCustomers = await queryWithTenant<TargetCustomerIdRow>(
      "SELECT customer_id AS id FROM t_customer_level WHERE tenant_id = ? AND upgraded_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)",
      [tenantId], tenantId
    );
  } else {
    targetCustomers = await queryWithTenant<TargetCustomerIdRow>("SELECT id FROM t_member WHERE tenant_id = ?", [tenantId], tenantId);
  }
  const logs: CareExecuteLogItem[] = [];
  for (const c of targetCustomers) {
    await queryWithTenant(
      "INSERT INTO t_customer_care_log (customer_id, rule_id, trigger_type, sent_content, sent_at, status, tenant_id) VALUES (?, ?, ?, ?, NOW(), 'SENT', ?)",
      [c.id, ruleId, rule.triggerType, rule.templateContent ?? null, tenantId], tenantId
    );
    if (Number(rule.rewardPoints) > 0) {
      const cp = await queryOneWithTenant<CustomerPointsRow>("SELECT id, available_points FROM t_customer_points WHERE customer_id = ? AND tenant_id = ?", [c.id, tenantId], tenantId);
      if (cp) {
        await queryWithTenant("UPDATE t_customer_points SET available_points = available_points + ?, total_points = total_points + ? WHERE customer_id = ? AND tenant_id = ?", [rule.rewardPoints, rule.rewardPoints, c.id, tenantId], tenantId);
      }
    }
    logs.push({ customerId: c.id, ruleName: rule.ruleName, rewardPoints: rule.rewardPoints });
  }
  return { ruleId, ruleName: rule.ruleName, executed: logs.length, logs };
}