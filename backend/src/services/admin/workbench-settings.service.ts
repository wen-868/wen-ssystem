import { AppError } from "../../shared/app-error";
import { connExecute, connQueryOne, transaction } from "../../shared/db";
import type mysql from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export type WorkbenchSettingsScope = "tenant" | "user";
export type WorkbenchSettingValue = string | number | boolean | null;
export type WorkbenchSettingsValues = Record<string, WorkbenchSettingValue>;

export interface WorkbenchSettingsSnapshot {
  version: number;
  revision: number;
  updatedAt: string | null;
  values: WorkbenchSettingsValues;
}

export interface WorkbenchSettingsActor {
  userId: number;
  userName: string;
  role: string;
  ip: string;
  userAgent: string;
}

interface ConfigRow extends RowDataPacket {
  configValue: string;
}

const CONFIG_GROUP = "workbench_settings";
const CONFIG_PREFIX = "workbench.settings";
const SETTINGS_VERSION = 1;
const MAX_KEYS = 500;
const MAX_KEY_LENGTH = 96;
const MAX_STRING_LENGTH = 4096;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SENSITIVE_KEY = /(password|passwd|secret|token|credential|private[_-]?key|api[_-]?key)/i;
const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

export const WORKBENCH_SETTINGS_DEFAULTS: Readonly<WorkbenchSettingsValues> = Object.freeze({
  "ui.density": "standard",
  "ui.reduceMotion": false,
  "ui.taskCenter.open": true,
});

function configKey(scope: WorkbenchSettingsScope, userId: number): string {
  return scope === "tenant" ? `${CONFIG_PREFIX}.tenant` : `${CONFIG_PREFIX}.user.${userId}`;
}

function auditResourceId(scope: WorkbenchSettingsScope, userId: number): string {
  return scope === "tenant" ? "tenant" : `user:${userId}`;
}

function assertKey(key: string): void {
  if (
    !key ||
    key.length > MAX_KEY_LENGTH ||
    FORBIDDEN_KEYS.has(key) ||
    !KEY_PATTERN.test(key) ||
    SENSITIVE_KEY.test(key)
  ) {
    throw new AppError(`非法设置键：${key || "(空)"}`, 400);
  }
}

function assertValue(value: unknown): asserts value is WorkbenchSettingValue {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "string" && value.length <= MAX_STRING_LENGTH) return;
  throw new AppError("设置值只允许有限数字、布尔、字符串或 null", 400);
}

export function validateSettingsPatch(input: unknown): WorkbenchSettingsValues {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError("settings 必须是键值对象", 400);
  }
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) throw new AppError("settings 不能为空", 400);
  if (entries.length > MAX_KEYS) throw new AppError(`单次最多保存 ${MAX_KEYS} 项设置`, 400);

  const values: WorkbenchSettingsValues = {};
  for (const [key, value] of entries) {
    assertKey(key);
    assertValue(value);
    values[key] = value;
  }
  return values;
}

function validateResetKeys(keys: unknown): string[] | null {
  if (keys === undefined || keys === null) return null;
  if (!Array.isArray(keys)) throw new AppError("keys 必须是字符串数组", 400);
  if (keys.length > MAX_KEYS) throw new AppError(`单次最多重置 ${MAX_KEYS} 项设置`, 400);
  const unique = Array.from(new Set(keys.map(String)));
  unique.forEach(assertKey);
  return unique;
}

function defaults(): WorkbenchSettingsValues {
  return { ...WORKBENCH_SETTINGS_DEFAULTS };
}

function parseSnapshot(raw: string | null | undefined): WorkbenchSettingsSnapshot {
  if (!raw) {
    return { version: SETTINGS_VERSION, revision: 0, updatedAt: null, values: defaults() };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError("设置数据损坏，拒绝覆盖", 500);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("设置数据格式非法，拒绝覆盖", 500);
  }
  const record = parsed as Record<string, unknown>;
  const values: WorkbenchSettingsValues = defaults();
  const rawValues = record.values;
  if (rawValues && typeof rawValues === "object" && !Array.isArray(rawValues)) {
    for (const [key, value] of Object.entries(rawValues as Record<string, unknown>)) {
      try {
        assertKey(key);
        assertValue(value);
        values[key] = value;
      } catch {
        throw new AppError("设置数据包含非法键值，拒绝覆盖", 500);
      }
    }
  }
  return {
    version: Number(record.version) || SETTINGS_VERSION,
    revision: Number.isInteger(record.revision) && Number(record.revision) >= 0 ? Number(record.revision) : 0,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    values,
  };
}

function buildSnapshot(values: WorkbenchSettingsValues, revision: number): WorkbenchSettingsSnapshot {
  return {
    version: SETTINGS_VERSION,
    revision,
    updatedAt: new Date().toISOString(),
    values,
  };
}

async function readConfig(conn: mysql.PoolConnection, tenantId: string, key: string) {
  return connQueryOne<ConfigRow & { [key: string]: unknown }>(
    conn,
    `SELECT config_value AS configValue
       FROM t_sys_config
      WHERE config_key = ? AND tenant_id = ?
      LIMIT 1`,
    [key, tenantId],
  );
}

