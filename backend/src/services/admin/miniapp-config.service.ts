import { queryWithTenant, queryOneWithTenant, executeWithTenant } from "../../shared/db";
import { MiniappPackageService } from "./miniapp-package.service";

/** t_miniapp_config 配置行 */
interface MiniappConfigRow {
  id: number | string;
  platform: string;
  app_id: string | null;
  app_secret: string | null;
  app_name: string | null;
  app_version: string | null;
  template_id: number | string | null;
  status: string;
  audit_status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  tenant_id: string;
  created_at: string | Date;
  updated_at: string | Date | null;
}

/** 小程序配置保存输入（与表字段一致，不再使用不存在的 enabled 列） */
interface MiniappConfigInput {
  appId?: string;
  appSecret?: string;
  appName?: string;
  appVersion?: string;
  templateId?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** 配置行 → 前端驼峰结构（app_secret 脱敏） */
function toConfigView(row: MiniappConfigRow) {
  return {
    id: row.id,
    platform: row.platform,
    appId: row.app_id || "",
    appSecret: row.app_secret ? "***" : "",
    appName: row.app_name || "",
    appVersion: row.app_version || "",
    templateId: row.template_id,
    status: row.status,
    auditStatus: row.audit_status,
    contactName: row.contact_name || "",
    contactEmail: row.contact_email || "",
    contactPhone: row.contact_phone || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 模板行（含 style_config/page_config 解析） */
interface TemplateRow {
  id: number | string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  preview_urls: string | null;
  style_config: string | null;
  page_config: string | null;
  version: string;
  status: string;
  sort_order: number | string;
}

function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === "object") return val as T;
  try {
    return JSON.parse(val as string) as T;
  } catch {
    return fallback;
  }
}

function toTemplateView(row: TemplateRow) {
  const styleConfig = safeJsonParse<Record<string, unknown>>(row.style_config, {});
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnail: row.thumbnail,
    previewUrls: safeJsonParse<unknown[]>(row.preview_urls, []),
    styleConfig,
    pageConfig: safeJsonParse<Record<string, unknown>>(row.page_config, {}),
    theme: styleConfig.theme || "a",
    version: row.version,
    status: row.status,
    sortOrder: row.sort_order,
  };
}

export class MiniappConfigService {
  // 所有平台配置列表
  static async listConfigs(tenantId: string) {
    const rows = await queryWithTenant<MiniappConfigRow>(
      `SELECT * FROM t_miniapp_config WHERE tenant_id = ? ORDER BY platform`,
      [tenantId],
      tenantId
    );
    return rows.map(toConfigView);
  }

  // 获取指定平台配置
  static async getConfig(tenantId: string, platform: string) {
    const row = await queryOneWithTenant<MiniappConfigRow>(
      `SELECT * FROM t_miniapp_config WHERE platform = ? AND tenant_id = ?`,
      [platform, tenantId],
      tenantId
    );
    return row ? toConfigView(row) : null;
  }

  // 保存指定平台配置（app_secret 传 *** 时保留原值）
  static async saveConfig(tenantId: string, platform: string, data: MiniappConfigInput) {
    const existing = await queryOneWithTenant<MiniappConfigRow>(
      `SELECT id, app_secret FROM t_miniapp_config WHERE platform = ? AND tenant_id = ?`,
      [platform, tenantId],
      tenantId
    );

    const appSecret =
      data.appSecret && data.appSecret !== "***"
        ? data.appSecret
        : (existing?.app_secret ?? "");

    if (existing) {
      await executeWithTenant(
        `UPDATE t_miniapp_config SET
           app_id = ?, app_secret = ?, app_name = ?, app_version = ?,
           template_id = ?, contact_name = ?, contact_email = ?, contact_phone = ?,
           status = 'draft', updated_at = NOW()
         WHERE platform = ? AND tenant_id = ?`,
        [
          data.appId || "",
          appSecret,
          data.appName || "",
          data.appVersion || "",
          data.templateId ?? null,
          data.contactName || "",
          data.contactEmail || "",
          data.contactPhone || "",
          platform,
          tenantId,
        ],
        tenantId
      );
    } else {
      await executeWithTenant(
        `INSERT INTO t_miniapp_config
           (platform, app_id, app_secret, app_name, app_version, template_id,
            contact_name, contact_email, contact_phone, status, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [
          platform,
          data.appId || "",
          appSecret,
          data.appName || "",
          data.appVersion || "",
          data.templateId ?? null,
          data.contactName || "",
          data.contactEmail || "",
          data.contactPhone || "",
          tenantId,
        ],
        tenantId
      );
    }
    return { success: true };
  }

  // 模板列表（仅 active：DEFAULT 全局模板 + 本租户模板）
  static async listTemplates(tenantId: string) {
    const rows = await queryWithTenant<TemplateRow>(
      `SELECT * FROM t_miniapp_template
       WHERE (tenant_id = ? OR tenant_id = 'DEFAULT') AND status = 'active'
       ORDER BY sort_order ASC, id ASC`,
      [tenantId],
      tenantId
    );
    return rows.map(toTemplateView);
  }

  // 模板详情
  static async getTemplate(tenantId: string, id: number) {
    const row = await queryOneWithTenant<TemplateRow>(
      `SELECT * FROM t_miniapp_template
       WHERE id = ? AND (tenant_id = ? OR tenant_id = 'DEFAULT')`,
      [id, tenantId],
      tenantId
    );
    return row ? toTemplateView(row) : null;
  }

  // 发布历史
  static async listPublishLogs(tenantId: string, page: number = 1, pageSize: number = 20) {
    const offset = (page - 1) * pageSize;
    const rows = await queryWithTenant(
      `SELECT * FROM t_miniapp_publish_log WHERE tenant_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [tenantId, pageSize, offset],
      tenantId
    );
    const total = await queryOneWithTenant(
      `SELECT COUNT(*) as total FROM t_miniapp_publish_log WHERE tenant_id = ?`,
      [tenantId],
      tenantId
    );
    return { list: rows, total: (total as unknown as Record<string, unknown>)?.total || 0, page, pageSize };
  }

  // 生成代码包（委派 MiniappPackageService）
  static async generatePackage(tenantId: string, input: {
    platform: string;
    templateId: number;
    appId?: string;
    appName?: string;
    version?: string;
  }) {
    return MiniappPackageService.generate(tenantId, input);
  }

  // 代码包下载文件
  static async getPackageFile(tenantId: string, id: number) {
    return MiniappPackageService.getPackageFile(tenantId, id);
  }
}
