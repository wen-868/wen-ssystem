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
  if (missing.length > 0) {
    throw Object.assign(new Error(`SMTP 配置不完整，缺少：${missing.join("、")}`), { statusCode: 400 });
  }
  const script = `
import smtplib, sys
from email.mime.text import MIMEText
host, port, user, pwd, ssl_flag, to = sys.argv[1:7]
msg = MIMEText("智享全链管理系统测试邮件：SMTP 配置验证成功。", "plain", "utf-8")
msg["Subject"] = "智享全链 - SMTP 配置测试"
msg["From"] = user
msg["To"] = to
try:
    if ssl_flag == "1":
        s = smtplib.SMTP_SSL(host, int(port), timeout=15)
    else:
        s = smtplib.SMTP(host, int(port), timeout=15)
        s.starttls()
    s.login(user, pwd)
    s.sendmail(user, [to], msg.as_string())
    s.quit()
    print("OK")
except Exception as e:
    print("ERR", e)
    sys.exit(1)
`;
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync(
      "python3",
      ["-c", script, cfg.smtp_host, cfg.smtp_port || "465", cfg.smtp_username, cfg.smtp_password, cfg.smtp_ssl || "1", cfg.smtp_username],
      { timeout: 30000 }
    );
    return { success: true, message: `测试邮件已发送至 ${cfg.smtp_username}（${stdout.trim()}）` };
  } catch (e: any) {
    const detail = (e?.stderr || e?.message || "").toString().slice(0, 200);
    throw Object.assign(new Error(`邮件发送失败：${detail}`), { statusCode: 400 });
  }
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

/** 备份文件目录（与 deploy/02-mysql-backup.sh 的 BACKUP_DIR 一致） */
const BACKUP_DIR = process.env.BACKUP_DIR || "/var/backups/mysql";

/** 备份历史列表（真实读取备份目录） */
export async function listBackups(): Promise<Array<{ name: string; size: number; mtime: string }>> {
  const fs = await import("fs");
  const path = await import("path");
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter((f: string) => f.endsWith(".sql.gz"));
    return files
      .map((f: string) => {
        const st = fs.statSync(path.join(BACKUP_DIR, f));
        return { name: f, size: st.size, mtime: st.mtime.toISOString() };
      })
      .sort((a: { mtime: string }, b: { mtime: string }) => (a.mtime < b.mtime ? 1 : -1));
  } catch {
    return [];
  }
}

/** 解析备份文件绝对路径（防路径穿越） */
export function resolveBackupPath(name: string): string | null {
  const path = require("path");
  const safe = path.basename(name);
  const full = path.join(BACKUP_DIR, safe);
  return full.startsWith(path.resolve(BACKUP_DIR)) ? full : null;
}

/** 删除备份文件 */
export async function deleteBackupFile(name: string): Promise<void> {
  const fs = await import("fs");
  const full = resolveBackupPath(name);
  if (!full) {
    throw new Error("非法备份文件名");
  }
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
  }
}
