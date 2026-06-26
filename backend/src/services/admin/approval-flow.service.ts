import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

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

  const records = await queryWithTenant<any>(
    `SELECT id, rule_name AS ruleName, business_type AS businessType,
            trigger_condition AS triggerCondition, approval_chain AS approvalChain,
            sla_hours AS slaHours, escalation_level AS escalationLevel,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM approval_rule
     ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM approval_rule ${where}`,
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
    businessType: "PURCHASE_ORDER" | "SALE_RETURN" | "PRICE_CHANGE" | "CREDIT_LIMIT";
    triggerCondition?: any;
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
    `INSERT INTO approval_rule (rule_name, business_type, trigger_condition, approval_chain, sla_hours, escalation_level, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [body.ruleName, body.businessType, JSON.stringify(body.triggerCondition), JSON.stringify(body.approvalChain), body.slaHours, body.escalationLevel, tenantId],
    tenantId
  );

  await queryWithTenant(
    `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data, tenant_id)
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
    triggerCondition?: any;
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
  const existing = await queryOneWithTenant<any>(
    "SELECT id FROM approval_rule WHERE id = ?",
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
      `UPDATE approval_rule SET ${updates.join(", ")} WHERE id = ?`,
      [...params, id],
      tenantId
    );
  }

  return { id, ...body };
}
