import { query, queryOne } from "../../shared/db";
import type { ZodType } from "zod";
import {
  arrearsPolicySchema,
  addonPriceSchema,
  ARREARS_POLICY_KEYS,
  ADDON_PRICE_KEYS,
} from "../../schemas/billing.schema";

/**
 * R101-S2-02 组2：账单类配置（04 账单计费）
 *
 * 这两组值此前在前端是硬编码业务值（宽限 15 天 / 保留 90 天 / ¥10/GB·月 …），
 * 属「禁模拟数据」违规。现按设计稿 v1.6 第 809 行改为「4 段边界（绝对截止天数 15/30/60/90）」
 * 可配，按凌舟裁定「口径 X」不新建业务表，落既有 KV：
 *
 *   t_platform_config
 *     platform   = 'SAAS'
 *     tenant_id  = 'platform'
 *     config_key = 'billing:arrears_policy' | 'billing:addon_price'
 *     category   = 'billing'
 *
 * 与 R97-01 saas_settings、组1 plan_policy:<planId> 同表同约定，零 DDL。
 */

const PLATFORM = "SAAS";
const TENANT_ID = "platform";
const CATEGORY = "billing";

const SCHEMA_VERSION = 1;

const KEY_ARREARS = "billing:arrears_policy";
const KEY_ADDON = "billing:addon_price";

interface ConfigRow {
  id: number;
  config_value: string | null;
}

/**
 * 读取配置包。
 * 护栏④：库中无该 key 时返回「全部未配置」而非默认值；
 * _unconfigured / _configured 为只读元字段（_ 前缀），前端据此置灰阻断，且不得回写。
 */
async function readConfig(
  configKey: string,
  keys: readonly string[]
): Promise<Record<string, unknown>> {
  const row = await queryOne<ConfigRow>(
    `SELECT id, config_value FROM t_platform_config
      WHERE config_key = ? AND platform = ? LIMIT 1`,
    [configKey, PLATFORM]
  );
  if (!row) return emptyPackage(keys);
  try {
    const parsed = JSON.parse(row.config_value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const unconfigured = keys.filter(
        (k) => !Object.prototype.hasOwnProperty.call(parsed, k)
      );
      const version =
        typeof parsed.version === "number" && parsed.version > 0
          ? parsed.version
          : SCHEMA_VERSION;
      return {
        ...parsed,
        version,
        _unconfigured: unconfigured,
        _configured: unconfigured.length < keys.length,
      };
    }
  } catch {
    // JSON 解析失败：按「未配置」处理，避免脏数据污染前端表单
  }
  return emptyPackage(keys);
}

/**
 * 保存配置包（整包 upsert）。
 * 护栏③：落库前经 zod 校验并强制 version，非法结构直接拒绝（400）。
 * 护栏④：null / undefined / _ 前缀元字段一律不落库，
 *        因此「清空全部项」= 写入仅含 version 的包，语义等价于未配置。
 */
async function writeConfig(
  configKey: string,
  description: string,
  schema: ZodType,
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null && !key.startsWith("_")) {
      sanitized[key] = value;
    }
  }
  const validated = schema.parse({
    ...sanitized,
    version:
      typeof sanitized.version === "number" && sanitized.version > 0
        ? sanitized.version
        : SCHEMA_VERSION,
  });
  const json = JSON.stringify(validated);

  const existing = await queryOne<ConfigRow>(
    `SELECT id FROM t_platform_config
      WHERE config_key = ? AND platform = ? LIMIT 1`,
    [configKey, PLATFORM]
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
       VALUES (?, NULL, 1, ?, ?, ?, ?, ?, ?)`,
      [PLATFORM, TENANT_ID, configKey, json, CATEGORY, description, operator]
    );
  }
  return { updated: true };
}

function emptyPackage(keys: readonly string[]): Record<string, unknown> {
  return {
    version: SCHEMA_VERSION,
    _unconfigured: [...keys],
    _configured: false,
  };
}

/* ── 欠费处理策略（全局） ── */

export function getArrearsPolicy(): Promise<Record<string, unknown>> {
  return readConfig(KEY_ARREARS, ARREARS_POLICY_KEYS);
}

export function updateArrearsPolicy(
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  return writeConfig(
    KEY_ARREARS,
    "欠费处理策略(全局)",
    arrearsPolicySchema,
    payload,
    operator
  );
}

/* ── 增值服务单价 ── */

export function getAddonPrice(): Promise<Record<string, unknown>> {
  return readConfig(KEY_ADDON, ADDON_PRICE_KEYS);
}

export function updateAddonPrice(
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  return writeConfig(KEY_ADDON, "增值服务单价", addonPriceSchema, payload, operator);
}