async function upsertConfig(
  conn: mysql.PoolConnection,
  tenantId: string,
  key: string,
  snapshot: WorkbenchSettingsSnapshot,
) {
  await connExecute<ResultSetHeader>(
    conn,
    `INSERT INTO t_sys_config (config_key, config_value, config_group, description, tenant_id)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       config_value = VALUES(config_value),
       config_group = VALUES(config_group),
       description = VALUES(description),
       updated_at = CURRENT_TIMESTAMP`,
    [key, JSON.stringify(snapshot), CONFIG_GROUP, "工作台设置中心服务端配置", tenantId],
  );
}

async function insertAudit(
  conn: mysql.PoolConnection,
  params: {
    action: "WORKBENCH_SETTINGS_SAVE" | "WORKBENCH_SETTINGS_RESET";
    scope: WorkbenchSettingsScope;
    actor: WorkbenchSettingsActor;
    tenantId: string;
    keys: string[];
    revision: number;
    baseRevision?: number | null;
  },
) {
  const detail = JSON.stringify({
    scope: params.scope,
    keys: params.keys,
    revision: params.revision,
    baseRevision: params.baseRevision ?? null,
    result: "SUCCESS",
  });
  const [insertResult] = await connExecute<ResultSetHeader>(
    conn,
    `INSERT INTO t_audit_log
      (user_id, user_name, role, action, resource_type, resource_id, detail, ip, user_agent, tenant_id)
     VALUES (?, ?, ?, ?, 'workbench_settings', ?, ?, ?, ?, ?)`,
    [
      params.actor.userId,
      params.actor.userName,
      params.actor.role,
      params.action,
      auditResourceId(params.scope, params.actor.userId),
      detail,
      params.actor.ip,
      params.actor.userAgent,
      params.tenantId,
    ],
  );
  return Number(insertResult.insertId || 0);
}

export async function getWorkbenchSettings(params: {
  scope: WorkbenchSettingsScope;
  tenantId: string;
  userId: number;
}): Promise<WorkbenchSettingsSnapshot> {
  const row = await connReadOnly(params.tenantId, configKey(params.scope, params.userId));
  return parseSnapshot(row?.configValue);
}

async function connReadOnly(tenantId: string, key: string) {
  // Reuse one transaction-bound read helper so mock tests and production stay symmetrical.
  return transaction((conn) => readConfig(conn, tenantId, key));
}
void connReadOnly;

export async function saveWorkbenchSettings(params: {
  scope: WorkbenchSettingsScope;
  tenantId: string;
  userId: number;
  settings: unknown;
  baseRevision?: number | null;
  actor: WorkbenchSettingsActor;
}) {
  const patch = validateSettingsPatch(params.settings);
  const key = configKey(params.scope, params.userId);
  return transaction(async (conn) => {
    const current = parseSnapshot((await readConfig(conn, params.tenantId, key))?.configValue);
    if (params.baseRevision != null && params.baseRevision !== current.revision) {
      throw new AppError("设置已在其他窗口更新，请刷新后重试", 409);
    }
    const snapshot = buildSnapshot({ ...current.values, ...patch }, current.revision + 1);
    await upsertConfig(conn, params.tenantId, key, snapshot);
    const auditLogId = await insertAudit(conn, {
      action: "WORKBENCH_SETTINGS_SAVE",
      scope: params.scope,
      actor: params.actor,
      tenantId: params.tenantId,
      keys: Object.keys(patch),
      revision: snapshot.revision,
      baseRevision: params.baseRevision,
    });
    return { ...snapshot, changedKeys: Object.keys(patch), auditLogId };
  });
}

export async function resetWorkbenchSettings(params: {
  scope: WorkbenchSettingsScope;
  tenantId: string;
  userId: number;
  keys?: unknown;
  baseRevision?: number | null;
  actor: WorkbenchSettingsActor;
}) {
  const resetKeys = validateResetKeys(params.keys);
  const key = configKey(params.scope, params.userId);
  return transaction(async (conn) => {
    const current = parseSnapshot((await readConfig(conn, params.tenantId, key))?.configValue);
    if (params.baseRevision != null && params.baseRevision !== current.revision) {
      throw new AppError("设置已在其他窗口更新，请刷新后重试", 409);
    }
    const values = { ...current.values };
    const effectiveKeys = resetKeys ?? Array.from(new Set([...Object.keys(values), ...Object.keys(WORKBENCH_SETTINGS_DEFAULTS)]));
    for (const settingKey of effectiveKeys) {
      if (settingKey in WORKBENCH_SETTINGS_DEFAULTS) values[settingKey] = WORKBENCH_SETTINGS_DEFAULTS[settingKey];
      else delete values[settingKey];
    }
    const snapshot = buildSnapshot(values, current.revision + 1);
    await upsertConfig(conn, params.tenantId, key, snapshot);
    const auditLogId = await insertAudit(conn, {
      action: "WORKBENCH_SETTINGS_RESET",
      scope: params.scope,
      actor: params.actor,
      tenantId: params.tenantId,
      keys: effectiveKeys,
      revision: snapshot.revision,
      baseRevision: params.baseRevision,
    });
    return { ...snapshot, resetKeys: effectiveKeys, auditLogId };
  });
}
