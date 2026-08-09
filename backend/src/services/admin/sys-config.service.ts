import { query, queryOne } from "../../shared/db";

// ==================== 类型定义 ====================

/** 系统配置行 */
interface SysConfigRow {
  id: number;
  configKey: string;
  configValue: string;
  configGroup: string;
  description: string;
  updatedAt: string | Date;
}

/** 配置ID行（存在性校验） */
interface ConfigIdRow {
  id: number;
}

export async function getAllConfigs(tenantId: string) {
  const records = await query<SysConfigRow>(
    `SELECT id, config_key AS configKey, config_value AS configValue,
            config_group AS configGroup, description, updated_at AS updatedAt
     FROM t_sys_config
     WHERE tenant_id = ?
     ORDER BY config_group, id`,
    [tenantId]
  );
  const grouped: Record<string, SysConfigRow[]> = {};
  for (const r of records) {
    const group = r.configGroup || "other";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(r);
  }
  return { all: records, grouped };
}

export async function getConfigByGroup(group: string, tenantId: string) {
  const records = await query<SysConfigRow>(
    `SELECT id, config_key AS configKey, config_value AS configValue,
            config_group AS configGroup, description, updated_at AS updatedAt
     FROM t_sys_config
     WHERE config_group = ? AND tenant_id = ?
     ORDER BY id`,
    [group, tenantId]
  );
  return records;
}

export async function batchUpdateConfigs(items: Array<{ config_key: string; config_value: string }>, tenantId: string) {
  for (const item of items) {
    const existing = await queryOne<ConfigIdRow>(
      "SELECT id FROM t_sys_config WHERE config_key = ? AND tenant_id = ?",
      [item.config_key, tenantId]
    );
    if (existing) {
      await query(
        `UPDATE t_sys_config SET config_value = ? WHERE config_key = ? AND tenant_id = ?`,
        [item.config_value, item.config_key, tenantId]
      );
    } else {
      await query(
        `INSERT INTO t_sys_config (config_key, config_value, config_group, description, tenant_id)
         VALUES (?, ?, 'other', '', ?)`,
        [item.config_key, item.config_value, tenantId]
      );
    }
  }
  return { updated: items.length };
}

export async function createConfig(body: {
  config_key: string;
  config_value: string;
  config_group: string;
  description: string;
}, tenantId: string) {
  await query(
    `INSERT INTO t_sys_config (config_key, config_value, config_group, description, tenant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.config_key, body.config_value, body.config_group, body.description, tenantId]
  );
  return { configKey: body.config_key };
}

/** 邮件配置测试（R100 商用化）：校验 SMTP 配置完整性 */
export async function testMailConfig(tenantId: string) {
  const rows = await query<{ config_key: string; config_value: string }>(
    "SELECT config_key, config_value FROM t_sys_config WHERE tenant_id = ? AND config_group = 'mail'",
    [tenantId]
  );
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.config_key] = r.config_value;
  const required = ["smtp_host", "smtp_port", "smtp_username", "smtp_password"];
  const missing = required.filter((k) => !cfg[k]);
  return {
    success: missing.length === 0,
    message: missing.length === 0
      ? `SMTP 配置完整（${cfg.smtp_host}:${cfg.smtp_port}），接入邮件服务后即可发送`
      : `缺少配置项：${missing.join("、")}`,
    config: { host: cfg.smtp_host || "", port: cfg.smtp_port || "", username: cfg.smtp_username || "", ssl: cfg.smtp_ssl || "0" },
  };
}

/** 手动数据库备份（复用服务器 mysqldump 备份脚本） */
export async function manualBackup() {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const { resolve } = await import("path");
  const execFileAsync = promisify(execFile);
  const script = resolve(__dirname, "../../../../../deploy/02-mysql-backup.sh");
  try {
    const { stdout } = await execFileAsync("bash", [script], { timeout: 180000 });
    const lastLine = stdout.trim().split("\n").filter(Boolean).pop() || "";
    return { success: true, message: "备份完成", detail: lastLine, backupTime: new Date().toISOString() };
  } catch (e: any) {
    return { success: false, message: "备份失败", detail: e?.stderr || e?.message || "" };
  }
}
