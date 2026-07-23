/**
 * 平台总后台 - 配置与审计服务
 *
 * 功能：全局配置、操作日志
 */

import { query, queryOne } from "../../shared/db";
import type { ResultSetHeader } from "mysql2";

// ─── 类型定义 ─────────────────────────────────────────────────

/** 平台配置行 */
interface PlatformConfigRow {
  configKey: string;
  configValue: string;
  category: string;
  description: string;
  updatedAt: Date | string;
}

/** 配置键存在性检查行 */
interface ConfigKeyRow {
  config_key: string;
}

/** 操作日志列表行 */
interface PlatformAuditLogRow {
  id: number;
  adminId: number;
  adminName: string;
  module: string;
  action: string;
  detail: string;
  ipAddress: string;
  createdAt: Date | string;
}

/** 总数行 */
interface CountRow {
  total: number;
}

/** INSERT/UPDATE 返回结果 */
interface AffectedResult extends ResultSetHeader { }

// ─── 系统配置 ────────────────────────────────────────────────

/**
 * 获取全局配置列表
 */
export async function listPlatformConfigs(
  category?: string
) {
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const where = conditions.join(" AND ");

  const rows = await query<PlatformConfigRow>(
    `SELECT config_key AS configKey, config_value AS configValue,
            category, description, updated_at AS updatedAt
     FROM t_platform_config
     WHERE ${where}
     ORDER BY category, sort_order ASC`,
    params
  );

  return rows;
}

/**
 * 更新全局配置
 */
export async function updatePlatformConfig(
  configKey: string,
  configValue: string,
  operator: string
) {
  const existing = await queryOne<ConfigKeyRow>(
    "SELECT config_key FROM t_platform_config WHERE config_key = ?",
    [configKey]
  );

  if (!existing) {
    throw Object.assign(new Error("配置项不存在"), { statusCode: 404 });
  }

  await query(
    "UPDATE t_platform_config SET config_value = ?, updated_by = ? WHERE config_key = ?",
    [configValue, operator, configKey]
  );

  return { configKey, updated: true };
}

// ─── 操作日志 ────────────────────────────────────────────────

/**
 * 平台操作日志列表
 */
export async function listPlatformAuditLogs(
  page: number,
  pageSize: number,
  filters?: {
    adminId?: number;
    action?: string;
    module?: string;
    keyword?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.adminId) {
    conditions.push("admin_id = ?");
    params.push(filters.adminId);
  }
  if (filters?.action) {
    conditions.push("action = ?");
    params.push(filters.action);
  }
  if (filters?.module) {
    conditions.push("module = ?");
    params.push(filters.module);
  }
  if (filters?.keyword) {
    conditions.push("(detail LIKE ? OR ip_address LIKE ?)");
    const like = `%${filters.keyword}%`;
    params.push(like, like);
  }
  if (filters?.startDate) {
    conditions.push("DATE(created_at) >= ?");
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push("DATE(created_at) <= ?");
    params.push(filters.endDate);
  }

  const where = conditions.join(" AND ");

  const rows = await query<PlatformAuditLogRow>(
    `SELECT l.id, l.admin_id AS adminId, a.real_name AS adminName,
            l.module, l.action, l.detail, l.ip_address AS ipAddress,
            l.created_at AS createdAt
     FROM t_platform_audit_log l
     LEFT JOIN t_platform_admin a ON a.id = l.admin_id
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total
     FROM t_platform_audit_log l WHERE ${where}`,
    params
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows
  };
}