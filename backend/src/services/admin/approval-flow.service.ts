import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { AppError } from "../../shared/app-error";

/** t_approval_rule 规则列表行 */
interface ApprovalRuleRow {
  id: number | string;
  ruleName: string;
  businessType: string;
  triggerCondition: string | null;
  approvalChain: string | null;
  slaHours: number | string;
  escalationLevel: number | string;
  status: number | string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** COUNT(*) AS total 通用行 */
interface CountTotalRow {
  total: number;
}

/** SELECT id 通用行 */
interface IdRow {
  id: number | string;
}

export async function listRules(
  page: number,
  pageSize: number,
  businessType: string | null,
  status: number | null,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (businessType) {
    conditions.push("business_type = ?");
    params.push(businessType);
  }
  if (status !== null) {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<ApprovalRuleRow>(
    `SELECT id, rule_name AS ruleName, business_type AS businessType,
            trigger_condition AS triggerCondition, approval_chain AS approvalChain,
            sla_hours AS slaHours, escalation_level AS escalationLevel,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM t_approval_rule
     ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_approval_rule ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function createRule(
  body: {
    ruleName: string;
    businessType: "PURCHASE_ORDER" | "SALE_RETURN" | "PRICE_CHANGE" | "CREDIT_LIMIT" | "EXPENSE";
    triggerCondition?: Record<string, unknown>;
    approvalChain: Array<{
      level: number;
      approverType: "ROLE" | "USER" | "DEPARTMENT";
      approverValue: string;
    }>;
    slaHours: number;
    escalationLevel: number;
  },
  userId: number | null,
  username: string,
  tenantId: string
) {
  await queryWithTenant(
    `INSERT INTO t_approval_rule (rule_name, business_type, trigger_condition, approval_chain, sla_hours, escalation_level, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [body.ruleName, body.businessType, JSON.stringify(body.triggerCondition), JSON.stringify(body.approvalChain), body.slaHours, body.escalationLevel, tenantId],
    tenantId
  );

  await queryWithTenant(
    `INSERT INTO t_operation_log (operator_id, operator_name, module, action, biz_no, after_data, tenant_id)
     VALUES (?, ?, 'APPROVAL_RULE', 'CREATE', ?, ?, ?)`,
    [userId ?? null, username, body.ruleName, JSON.stringify(body), tenantId],
    tenantId
  );

  return { ruleName: body.ruleName };
}

export async function updateRule(
  id: number,
  body: {
    ruleName?: string;
    triggerCondition?: Record<string, unknown>;
    approvalChain?: Array<{
      level: number;
      approverType: "ROLE" | "USER" | "DEPARTMENT";
      approverValue: string;
    }>;
    slaHours?: number;
    escalationLevel?: number;
    status?: number;
  },
  tenantId: string
) {
  const existing = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_approval_rule WHERE id = ?",
    [id],
    tenantId
  );
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.ruleName !== undefined) {
    updates.push("rule_name = ?");
    params.push(body.ruleName);
  }
  if (body.triggerCondition !== undefined) {
    updates.push("trigger_condition = ?");
    params.push(JSON.stringify(body.triggerCondition));
  }
  if (body.approvalChain !== undefined) {
    updates.push("approval_chain = ?");
    params.push(JSON.stringify(body.approvalChain));
  }
  if (body.slaHours !== undefined) {
    updates.push("sla_hours = ?");
    params.push(body.slaHours);
  }
  if (body.escalationLevel !== undefined) {
    updates.push("escalation_level = ?");
    params.push(body.escalationLevel);
  }
  if (body.status !== undefined) {
    updates.push("status = ?");
    params.push(body.status);
  }

  if (updates.length > 0) {
    await queryWithTenant(
      `UPDATE t_approval_rule SET ${updates.join(", ")} WHERE id = ?`,
      [...params, id],
      tenantId
    );
  }

  return { id, ...body };
}

export async function deleteRule(id: number, tenantId: string) {
  const existing = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_approval_rule WHERE id = ?",
    [id],
    tenantId
  );
  if (!existing) {
    return null;
  }

  // 规则已被审批实例引用时禁止物理删除，保护历史审批数据
  const usedRow = await queryOneWithTenant<CountTotalRow>(
    "SELECT COUNT(*) AS total FROM t_approval_instance WHERE rule_id = ?",
    [id],
    tenantId
  );
  if (Number(usedRow?.total ?? 0) > 0) {
    throw new AppError("该审批规则已被审批实例使用，无法删除", 400);
  }

  await queryWithTenant(
    "DELETE FROM t_approval_rule WHERE id = ?",
    [id],
    tenantId
  );

  return { id };
}
