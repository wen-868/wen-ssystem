/**
 * R101-C6-3-1：平台全局功能开关（t_platform_feature_switch）
 *
 * 依据：docs/tasks/cards/R101-派单-20260927-C6-3-1.md 交付物 A①②、验收标准③
 *       + docs/migrations/184_平台功能开关.sql（表结构与分层口径的唯一真相源）
 *
 * 口径（与卡 §二 逐条对齐，不得混用）：
 * - 本域＝平台**能不能开**（平台级，一个 feature_code 一行）；default_for_new_tenant 决定新租户初始化默认值；
 * - 套餐矩阵（这个租户**有没有**）仍由既有 t_subscription_plan.features / module_access 表达，**本服务不读写它**；
 * - 本服务**不新增任何运行时拦截逻辑**（没有调用方就不接，避免假门禁）；
 * - 平台级表（**无 tenant_id**）：用 query()/queryOne()，不走 queryWithTenant；
 * - 零假数据：列表来自真实查询，空表 ⇒ items: []（前端显式渲染"尚未登记功能开关"，不得内置假清单）；
 * - 不写 t_platform_config 任何键值行（R8：该表是即时零售凭据表）。
 *
 * 两条写侧护栏（卡 §三A② 硬口径）：
 * - 未知 code ⇒ AppError 404（不静默成功、不自动建行）；
 * - 无变更 ⇒ AppError 400（"提交内容与当前配置一致"，明确失败而不是 200 空操作）。
 */
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";

/** 功能开关列表行（驼峰别名来自 SQL，供前端逐字消费） */
interface FeatureSwitchRow {
  featureCode: string;
  featureName: string;
  enabled: number | boolean;
  defaultForNewTenant: number | boolean;
  remark: string | null;
}

export interface FeatureSwitchItem {
  featureCode: string;
  featureName: string;
  enabled: boolean;
  defaultForNewTenant: boolean;
  remark: string | null;
}

export interface FeatureSwitchUpdateInput {
  enabled?: boolean;
  defaultForNewTenant?: boolean;
  remark?: string | null;
}

const SELECT_COLUMNS = `feature_code AS featureCode, feature_name AS featureName,
            enabled, default_for_new_tenant AS defaultForNewTenant, remark`;

function toItem(row: FeatureSwitchRow): FeatureSwitchItem {
  return {
    featureCode: row.featureCode,
    featureName: row.featureName,
    enabled: Boolean(row.enabled),
    defaultForNewTenant: Boolean(row.defaultForNewTenant),
    remark: row.remark ?? null,
  };
}

/**
 * GET /api/platform/config/feature-switches
 * 空表 ⇒ { items: [] }（诚实空态，代码侧不预置任何功能编码清单）
 */
export async function listFeatureSwitches(): Promise<{ items: FeatureSwitchItem[] }> {
  const rows = await query<FeatureSwitchRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM t_platform_feature_switch
      ORDER BY feature_code ASC`
  );
  return { items: rows.map(toItem) };
}

/**
 * PUT /api/platform/config/feature-switches/:code
 *
 * 只改传了的字段（未传即不动），返回真正落库的字段名数组。
 * · 未知 code ⇒ 404（不 upsert）
 * · 三个字段都没传 / 传了但与当前值完全相同 ⇒ 400（不得静默成功）
 */
export async function updateFeatureSwitch(
  featureCode: string,
  input: FeatureSwitchUpdateInput,
  operatorId?: number | null
): Promise<{ featureCode: string; changedFields: string[] }> {
  const existing = await queryOne<FeatureSwitchRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM t_platform_feature_switch
      WHERE feature_code = ?`,
    [featureCode]
  );

  if (!existing) {
    throw new AppError(`功能开关不存在：${featureCode}`, 404);
  }

  const assignments: string[] = [];
  const params: unknown[] = [];
  const changedFields: string[] = [];

  if (input.enabled !== undefined && Boolean(existing.enabled) !== input.enabled) {
    assignments.push("enabled = ?");
    params.push(input.enabled ? 1 : 0);
    changedFields.push("enabled");
  }

  if (
    input.defaultForNewTenant !== undefined &&
    Boolean(existing.defaultForNewTenant) !== input.defaultForNewTenant
  ) {
    assignments.push("default_for_new_tenant = ?");
    params.push(input.defaultForNewTenant ? 1 : 0);
    changedFields.push("defaultForNewTenant");
  }

  if (input.remark !== undefined) {
    // 归一：空白串（含 "" 与纯空格）视为"未填写" ⇒ 落 NULL，不用空串冒充未填写（与 184 迁移注释同口径）
    const trimmed = input.remark === null ? "" : String(input.remark).trim();
    const nextRemark = trimmed === "" ? null : trimmed;
    const currentRemark = existing.remark ?? null;
    if (currentRemark !== nextRemark) {
      assignments.push("remark = ?");
      params.push(nextRemark);
      changedFields.push("remark");
    }
  }

  if (changedFields.length === 0) {
    throw new AppError("提交内容与当前配置一致，无字段变更", 400);
  }

  assignments.push("updated_by = ?");
  params.push(operatorId ?? null);

  await query(
    `UPDATE t_platform_feature_switch
        SET ${assignments.join(", ")}
      WHERE feature_code = ?`,
    [...params, featureCode]
  );

  return { featureCode, changedFields };
}
