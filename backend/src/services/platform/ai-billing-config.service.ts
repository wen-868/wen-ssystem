import { query, queryOne } from "../../shared/db";
import type { ZodType } from "zod";
import {
  billingStrategySchema,
  freeGrantSchema,
  quotaPackSchema,
  pointsRateSchema,
  BILLING_STRATEGY_KEYS,
  FREE_GRANT_KEYS,
  QUOTA_PACK_KEYS,
  POINTS_RATE_KEYS,
} from "../../schemas/ai-billing.schema";

/**
 * R101-S2-02 组3：AI 类配置（AI 计费与积分抵扣配置）
 *
 * 这两组值此前在前端是硬编码业务值（套餐加成倍率 / 免费版赠送额度 / 额度包售价 / 积分汇率 …），
 * 属「禁模拟数据」违规。现按设计稿 v1.6 第 899~1160 行改为平台可配，按凌舟裁定「口径 X」
 * 不新建业务表，落既有 KV：
 *
 *   t_platform_config
 *     platform   = 'SAAS'
 *     tenant_id  = 'platform'
 *     config_key = 'ai:billing_strategy' | 'ai:free_grant' | 'ai:quota_pack' | 'ai:points_rate'
 *     category   = 'ai'
 *
 * 与 R97-01 saas_settings、组1 plan_policy:<planId>、组2 billing:* 同表同约定，零 DDL。
 *
 * 设计稿示例值（1.0x/1.2x/1.1x/1.0x、50 次/月、500000 Token ¥99、1 积分=50 token）仅为示意，
 * 一律不写入代码作为默认值或种子数据（契约第 3 节明文禁止）。
 */

const PLATFORM = "SAAS";
const TENANT_ID = "platform";
const CATEGORY = "ai";

const SCHEMA_VERSION = 1;

const KEY_BILLING_STRATEGY = "ai:billing_strategy";
const KEY_FREE_GRANT = "ai:free_grant";
const KEY_QUOTA_PACK = "ai:quota_pack";
const KEY_POINTS_RATE = "ai:points_rate";

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

/* ── 套餐加成倍率与月额度用尽策略 ── */

export function getBillingStrategy(): Promise<Record<string, unknown>> {
  return readConfig(KEY_BILLING_STRATEGY, BILLING_STRATEGY_KEYS);
}

export function updateBillingStrategy(
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  return writeConfig(
    KEY_BILLING_STRATEGY,
    "AI 套餐加成倍率",
    billingStrategySchema,
    payload,
    operator
  );
}

/* ── 免费版赠送额度 ── */

export function getFreeGrant(): Promise<Record<string, unknown>> {
  return readConfig(KEY_FREE_GRANT, FREE_GRANT_KEYS);
}

export function updateFreeGrant(
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  return writeConfig(
    KEY_FREE_GRANT,
    "AI 免费版赠送额度",
    freeGrantSchema,
    payload,
    operator
  );
}

/* ── 额度包商品 ── */

export function getQuotaPacks(): Promise<Record<string, unknown>> {
  return readConfig(KEY_QUOTA_PACK, QUOTA_PACK_KEYS);
}

export function updateQuotaPacks(
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  return writeConfig(
    KEY_QUOTA_PACK,
    "AI 额度包商品",
    quotaPackSchema,
    payload,
    operator
  );
}

/* ── 积分抵扣汇率 ── */

export function getPointsRate(): Promise<Record<string, unknown>> {
  return readConfig(KEY_POINTS_RATE, POINTS_RATE_KEYS);
}

export function updatePointsRate(
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  return writeConfig(
    KEY_POINTS_RATE,
    "AI 积分抵扣汇率",
    pointsRateSchema,
    payload,
    operator
  );
}
