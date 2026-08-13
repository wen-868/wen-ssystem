/**
 * 自动备份定时任务
 *
 * 读取系统配置（backup_auto / backup_frequency / backup_time / backup_retention_days），
 * 按周期（每日/每周/每月）在指定时间执行数据库备份，并按保留天数清理旧备份。
 * 数据库备份为全局动作（同一数据库），任一租户开启自动备份即生效，同周期只执行一次。
 */
import cron from "node-cron";
import { query } from "../shared/db";
import logger from "../shared/logger";
import { listBackups, deleteBackupFile, manualBackup } from "../services/admin/sys-config.service";

interface BackupConfigRow {
  tenantId: string;
  configKey: string;
  configValue: string;
}

const BACKUP_KEYS = ["backup_auto", "backup_frequency", "backup_time", "backup_retention_days"];

async function collectBackupConfigs(): Promise<Array<Record<string, string>>> {
  const rows = await query<BackupConfigRow>(
    `SELECT tenant_id AS tenantId, config_key AS configKey, config_value AS configValue
     FROM t_sys_config WHERE config_key IN (?, ?, ?, ?)`,
    BACKUP_KEYS
  );
  const map = new Map<string, Record<string, string>>();
  for (const r of rows) {
    if (!map.has(r.tenantId)) map.set(r.tenantId, { tenantId: r.tenantId });
    map.get(r.tenantId)![r.configKey] = r.configValue;
  }
  return Array.from(map.values());
}

/** 判断当前是否到达该周期的备份时间点（且该周期尚未备份） */
function shouldBackup(cfg: Record<string, string>, latestMtime: Date | null): boolean {
  if (cfg.backup_auto !== "1") return false;
  const [h, m] = String(cfg.backup_time || "02:00").split(":").map(Number);
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (cfg.backup_frequency === "weekly") {
    periodStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // 本周一
  } else if (cfg.backup_frequency === "monthly") {
    periodStart.setDate(1); // 本月 1 号
  }
  const deadline = new Date(periodStart);
  deadline.setHours(h || 2, m || 0, 0, 0);
  const due = now.getTime() >= deadline.getTime();
  const alreadyBackedUp = latestMtime ? latestMtime.getTime() >= deadline.getTime() : false;
  return due && !alreadyBackedUp;
}

async function cleanupExpiredBackups(retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 86400000;
  const files = await listBackups();
  for (const f of files) {
    if (new Date(f.mtime).getTime() < cutoff) {
      await deleteBackupFile(f.name);
      logger.info(`[自动备份] 清理过期备份: ${f.name}`);
    }
  }
}

async function runAutoBackupCheck() {
  try {
    const configs = await collectBackupConfigs();
    if (configs.length === 0) return;
    const backups = await listBackups();
    const latestMtime = backups.length ? new Date(backups[0].mtime) : null;

    for (const cfg of configs) {
      if (shouldBackup(cfg, latestMtime)) {
        const result = await manualBackup();
        logger.info(
          `[自动备份] ${result.success ? "执行成功" : "执行失败"} tenant=${cfg.tenantId} detail=${result.detail || ""}`
        );
        break; // 同周期只备份一次
      }
    }

    // 清理过期备份（取开启自动备份的租户保留天数）
    const enabled = configs.find((c) => c.backup_auto === "1");
    if (enabled?.backup_retention_days) {
      await cleanupExpiredBackups(Number(enabled.backup_retention_days));
    }
  } catch (e: any) {
    logger.error(`[自动备份] 检查失败: ${e?.message || e}`);
  }
}

cron.schedule("* * * * *", runAutoBackupCheck);
