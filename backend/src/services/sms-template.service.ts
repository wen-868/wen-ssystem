/**
 * 短信模板管理服务（真实存储 t_sms_template）
 */
import { query, queryOne } from "../shared/db";
import { AppError } from "../shared/app-error";

interface SmsTemplateRow {
  id: number;
  name: string;
  code: string;
  content: string;
  purpose: string;
  status: string;
}

interface CountRow {
  total: number;
}

export interface SmsTemplateInput {
  name: string;
  code: string;
  content: string;
  purpose?: string;
  status?: "ENABLED" | "DISABLED";
}

export async function listSmsTemplates(tenantId: string): Promise<SmsTemplateRow[]> {
  return query<SmsTemplateRow>(
    `SELECT id, name, code, content, purpose, status
     FROM t_sms_template
     WHERE tenant_id = ?
     ORDER BY id DESC`,
    [tenantId]
  );
}

export async function createSmsTemplate(body: SmsTemplateInput, tenantId: string): Promise<{ id: number }> {
  if (!body.name || !body.code || !body.content) {
    throw new AppError("模板名称、模板编码、模板内容不能为空", 400);
  }
  const existing = await queryOne<CountRow>(
    "SELECT COUNT(*) AS total FROM t_sms_template WHERE tenant_id = ? AND code = ?",
    [tenantId, body.code]
  );
  if (existing && Number(existing.total) > 0) {
    throw new AppError("该模板编码已存在", 400);
  }
  const result = await query<{ insertId: number }>(
    `INSERT INTO t_sms_template (tenant_id, name, code, content, purpose, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, body.name, body.code, body.content, body.purpose || "", body.status || "ENABLED"]
  );
  return { id: (result as unknown as { insertId: number }).insertId };
}

export async function updateSmsTemplate(id: number, body: Partial<SmsTemplateInput>, tenantId: string): Promise<void> {
  const existing = await queryOne<CountRow>(
    "SELECT COUNT(*) AS total FROM t_sms_template WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );
  if (!existing || Number(existing.total) === 0) {
    throw new AppError("短信模板不存在", 404);
  }
  await query(
    `UPDATE t_sms_template SET name = ?, code = ?, content = ?, purpose = ?, status = ? WHERE id = ? AND tenant_id = ?`,
    [
      body.name ?? "",
      body.code ?? "",
      body.content ?? "",
      body.purpose ?? "",
      body.status ?? "ENABLED",
      id,
      tenantId,
    ]
  );
}

export async function deleteSmsTemplate(id: number, tenantId: string): Promise<void> {
  await query("DELETE FROM t_sms_template WHERE id = ? AND tenant_id = ?", [id, tenantId]);
}
