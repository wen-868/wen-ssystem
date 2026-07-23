import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

// ========== 类型定义 ==========

/** 追溯配置列表行 */
interface TraceConfigListRow {
  id: number;
  configNo: string;
  configLevel: string;
  targetId: number | string;
  targetName: string;
  traceEnabled: number | string;
  forceEnabled: number | string;
  codeMode: string;
  codePrefix: string;
  autoGenerate: number | string;
  shelfLifeDays: number | string;
  remark: string | null;
  status: number | string;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

/** 追溯配置创建后行 */
interface TraceConfigCreatedRow {
  id: number;
  configNo: string;
  configLevel: string;
  targetId: number | string;
  targetName: string;
  traceEnabled: number | string;
  forceEnabled: number | string;
  codeMode: string;
  codePrefix: string;
  autoGenerate: number | string;
  shelfLifeDays: number | string;
  remark: string | null;
  status: number | string;
  createdAt: string | Date;
}

/** 追溯配置更新后行 */
interface TraceConfigUpdatedRow {
  id: number;
  configNo: string;
  configLevel: string;
  targetId: number | string;
  targetName: string;
  traceEnabled: number | string;
  forceEnabled: number | string;
  codeMode: string;
  codePrefix: string;
  autoGenerate: number | string;
  shelfLifeDays: number | string;
  remark: string | null;
  status: number | string;
  updatedAt: string | Date;
}

/** 追溯配置 ID 行 */
interface TraceConfigIdRow {
  id: number;
}

/** 追溯配置检查行 */
interface TraceConfigCheckRow {
  id: number;
  configNo: string;
  traceEnabled: number | string;
  forceEnabled: number | string;
  codeMode: string;
  codePrefix: string;
  shelfLifeDays: number | string;
}

/** COUNT(*) AS total 行 */
interface CountTotalRow {
  total: number;
}

export async function listConfigs(
  page: number,
  pageSize: number,
  configLevel: string | undefined,
  traceEnabled: number | undefined,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tc.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (configLevel) {
    conditions.push("tc.config_level = ?");
    params.push(configLevel);
  }
  if (traceEnabled !== undefined) {
    conditions.push("tc.trace_enabled = ?");
    params.push(traceEnabled);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<TraceConfigListRow>(
    `SELECT tc.id, tc.config_no AS configNo, tc.config_level AS configLevel,
            tc.target_id AS targetId, tc.target_name AS targetName,
            tc.trace_enabled AS traceEnabled, tc.force_enabled AS forceEnabled,
            tc.code_mode AS codeMode, tc.code_prefix AS codePrefix,
            tc.auto_generate AS autoGenerate, tc.shelf_life_days AS shelfLifeDays,
            tc.remark, tc.status,
            tc.created_at AS createdAt, tc.updated_at AS updatedAt
     FROM t_trace_config tc
     ${where}
     ORDER BY tc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_trace_config tc ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function createConfig(body: {
  configLevel: "CATEGORY" | "SKU" | "GLOBAL";
  targetId: number;
  targetName: string;
  traceEnabled: number;
  forceEnabled: number;
  codeMode: "ONE_PER_ITEM" | "ONE_PER_BATCH" | "BATCH_ONLY";
  codePrefix: string;
  autoGenerate: number;
  shelfLifeDays: number;
  remark: string;
}, tenantId: string) {
  const configNo = makeBizNo("TC");

  await queryWithTenant(
    `INSERT INTO t_trace_config (config_no, config_level, target_id, target_name,
       trace_enabled, force_enabled, code_mode, code_prefix, auto_generate,
       shelf_life_days, remark, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [configNo, body.configLevel, body.targetId, body.targetName,
      body.traceEnabled, body.forceEnabled, body.codeMode, body.codePrefix,
      body.autoGenerate, body.shelfLifeDays, body.remark, tenantId],
    tenantId
  );

  const record = await queryOneWithTenant<TraceConfigCreatedRow>(
    `SELECT id, config_no AS configNo, config_level AS configLevel,
            target_id AS targetId, target_name AS targetName,
            trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
            code_mode AS codeMode, code_prefix AS codePrefix,
            auto_generate AS autoGenerate, shelf_life_days AS shelfLifeDays,
            remark, status, created_at AS createdAt
     FROM t_trace_config WHERE config_no = ? AND tenant_id = ?`,
    [configNo, tenantId],
    tenantId
  );

  return record;
}

export async function updateConfig(
  configId: number,
  body: {
    targetName?: string;
    traceEnabled?: number;
    forceEnabled?: number;
    codeMode?: "ONE_PER_ITEM" | "ONE_PER_BATCH" | "BATCH_ONLY";
    codePrefix?: string;
    autoGenerate?: number;
    shelfLifeDays?: number;
    remark?: string;
    status?: number;
  },
  tenantId: string
) {
  const existing = await queryOneWithTenant<TraceConfigIdRow>(
    "SELECT id FROM t_trace_config WHERE id = ? AND tenant_id = ?",
    [configId, tenantId],
    tenantId
  );
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.targetName !== undefined) { updates.push("target_name = ?"); params.push(body.targetName); }
  if (body.traceEnabled !== undefined) { updates.push("trace_enabled = ?"); params.push(body.traceEnabled); }
  if (body.forceEnabled !== undefined) { updates.push("force_enabled = ?"); params.push(body.forceEnabled); }
  if (body.codeMode !== undefined) { updates.push("code_mode = ?"); params.push(body.codeMode); }
  if (body.codePrefix !== undefined) { updates.push("code_prefix = ?"); params.push(body.codePrefix); }
  if (body.autoGenerate !== undefined) { updates.push("auto_generate = ?"); params.push(body.autoGenerate); }
  if (body.shelfLifeDays !== undefined) { updates.push("shelf_life_days = ?"); params.push(body.shelfLifeDays); }
  if (body.remark !== undefined) { updates.push("remark = ?"); params.push(body.remark); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }

  if (updates.length > 0) {
    await queryWithTenant(
      `UPDATE t_trace_config SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      [...params, configId, tenantId],
      tenantId
    );
  }

  const record = await queryOneWithTenant<TraceConfigUpdatedRow>(
    `SELECT id, config_no AS configNo, config_level AS configLevel,
            target_id AS targetId, target_name AS targetName,
            trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
            code_mode AS codeMode, code_prefix AS codePrefix,
            auto_generate AS autoGenerate, shelf_life_days AS shelfLifeDays,
            remark, status, updated_at AS updatedAt
     FROM t_trace_config WHERE id = ? AND tenant_id = ?`,
    [configId, tenantId],
    tenantId
  );

  return record;
}

export async function deleteConfig(configId: number, tenantId: string) {
  const existing = await queryOneWithTenant<TraceConfigIdRow>(
    "SELECT id FROM t_trace_config WHERE id = ? AND tenant_id = ?",
    [configId, tenantId],
    tenantId
  );
  if (!existing) {
    return false;
  }

  await queryWithTenant(
    "DELETE FROM t_trace_config WHERE id = ? AND tenant_id = ?",
    [configId, tenantId],
    tenantId
  );

  return true;
}

export async function checkSkuTrace(
  skuId: number,
  categoryId: number | undefined,
  tenantId: string
) {
  const skuConfig = await queryOneWithTenant<TraceConfigCheckRow>(
    `SELECT id, config_no AS configNo, trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
            code_mode AS codeMode, code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM t_trace_config WHERE config_level = 'SKU' AND target_id = ? AND status = 1 AND tenant_id = ?`,
    [skuId, tenantId],
    tenantId
  );

  if (skuConfig) {
    return {
      required: skuConfig.traceEnabled === 1 || skuConfig.forceEnabled === 1,
      config: skuConfig
    };
  }

  if (categoryId) {
    const categoryConfig = await queryOneWithTenant<TraceConfigCheckRow>(
      `SELECT id, config_no AS configNo, trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
              code_mode AS codeMode, code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
       FROM t_trace_config WHERE config_level = 'CATEGORY' AND target_id = ? AND status = 1 AND tenant_id = ?`,
      [categoryId, tenantId],
      tenantId
    );

    if (categoryConfig) {
      return {
        required: categoryConfig.traceEnabled === 1 || categoryConfig.forceEnabled === 1,
        config: categoryConfig
      };
    }
  }

  const globalConfig = await queryOneWithTenant<TraceConfigCheckRow>(
    `SELECT id, config_no AS configNo, trace_enabled AS traceEnabled, force_enabled AS forceEnabled,
            code_mode AS codeMode, code_prefix AS codePrefix, shelf_life_days AS shelfLifeDays
     FROM t_trace_config WHERE config_level = 'GLOBAL' AND status = 1 AND tenant_id = ? LIMIT 1`,
    [tenantId],
    tenantId
  );

  if (globalConfig) {
    return {
      required: globalConfig.traceEnabled === 1 || globalConfig.forceEnabled === 1,
      config: globalConfig
    };
  }

  return { required: false, config: null };
}
