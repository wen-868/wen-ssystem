import { query, queryOne } from "../../shared/db";
import { planPolicySchema, PLAN_POLICY_KEYS } from "../../schemas/plan.schema";

/**
 * R101-S2-02 组1：套餐策略配置（无结构化列承载的配置项）
 *
 * 背景：组1 的「升级 / 降级 / 续费 / 扩展额度 / 限时活动」在 t_subscription_plan
 * 中没有对应列。按凌舟裁定「口径 X」，不新建业务表，也不复用 features 列
 * （features 为功能特性码数组且被公开端点透出），改为写入既有 KV 表：
 *
 *   t_platform_config
 *     platform   = 'SAAS'
 *     tenant_id  = 'platform'
 *     config_key = 'plan_policy:<planId>'
 *     category   = 'plan'
 *
 * 该约定与 R97-01 平台系统设置（config_key='saas_settings'）同表同模式，
 * 零 DDL、零索引变更（护栏①：平台级复用整包 JSON 行）。
 */

const PLATFORM = "SAAS";
const TENANT_ID = "platform";
const CATEGORY = "plan";

/** 包版本号（当前 1）；结构变更时递增并登记《配置项契约登记表》 */
const SCHEMA_VERSION = 1;

const policyKey = (planId: number): string => `plan_policy:${planId}`;

interface ConfigRow {
  id: number;
  config_value: string | null;
}

/**
 * 读取套餐策略包。
 * 护栏④：库中没有该 key 时返回「全部未配置」而非默认值；
 * _unconfigured / _configured 为只读元字段（_ 前缀），前端据此置灰阻断，且不得回写。
 */
export async function getPlanPolicy(planId: number): Promise<Record<string, unknown>> {
  const key = policyKey(planId);
  const row = await queryOne<ConfigRow>(
    `SELECT id, config_value FROM t_platform_config
      WHERE config_key = ? AND platform = ? LIMIT 1`,
    [key, PLATFORM]
  );
  if (!row) {
    return emptyPolicy();
  }
  try {
    const parsed = JSON.parse(row.config_value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const unconfigured = PLAN_POLICY_KEYS.filter(
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
        _configured: unconfigured.length < PLAN_POLICY_KEYS.length,
      };
    }
  } catch {
    // JSON 解析失败：按「未配置」处理，避免脏数据污染前端表单
  }
  return emptyPolicy();
}

/**
 * 保存套餐策略包（整包 upsert）。
 * 护栏③：落库前经 zod 校验并强制 version，非法结构直接拒绝（400）。
 * 护栏④：null / undefined / _ 前缀元字段一律不落库，
 *        因此「清空全部策略项」= 写入仅含 version 的包，语义等价于未配置。
 */
export async function updatePlanPolicy(
  planId: number,
  payload: Record<string, unknown>,
  operator: string
): Promise<{ updated: boolean }> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null && !key.startsWith("_")) {
      sanitized[key] = value;
    }
  }
  const validated = planPolicySchema.parse({
    ...sanitized,
    version:
      typeof sanitized.version === "number" && sanitized.version > 0
        ? sanitized.version
        : SCHEMA_VERSION,
  });
  const json = JSON.stringify(validated);

  const key = policyKey(planId);
  const existing = await queryOne<ConfigRow>(
    `SELECT id FROM t_platform_config
      WHERE config_key = ? AND platform = ? LIMIT 1`,
    [key, PLATFORM]
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
      [PLATFORM, TENANT_ID, key, json, CATEGORY, `套餐策略配置(planId=${planId})`, operator]
    );
  }

  return { updated: true };
}

function emptyPolicy(): Record<string, unknown> {
  return {
    version: SCHEMA_VERSION,
    _unconfigured: [...PLAN_POLICY_KEYS],
    _configured: false,
  };
}
