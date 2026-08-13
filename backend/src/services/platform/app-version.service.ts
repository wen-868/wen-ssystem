// 版本表为平台级（无租户列），使用底层 query/queryOne，避免 tenant_id 自动注入
import { query, queryOne } from "../../shared/db";

/**
 * 应用版本发布（电脑端/移动端更新检查）
 *
 * 各端（工作台/收银台 Web、移动 APP、打印助手）启动时调用公开接口
 * GET /api/app/version/:platform 检查是否有新版本，有则提示更新。
 * 版本记录由总台在 saas-admin「版本发布」页维护。
 */

export const APP_PLATFORMS = ["admin_web", "app_mobile", "print_agent"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

export interface AppVersionRow {
  id: number;
  platform: string;
  versionCode: number;
  versionName: string;
  minVersionCode: number;
  isForce: number;
  updateUrl: string;
  packageUrl: string;
  updateNote: string | null;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

/** 当前启用的最新版本（供客户端检查） */
export async function getLatestVersion(platform: string) {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT platform, version_code AS versionCode, version_name AS versionName,
            min_version_code AS minVersionCode, is_force AS isForce,
            update_url AS updateUrl, package_url AS packageUrl,
            update_note AS updateNote, updated_at AS updatedAt
     FROM t_app_version
     WHERE platform = ? AND enabled = 1
     ORDER BY version_code DESC LIMIT 1`,
    [platform]
  );
  if (!row) return null;
  return {
    platform: row.platform,
    versionCode: Number(row.versionCode),
    versionName: row.versionName,
    minVersionCode: Number(row.minVersionCode || 0),
    isForce: Number(row.isForce || 0) === 1,
    updateUrl: row.updateUrl || "",
    packageUrl: row.packageUrl || "",
    updateNote: row.updateNote || "",
    updatedAt: row.updatedAt,
  };
}

/** 版本列表（总台管理） */
export async function listVersions(platform?: string) {
  const sql = `SELECT id, platform, version_code AS versionCode, version_name AS versionName,
                      min_version_code AS minVersionCode, is_force AS isForce,
                      update_url AS updateUrl, package_url AS packageUrl,
                      update_note AS updateNote, enabled, created_at AS createdAt, updated_at AS updatedAt
               FROM t_app_version
               ${platform ? "WHERE platform = ?" : ""}
               ORDER BY platform ASC, version_code DESC`;
  return query<Record<string, unknown>>(sql, platform ? [platform] : []);
}

/** 发布/更新版本（平台+版本号唯一，幂等 upsert） */
export async function publishVersion(data: {
  platform: string;
  versionCode: number;
  versionName: string;
  minVersionCode?: number;
  isForce?: boolean;
  updateUrl?: string;
  packageUrl?: string;
  updateNote?: string;
  enabled?: boolean;
}) {
  const existing = await queryOne<Record<string, unknown>>(
    `SELECT id FROM t_app_version WHERE platform = ? AND version_code = ?`,
    [data.platform, data.versionCode]
  );
  const values = [
    data.platform,
    data.versionCode,
    data.versionName,
    data.minVersionCode || 0,
    data.isForce ? 1 : 0,
    data.updateUrl || "",
    data.packageUrl || "",
    data.updateNote || "",
    data.enabled === false ? 0 : 1,
  ];
  if (existing) {
    await query(
      `UPDATE t_app_version SET platform=?, version_code=?, version_name=?, min_version_code=?,
              is_force=?, update_url=?, package_url=?, update_note=?, enabled=?, updated_at=NOW() WHERE id=?`,
      [...values, existing.id]
    );
  } else {
    await query(
      `INSERT INTO t_app_version (platform, version_code, version_name, min_version_code, is_force, update_url, package_url, update_note, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  }
  return { success: true, platform: data.platform, versionCode: data.versionCode };
}

/** 删除版本 */
export async function deleteVersion(id: number) {
  await query(`DELETE FROM t_app_version WHERE id = ?`, [id]);
  return { success: true };
}
