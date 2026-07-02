import { queryWithTenant, queryOneWithTenant } from "../../shared/db.js";

export interface TemplateListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  type?: string;
  status?: string;
}

export interface TemplateCreateData {
  name: string;
  type: string;
  config?: unknown;
  description?: string;
}

export interface TemplateUpdateData {
  name?: string;
  type?: string;
  config?: unknown;
  description?: string;
  status?: string;
}

export async function listTemplates(tenantId: string, params: TemplateListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.keyword) { conditions.push("name LIKE ?"); sqlParams.push(`%${params.keyword}%`); }
  if (params.type) { conditions.push("type = ?"); sqlParams.push(params.type); }
  if (params.status) { conditions.push("status = ?"); sqlParams.push(params.status); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM custom_report_template ${where}`, sqlParams, tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<any>(
    `SELECT id, name, type, config, description, status, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM custom_report_template ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function createTemplate(tenantId: string, data: TemplateCreateData) {
  const result = await queryWithTenant<any>(
    `INSERT INTO custom_report_template (tenant_id, name, type, config, description, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [tenantId, data.name, data.type, JSON.stringify(data.config || {}), data.description || null],
    tenantId
  );
  return { id: (result as any).insertId };
}

export async function updateTemplate(tenantId: string, id: number, data: TemplateUpdateData) {
  const sets: string[] = [];
  const sqlParams: unknown[] = [];

  if (data.name !== undefined) { sets.push("name = ?"); sqlParams.push(data.name); }
  if (data.type !== undefined) { sets.push("type = ?"); sqlParams.push(data.type); }
  if (data.config !== undefined) { sets.push("config = ?"); sqlParams.push(JSON.stringify(data.config)); }
  if (data.description !== undefined) { sets.push("description = ?"); sqlParams.push(data.description); }
  if (data.status !== undefined) { sets.push("status = ?"); sqlParams.push(data.status); }
  sets.push("updated_at = NOW()");

  sqlParams.push(id, tenantId);

  await queryWithTenant(
    `UPDATE custom_report_template SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    sqlParams,
    tenantId
  );
  return { id };
}

export async function deleteTemplate(tenantId: string, id: number) {
  await queryWithTenant(
    "DELETE FROM custom_report_template WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  return { id };
}

export async function executeTemplate(tenantId: string, id: number, params: Record<string, unknown>) {
  const template = await queryOneWithTenant<any>(
    "SELECT id, name, type, config FROM custom_report_template WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!template) throw new Error("模板不存在");

  const config = typeof template.config === "string" ? JSON.parse(template.config) : template.config;
  const { dimensions, metrics, filters } = config;

  let sql = "SELECT ";
  const selectParts: string[] = [];
  const groupParts: string[] = [];

  if (dimensions && dimensions.length > 0) {
    dimensions.forEach((d: string) => { selectParts.push(d); groupParts.push(d); });
  }
  if (metrics && metrics.length > 0) {
    metrics.forEach((m: string) => { selectParts.push(m); });
  }

  sql += selectParts.join(", ");
  sql += ` FROM ${template.type === "sales" ? "sale_bill" : template.type === "inventory" ? "inventory_balance" : "orders"}`;

  const whereConditions: string[] = ["tenant_id = ?"];
  const whereParams: unknown[] = [tenantId];

  if (filters && Array.isArray(filters)) {
    filters.forEach((f: { field: string; op: string; value: unknown }) => {
      whereConditions.push(`${f.field} ${f.op} ?`);
      whereParams.push(f.value);
    });
  }

  if (params.dateStart) { whereConditions.push("created_at >= ?"); whereParams.push(params.dateStart); }
  if (params.dateEnd) { whereConditions.push("created_at <= ?"); whereParams.push(params.dateEnd); }

  if (whereConditions.length > 0) {
    sql += " WHERE " + whereConditions.join(" AND ");
  }

  if (groupParts.length > 0) {
    sql += " GROUP BY " + groupParts.join(", ");
  }

  sql += " ORDER BY created_at DESC LIMIT 1000";

  const rows = await queryWithTenant<any>(sql, whereParams, tenantId);
  return { template: { id: template.id, name: template.name, type: template.type }, rows, total: rows.length };
}

// ==================== Schedule ====================

export interface ScheduleListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}

export interface ScheduleCreateData {
  name: string;
  templateId: number;
  cronExpression: string;
  exportFormat: string;
  recipients?: string;
}

export interface ScheduleUpdateData {
  name?: string;
  templateId?: number;
  cronExpression?: string;
  exportFormat?: string;
  recipients?: string;
}

export async function listSchedules(tenantId: string, params: ScheduleListParams) {
  const offset = (params.page - 1) * params.pageSize;
  const conditions: string[] = ["cs.tenant_id = ?"];
  const sqlParams: unknown[] = [tenantId];

  if (params.keyword) { conditions.push("cs.name LIKE ?"); sqlParams.push(`%${params.keyword}%`); }
  if (params.status) { conditions.push("cs.status = ?"); sqlParams.push(params.status); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalRow = await queryOneWithTenant<{ total: number }>(
    `SELECT COUNT(*) AS total FROM custom_report_schedule cs ${where}`, sqlParams, tenantId
  );
  const total = totalRow?.total ?? 0;

  const records = await queryWithTenant<any>(
    `SELECT cs.id, cs.name, cs.template_id AS templateId,
            ct.name AS templateName, cs.cron_expression AS cronExpression,
            cs.export_format AS exportFormat, cs.recipients,
            cs.status, cs.last_run_at AS lastRunAt,
            cs.created_at AS createdAt, cs.updated_at AS updatedAt
     FROM custom_report_schedule cs
     LEFT JOIN custom_report_template ct ON ct.id = cs.template_id AND ct.tenant_id = cs.tenant_id
     ${where}
     ORDER BY cs.created_at DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset],
    tenantId
  );

  return { total, page: params.page, pageSize: params.pageSize, records };
}

export async function createSchedule(tenantId: string, data: ScheduleCreateData) {
  const result = await queryWithTenant<any>(
    `INSERT INTO custom_report_schedule (tenant_id, name, template_id, cron_expression, export_format, recipients, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [tenantId, data.name, data.templateId, data.cronExpression, data.exportFormat, data.recipients || null],
    tenantId
  );
  return { id: (result as any).insertId };
}

export async function updateSchedule(tenantId: string, id: number, data: ScheduleUpdateData) {
  const sets: string[] = [];
  const sqlParams: unknown[] = [];

  if (data.name !== undefined) { sets.push("name = ?"); sqlParams.push(data.name); }
  if (data.templateId !== undefined) { sets.push("template_id = ?"); sqlParams.push(data.templateId); }
  if (data.cronExpression !== undefined) { sets.push("cron_expression = ?"); sqlParams.push(data.cronExpression); }
  if (data.exportFormat !== undefined) { sets.push("export_format = ?"); sqlParams.push(data.exportFormat); }
  if (data.recipients !== undefined) { sets.push("recipients = ?"); sqlParams.push(data.recipients); }
  sets.push("updated_at = NOW()");

  sqlParams.push(id, tenantId);

  await queryWithTenant(
    `UPDATE custom_report_schedule SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`,
    sqlParams,
    tenantId
  );
  return { id };
}

export async function deleteSchedule(tenantId: string, id: number) {
  await queryWithTenant(
    "DELETE FROM custom_report_schedule WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  return { id };
}

export async function toggleSchedule(tenantId: string, id: number, status: string) {
  await queryWithTenant(
    "UPDATE custom_report_schedule SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [status, id, tenantId],
    tenantId
  );
  return { id, status };
}

export async function runSchedule(tenantId: string, id: number) {
  const schedule = await queryOneWithTenant<any>(
    "SELECT id, name, template_id AS templateId FROM custom_report_schedule WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );
  if (!schedule) throw new Error("定时任务不存在");

  await queryWithTenant(
    "UPDATE custom_report_schedule SET last_run_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [id, tenantId],
    tenantId
  );

  // Execute the associated template
  const result = await executeTemplate(tenantId, schedule.templateId, {});
  return { scheduleId: id, scheduleName: schedule.name, executedAt: new Date().toISOString(), result };
}