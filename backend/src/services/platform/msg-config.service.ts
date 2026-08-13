/**
 * 平台消息配置服务（总台管理短信/邮件配置）
 *
 * 配置写入 default 租户的 t_sys_config（商户注册验证码等读取 default 租户配置），
 * 短信模板使用 t_sms_template（tenant_id = 'default'）。
 */
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";

const MSG_KEYS = [
  "sms_verify_enabled",
  "sms_provider",
  "sms_access_key",
  "sms_secret_key",
  "sms_sign_name",
  "sms_sdk_app_id",
  "smtp_host",
  "smtp_port",
  "smtp_username",
  "smtp_password",
  "mail_from_address",
  "mail_from_name",
  "smtp_ssl",
];

interface ConfigRow {
  configKey: string;
  configValue: string;
}

export async function getMsgConfig(): Promise<Record<string, string>> {
  const rows = await query<ConfigRow>(
    `SELECT config_key AS configKey, config_value AS configValue
     FROM t_sys_config WHERE tenant_id = 'default' AND config_key IN (${MSG_KEYS.map(() => "?").join(",")})`,
    MSG_KEYS
  );
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.configKey] = r.configValue;
  return cfg;
}

export async function updateMsgConfig(items: Array<{ config_key: string; config_value: string }>): Promise<void> {
  for (const item of items) {
    if (!MSG_KEYS.includes(item.config_key)) continue;
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM t_sys_config WHERE config_key = ? AND tenant_id = 'default'",
      [item.config_key]
    );
    if (existing) {
      await query(
        "UPDATE t_sys_config SET config_value = ? WHERE config_key = ? AND tenant_id = 'default'",
        [item.config_value, item.config_key]
      );
    } else {
      await query(
        "INSERT INTO t_sys_config (config_key, config_value, config_group, description, tenant_id) VALUES (?, ?, 'msg', '', 'default')",
        [item.config_key, item.config_value]
      );
    }
  }
}

export async function listPlatformSmsTemplates() {
  return query(
    `SELECT id, name, code, content, purpose, status
     FROM t_sms_template WHERE tenant_id = 'default' ORDER BY id DESC`
  );
}

export async function createPlatformSmsTemplate(body: {
  name: string;
  code: string;
  content: string;
  purpose?: string;
  status?: string;
}): Promise<{ id: number }> {
  if (!body.name || !body.code || !body.content) {
    throw new AppError("模板名称、编码、内容不能为空", 400);
  }
  const result = await query<{ insertId: number }>(
    `INSERT INTO t_sms_template (tenant_id, name, code, content, purpose, status)
     VALUES ('default', ?, ?, ?, ?, ?)`,
    [body.name, body.code, body.content, body.purpose || "", body.status || "ENABLED"]
  );
  return { id: (result as unknown as { insertId: number }).insertId };
}

export async function updatePlatformSmsTemplate(id: number, body: {
  name?: string;
  code?: string;
  content?: string;
  purpose?: string;
  status?: string;
}): Promise<void> {
  await query(
    `UPDATE t_sms_template SET name = ?, code = ?, content = ?, purpose = ?, status = ? WHERE id = ? AND tenant_id = 'default'`,
    [body.name ?? "", body.code ?? "", body.content ?? "", body.purpose ?? "", body.status ?? "ENABLED", id]
  );
}

export async function deletePlatformSmsTemplate(id: number): Promise<void> {
  await query("DELETE FROM t_sms_template WHERE id = ? AND tenant_id = 'default'", [id]);
}
