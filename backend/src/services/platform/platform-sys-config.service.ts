import { query, queryOne } from "../../shared/db";

/**
 * R97-01: 平台系统设置（saas-admin Settings.vue）
 *
 * t_platform_config 的 (platform, store_id, tenant_id) 唯一键约束下，
 * 每个平台只能存一行，因此将整个设置对象序列化为 JSON 存于 config_value：
 *   platform = 'SAAS'，tenant_id = 'platform'，config_key = 'saas_settings'
 * GET 返回对象（缺省字段用默认值补齐），PUT 整包更新。
 */

const CONFIG_KEY = "saas_settings";
const PLATFORM = "SAAS";
const TENANT_ID = "platform";

/** 默认平台设置（与 saas-admin Settings.vue 表单字段一致） */
const DEFAULTS: Record<string, unknown> = {
  platformName: "",
  servicePhone: "",
  serviceEmail: "",
  trialDays: 7,
  defaultPlanId: null,
  taxRate: 0,
  maxUploadSizeMb: 10,
  openRegister: true,
  registerNeedAudit: true,
  registerRequireMobile: true,
  registerRequireLicense: false,
  registerAgreementUrl: "",
  maintenanceMode: false,
  maintenanceTitle: "",
  maintenanceMessage: "",
  maintenanceWhitelist: "",
  announcements: [],
};

interface ConfigRow {
  config_value: string | null;
}

interface ConfigIdRow {
  id: number;
}

/** 读取平台系统设置 */
export async function getSysConfig(): Promise<Record<string, unknown>> {
  const row = await queryOne<ConfigRow>(
    `SELECT config_value FROM t_platform_config
     WHERE config_key = ? AND platform = ? LIMIT 1`,
    [CONFIG_KEY, PLATFORM]
  );
  if (!row) {
    return { ...DEFAULTS };
  }
  try {
    const parsed = JSON.parse(row.config_value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // JSON 解析失败时回退默认值
  }
  return { ...DEFAULTS };
}

/** 保存平台系统设置（整包 JSON upsert） */
export async function updateSysConfig(
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) {
      sanitized[key] = value;
    }
  }
  const json = JSON.stringify(sanitized);

  const existing = await queryOne<ConfigIdRow>(
    `SELECT id FROM t_platform_config
     WHERE config_key = ? AND platform = ? LIMIT 1`,
    [CONFIG_KEY, PLATFORM]
  );

  if (existing) {
    await query(
      `UPDATE t_platform_config
       SET config_value = ?, updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [json, operator, existing.id]
    );
  } else {
    await query(
      `INSERT INTO t_platform_config
       (platform, store_id, enabled, tenant_id, config_key, config_value, category, description, updated_by)
       VALUES (?, NULL, 1, ?, ?, ?, 'saas', '平台系统设置(JSON)', ?)`,
      [PLATFORM, TENANT_ID, CONFIG_KEY, json, operator]
    );
  }

  return { updated: true };
}
