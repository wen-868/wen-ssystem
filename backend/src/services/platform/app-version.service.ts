// 版本表为平台级（无租户列），使用底层 query/queryOne，避免 tenant_id 自动注入
import { query, queryOne } from "../../shared/db";
import { insertPlatformAuditLog } from "../admin/platform-audit-log.service";

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
  /** C6-1A：发布状态 DRAFT/PUBLISHED/PAUSED/ARCHIVED（178 迁移加列） */
  status: string;
  /** C6-1A：灰度放量比例 0-100（178 迁移加列） */
  grayRatio: number;
  /** C6-1A：归档时间（178 迁移加列） */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 发布状态枚举（178 迁移的 t_app_version.status） */
export const APP_VERSION_STATUS = ["DRAFT", "PUBLISHED", "PAUSED", "ARCHIVED"] as const;
export type AppVersionStatus = (typeof APP_VERSION_STATUS)[number];

/** 版本操作的操作人上下文（写 t_platform_audit_log 留痕用） */
export interface AppVersionOperator {
  adminId: number;
  adminName: string;
  ip?: string | null;
}

/** 当前启用的最新版本（供客户端检查；arch 用于桌面客户端按架构选下载地址） */
export async function getLatestVersion(platform: string, arch?: string) {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT platform, version_code AS versionCode, version_name AS versionName,
            min_version_code AS minVersionCode, is_force AS isForce,
            update_url AS updateUrl, package_url AS packageUrl,
            update_url_x64 AS updateUrlX64, update_url_ia32 AS updateUrlIa32,
            update_url_arm64 AS updateUrlArm64,
            update_note AS updateNote, updated_at AS updatedAt
     FROM t_app_version
     WHERE platform = ? AND enabled = 1 AND status = 'PUBLISHED'
     ORDER BY version_code DESC LIMIT 1`,
    [platform]
  );
  if (!row) return null;
  // 下载槽位：三个地址字段按平台解释
  // - 桌面端(admin_web/print_agent)：x64 / ia32(32位) / arm64（按 CPU 架构）
  // - 手机端(app_mobile)：android / ios / harmony（按操作系统平台）
  let key = "";
  if (platform === "app_mobile") {
    key =
      arch === "android" || arch === "Android" ? "x64"
        : arch === "ios" || arch === "iOS" || arch === "iphone" ? "ia32"
          : arch === "harmony" || arch === "HarmonyOS" || arch === "harmonyos" ? "arm64"
            : "";
  } else {
    key =
      arch === "x64" || arch === "x86_64" || arch === "x86" ? "x64"
        : arch === "ia32" || arch === "x86_32" ? "ia32"
          : arch === "arm64" || arch === "arm64-v8a" ? "arm64"
            : "";
  }
  const archUrl =
    key === "x64" ? row.updateUrlX64
      : key === "ia32" ? row.updateUrlIa32
        : key === "arm64" ? row.updateUrlArm64
          : "";
  return {
    platform: row.platform,
    versionCode: Number(row.versionCode),
    versionName: row.versionName,
    minVersionCode: Number(row.minVersionCode || 0),
    isForce: Number(row.isForce || 0) === 1,
    updateUrl: String(archUrl || row.updateUrl || ""),
    updateUrlX64: row.updateUrlX64 || "",
    updateUrlIa32: row.updateUrlIa32 || "",
    updateUrlArm64: row.updateUrlArm64 || "",
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
                      update_note AS updateNote, enabled,
                      status, gray_ratio AS grayRatio, archived_at AS archivedAt,
                      created_at AS createdAt, updated_at AS updatedAt
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
  updateUrlX64?: string;
  updateUrlIa32?: string;
  updateUrlArm64?: string;
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
    data.updateUrlX64 || "",
    data.updateUrlIa32 || "",
    data.updateUrlArm64 || "",
    data.packageUrl || "",
    data.updateNote || "",
    data.enabled === false ? 0 : 1,
  ];
  if (existing) {
    await query(
      `UPDATE t_app_version SET platform=?, version_code=?, version_name=?, min_version_code=?,
              is_force=?, update_url=?, update_url_x64=?, update_url_ia32=?, update_url_arm64=?,
              package_url=?, update_note=?, enabled=?, status='PUBLISHED', updated_at=NOW() WHERE id=?`,
      [...values, existing.id]
    );
  } else {
    await query(
      `INSERT INTO t_app_version (platform, version_code, version_name, min_version_code, is_force, update_url, update_url_x64, update_url_ia32, update_url_arm64, package_url, update_note, enabled, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')`,
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

// ─── C6-1A：版本草稿 / 放量控制 / 归档 / 回滚（178 迁移加列后可用） ─────────────

/** 按 id 取版本行（不存在即 404，避免对空行做静默 UPDATE） */
async function requireVersion(id: number) {
  const row = await queryOne<{
    id: number;
    platform: string;
    versionCode: number;
    versionName: string;
    status: string;
  }>(
    `SELECT id, platform, version_code AS versionCode, version_name AS versionName, status
     FROM t_app_version WHERE id = ?`,
    [id]
  );
  if (!row) {
    throw Object.assign(new Error("版本不存在"), { statusCode: 404 });
  }
  return row;
}

/** 写版本操作审计（t_platform_audit_log，仅追加） */
async function auditVersionAction(
  action: string,
  description: string,
  row: { id: number; platform: string; versionCode: number; versionName: string },
  operator: AppVersionOperator,
  detail?: Record<string, unknown>
) {
  await insertPlatformAuditLog({
    adminId: operator.adminId,
    adminName: operator.adminName,
    module: "app_version",
    action,
    auditType: action,
    description,
    targetType: "app_version",
    targetId: row.id,
    detail: {
      platform: row.platform,
      versionCode: row.versionCode,
      versionName: row.versionName,
      ...(detail ?? {})
    },
    ip: operator.ip ?? null
  });
}

/**
 * 保存版本草稿（POST /api/padmin/app-versions/draft）
 *
 * 清账依据：C6-0 §三.1 #34（AppVersions.vue:362）「无草稿保存端点」。
 * 落地口径（推荐项）：用 178 迁移新增的 status 列存草稿（status='DRAFT'），
 * **不用** enabled=0 兼职 —— enabled 的既有语义是「是否作为当前版本」（141 建表注释），
 * 草稿与「当前版本」是两件事，兼职会在客户端检查与页面展示上埋坑。
 * 草稿同时保证 enabled=0，客户端检查（enabled=1 AND status='PUBLISHED'）永远取不到草稿。
 */
export async function saveDraftVersion(data: {
  platform: string;
  versionCode: number;
  versionName: string;
  minVersionCode?: number;
  isForce?: boolean;
  updateUrl?: string;
  updateUrlX64?: string;
  updateUrlIa32?: string;
  updateUrlArm64?: string;
  packageUrl?: string;
  updateNote?: string;
}) {
  const existing = await queryOne<{ id: number; status: string }>(
    `SELECT id, status FROM t_app_version WHERE platform = ? AND version_code = ?`,
    [data.platform, data.versionCode]
  );
  // 防呆：草稿保存**不得**把已发布/已归档的版本悄悄改回草稿（那等于静默下架一个线上版本）。
  // 允许覆盖的只有"未定稿"状态（DRAFT 继续编辑 / PAUSED 暂停中改稿）。
  if (existing && (existing.status === "PUBLISHED" || existing.status === "ARCHIVED")) {
    throw Object.assign(
      new Error(`版本号已存在且状态为 ${existing.status}，草稿不能覆盖已发布/已归档版本`),
      { statusCode: 400 }
    );
  }
  const values = [
    data.versionName,
    data.minVersionCode || 0,
    data.isForce ? 1 : 0,
    data.updateUrl || "",
    data.updateUrlX64 || "",
    data.updateUrlIa32 || "",
    data.updateUrlArm64 || "",
    data.packageUrl || "",
    data.updateNote || ""
  ];
  if (existing) {
    await query(
      `UPDATE t_app_version SET version_name=?, min_version_code=?, is_force=?,
              update_url=?, update_url_x64=?, update_url_ia32=?, update_url_arm64=?,
              package_url=?, update_note=?, enabled=0, status='DRAFT', updated_at=NOW()
       WHERE id=?`,
      [...values, existing.id]
    );
    return { id: existing.id, status: "DRAFT", enabled: false };
  }
  const result = await query<{ insertId?: number }>(
    `INSERT INTO t_app_version (platform, version_code, version_name, min_version_code, is_force,
            update_url, update_url_x64, update_url_ia32, update_url_arm64, package_url, update_note,
            enabled, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'DRAFT')`,
    [data.platform, data.versionCode, ...values]
  );
  return {
    id: Number((result as unknown as { insertId?: number }).insertId ?? 0),
    status: "DRAFT",
    enabled: false
  };
}

/**
 * 暂停放量（POST /api/padmin/app-versions/:id/pause）
 *
 * 清账依据：C6-0 §三.1 #36（AppVersions.vue:399）「版本操作（公告/放量/归档）无端点」。
 * 语义：status='PAUSED' + gray_ratio=0（暂停后不再继续放量）；不删行、不改 enabled，
 * 便于「继续放量」原样恢复。
 */
export async function pauseVersion(id: number, operator: AppVersionOperator) {
  const row = await requireVersion(id);
  if (row.status !== "PUBLISHED" && row.status !== "PAUSED") {
    throw Object.assign(new Error("仅已发布版本可暂停放量（当前状态 " + row.status + "）"), { statusCode: 400 });
  }
  await query(
    `UPDATE t_app_version SET status='PAUSED', gray_ratio=0, updated_at=NOW() WHERE id = ?`,
    [id]
  );
  await auditVersionAction("PAUSE_VERSION", `暂停放量：${row.platform} ${row.versionName}`, row, operator, {
    status: "PAUSED"
  });
  return { id, status: "PAUSED", grayRatio: 0 };
}

/** 继续放量（POST /api/padmin/app-versions/:id/resume）：status 回到 PUBLISHED */
export async function resumeVersion(id: number, operator: AppVersionOperator) {
  const row = await requireVersion(id);
  if (row.status !== "PAUSED") {
    throw Object.assign(new Error("仅暂停中的版本可继续放量（当前状态 " + row.status + "）"), { statusCode: 400 });
  }
  await query(
    `UPDATE t_app_version SET status='PUBLISHED', updated_at=NOW() WHERE id = ?`,
    [id]
  );
  await auditVersionAction("RESUME_VERSION", `继续放量：${row.platform} ${row.versionName}`, row, operator, {
    status: "PUBLISHED"
  });
  return { id, status: "PUBLISHED" };
}

/**
 * 归档（POST /api/padmin/app-versions/:id/archive）
 *
 * 语义：status='ARCHIVED' + enabled=0 + archived_at=NOW()。
 * 归档行不参与客户端检查（getLatestVersion 过滤 status='PUBLISHED'），但保留历史记录。
 */
export async function archiveVersion(id: number, operator: AppVersionOperator) {
  const row = await requireVersion(id);
  if (row.status === "ARCHIVED") {
    throw Object.assign(new Error("该版本已归档"), { statusCode: 400 });
  }
  await query(
    `UPDATE t_app_version SET status='ARCHIVED', enabled=0, archived_at=NOW(), updated_at=NOW() WHERE id = ?`,
    [id]
  );
  await auditVersionAction("ARCHIVE_VERSION", `归档版本：${row.platform} ${row.versionName}`, row, operator, {
    status: "ARCHIVED",
    previousStatus: row.status
  });
  return { id, status: "ARCHIVED", enabled: false };
}

/**
 * 回滚到指定已发布版本（POST /api/padmin/app-versions/:id/rollback）
 *
 * 口径（凌舟裁定 C6-0-R5②）：回滚目标 = **已发布版本**（status='PUBLISHED'），
 * 且其 version_code **小于当前启用版本**（即「上一个已发布版本」这一族）。
 * 落地：目标行 enabled=1 + status='PUBLISHED'，同平台其它行 enabled=0（当前版本唯一）；
 * 写 t_platform_audit_log 留痕（零 DDL，复用既有列）。
 */
export async function rollbackVersion(id: number, operator: AppVersionOperator) {
  const row = await requireVersion(id);
  if (row.status !== "PUBLISHED") {
    throw Object.assign(
      new Error("回滚目标必须是已发布版本（当前状态 " + row.status + "）"),
      { statusCode: 400 }
    );
  }

  const current = await queryOne<{ id: number; versionCode: number }>(
    `SELECT id, version_code AS versionCode FROM t_app_version
     WHERE platform = ? AND enabled = 1 AND id <> ?
     ORDER BY version_code DESC LIMIT 1`,
    [row.platform, id]
  );
  if (current && Number(current.versionCode) <= Number(row.versionCode)) {
    throw Object.assign(
      new Error("回滚目标必须早于当前启用版本"),
      { statusCode: 400 }
    );
  }

  await query(
    `UPDATE t_app_version SET enabled = 0, updated_at = NOW() WHERE platform = ? AND id <> ?`,
    [row.platform, id]
  );
  await query(
    `UPDATE t_app_version SET enabled = 1, status = 'PUBLISHED', updated_at = NOW() WHERE id = ?`,
    [id]
  );

  await auditVersionAction("ROLLBACK_VERSION", `回滚版本：${row.platform} ${row.versionName}`, row, operator, {
    fromVersionCode: current ? Number(current.versionCode) : null,
    toVersionCode: Number(row.versionCode)
  });

  return {
    id,
    platform: row.platform,
    versionCode: Number(row.versionCode),
    versionName: row.versionName,
    enabled: true,
    status: "PUBLISHED"
  };
}
