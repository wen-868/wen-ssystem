import { z } from "zod";
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
  // 全局功能开关 / 第三方通道：无内建默认值。未配置即 null，
  // 前端据此置灰阻断并提示「未配置」，禁止用默认值冒充「已生效配置」
  // （凌舟裁定 R101-S2-02 护栏④：系统不内置固定预设值）。
  switches: null,
  channels: null,
};

interface ConfigRow {
  config_value: string | null;
}

/**
 * 护栏③（凌舟裁定 R101-S2-02）：配置 JSON 包须带 zod schema + version。
 * 仅对「已知分组」做形状校验（switches 的每项 / channels 的对象形状），
 * 其余平台字段 passthrough 透传，避免升级期历史数据被拒。
 * 注意：newTenantDefault 不设默认值 —— 键不存在 = 「未配置」，与 false「已配置为关闭」语义不同（护栏④）。
 */
const switchItemSchema = z
  .object({
    enabled: z.boolean(),
    newTenantDefault: z.boolean().optional(),
    countLabel: z.string().optional(),
  })
  .passthrough();

export const sysConfigSchema = z
  .object({
    version: z.number().int().positive().default(1),
    switches: z.record(switchItemSchema).nullable().optional(),
    channels: z.record(z.any()).nullable().optional(),
  })
  .passthrough();

/** 包版本号（当前 1）；结构变更时递增并登记《配置项契约登记表》 */
const SCHEMA_VERSION = 1;

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
    return { ...DEFAULTS, version: SCHEMA_VERSION, _unconfigured: Object.keys(DEFAULTS) };
  }
  try {
    const parsed = JSON.parse(row.config_value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // 护栏④：DEFAULTS 仅作表单初值/空态展示；_unconfigured 列出「库中无该键」的字段，
      // 供前端区分「未配置（置灰阻断）」与「已配置为某值」，且该键不得回写。
      const unconfigured = Object.keys(DEFAULTS).filter(
        (k) => !Object.prototype.hasOwnProperty.call(parsed, k)
      );
      // 护栏③：version 恒在响应中（历史包无 version 时按 1 呈现）
      const version = typeof parsed.version === "number" && parsed.version > 0 ? parsed.version : SCHEMA_VERSION;
      return { ...DEFAULTS, ...parsed, version, _unconfigured: unconfigured };
    }
  } catch {
    // JSON 解析失败时回退默认值
  }
  return { ...DEFAULTS, version: SCHEMA_VERSION, _unconfigured: Object.keys(DEFAULTS) };
}

/** 保存平台系统设置（整包 JSON upsert） */
export async function updateSysConfig(
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    // 护栏④：以 _ 开头的元字段（如 _unconfigured）为只读注解，禁止回写；
    // null 表示「未配置」，同样不落库（避免把「未配置」固化成空值）。
    if (value !== undefined && value !== null && !key.startsWith("_")) {
      sanitized[key] = value;
    }
  }
  // 护栏③：zod 校验配置包结构并强制 version；非法结构直接拒绝，避免脏配置落库。
  const validated = sysConfigSchema.parse({
    ...sanitized,
    version:
      typeof sanitized.version === "number" && sanitized.version > 0
        ? sanitized.version
        : SCHEMA_VERSION,
  });
  const json = JSON.stringify(validated);

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
