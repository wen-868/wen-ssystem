/**
 * 开放平台 API 密钥服务（R101-C3-1）
 *
 * 依据：`docs/tasks/cards/R101-C3-0-凌舟裁定.md` §二（7 项裁定）+ §三（实现形态）
 *      派单卡 `docs/tasks/cards/R101-派单-20260923-C3.md`（C3-1 段）
 *
 * 口径（逐条对应裁定）：
 * - **复用既有表 `t_library_api_key`**（裁定 §二.6）：不新建 `t_open_api_key`，
 *   因为外网鉴权中间件 `middleware/api-key-auth.ts` 读的就是本表 —— 换表会造成
 *   「控制台管的密钥不是网关认的密钥」两个真相源。本批次只按 §二.6 追加 6 列。
 * - **明文 AppSecret 只在「创建 / 轮换」响应出现一次**（裁定 §二.7）；其它出口一律打码，
 *   且**服务端打码**（不依赖前端 `maskKey()`，S3-90 的前端缺陷不能成为泄露前提）。
 * - **日志与审计一律不含明文**：审计只写 appName / 掩码 AppKey / 租户 / 档位；
 *   本文件在任何日志调用中都不传密钥本体（明文或哈希）。
 * - 状态派生：`status`（1/0）语义不变，轮换中由 `rotate_expire_at` 派生（裁定 §二 设计取舍）。
 * - 平台级表（无租户注入）→ 使用 `query()` / `queryOne()`。
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import logger from "../../shared/logger";
import { insertPlatformAuditLog } from "../admin/platform-audit-log.service";

/** 明文 AppSecret 的字节数（24 字节 → 48 位十六进制），与既有 `t_library_api_key` 同规格 */
const SECRET_BYTES = 24;
/** 轮换并行期（天）：旧密钥在此窗口内仍可鉴权（网关侧改造见回传卡「需裁定/登记」清单） */
export const ROTATE_WINDOW_DAYS = 7;
/** QPS 档位（与 `t_library_api_key.qps` 列注释一致） */
export const QPS_OPTIONS = [10, 30, 50] as const;

/** 数据库行（t_library_api_key 全列视图，api_secret 仅内部轮换需要） */
export interface ApiKeyRow {
  id: number;
  tenantId: string;
  appName: string;
  apiKey: string;
  apiSecret?: string | null;
  allowedIps: string | null;
  dailyLimit: number;
  qps: number;
  scopes: string | null;
  todayCount: number;
  lastCalledAt: string | Date | null;
  status: number;
  remark: string | null;
  rotateExpireAt: string | Date | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

/** 列表 / 详情返回项（**不含任何密钥本体**，AppKey 已打码） */
export interface ApiKeyItem {
  id: number;
  tenantId: string;
  appName: string;
  apiKey: string;
  allowedIps: string[];
  dailyLimit: number;
  qps: number;
  scopes: string[];
  todayCount: number;
  lastCalledAt: string | Date | null;
  status: number;
  rotateStatus: "ACTIVE" | "ROTATING" | "DISABLED";
  rotateExpireAt: string | Date | null;
  remark: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

/** 调用统计的日聚合项（数据源：t_open_api_call_daily） */
export interface ApiCallDailyItem {
  date: string;
  callCount: number;
  errorCount: number;
  errorRate: number | null;
}

export interface ApiKeyListParams {
  page: number;
  pageSize: number;
  tenantId?: string;
  status?: number;
  keyword?: string;
}

export interface ApiKeyCreateInput {
  appName: string;
  tenantId?: string;
  allowedIps?: string[] | null;
  dailyLimit?: number;
  qps?: number;
  scopes?: string[];
  remark?: string;
}

export interface ApiKeyUpdateInput {
  dailyLimit?: number;
  qps?: number;
  allowedIps?: string[] | null;
  scopes?: string[];
  status?: number;
  remark?: string;
}

/** 审计/操作人上下文（由 controller 从平台令牌提取；service 不接触 req/res） */
export interface OperatorContext {
  adminId: number;
  adminName: string;
  ip?: string | null;
}

/** 审计写入失败不得影响业务结果，且**绝不**把密钥写进日志 */
async function writeAudit(
  operator: OperatorContext,
  action: string,
  description: string,
  targetId: number | null,
  detail: Record<string, unknown>
): Promise<void> {
  try {
    await insertPlatformAuditLog({
      adminId: operator.adminId,
      adminName: operator.adminName,
      module: "open_platform",
      action,
      auditType: "SECURITY",
      description,
      targetType: "t_library_api_key",
      targetId,
      detail,
      ip: operator.ip ?? null,
    });
  } catch (e) {
    logger.warn("[open-platform] 审计写入失败", e instanceof Error ? e.message : String(e));
  }
}

/** 生成 AppKey（与既有库同前缀 zk_live_，避免两套命名） */
function generateAppKey(): string {
  return `zk_live_${crypto.randomBytes(16).toString("hex")}`;
}

/**
 * AppKey 打码（服务端统一出口）
 * 例：`zk_live_3f9a1c2b8d7e` → `zk_l****d7e`（保留 4 位前缀 + 3 位后缀，中段固定 4 个 *）
 * 长度过短时全掩码，绝不原样返回。
 */
export function maskAppKey(appKey: string): string {
  const value = String(appKey ?? "");
  if (value.length <= 8) return "*".repeat(Math.max(value.length, 4));
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

/** 解析 JSON 数组列，非法/空一律返回 []（不抛错、不造值） */
function parseJsonArray(raw: unknown): string[] {
  if (raw === null || raw === undefined || raw === "") return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "object") return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value as string).getTime();
  return Number.isNaN(time) ? null : time;
}

/** 三态派生：轮换中（rotate_expire_at 非空且未过期）/ 生效 / 禁用 */
export function rotateStatusOf(row: Pick<ApiKeyRow, "status" | "rotateExpireAt">): ApiKeyItem["rotateStatus"] {
  const expire = toTime(row.rotateExpireAt);
  if (expire !== null && expire > Date.now()) return "ROTATING";
  return Number(row.status) === 1 ? "ACTIVE" : "DISABLED";
}

/** 行 → 返回项（唯一的对外映射出口，杜绝 api_secret 泄露） */
export function toApiKeyItem(row: ApiKeyRow): ApiKeyItem {
  return {
    id: Number(row.id),
    tenantId: row.tenantId ?? "default",
    appName: row.appName,
    apiKey: maskAppKey(row.apiKey),
    allowedIps: parseJsonArray(row.allowedIps),
    dailyLimit: Number(row.dailyLimit ?? 0),
    qps: Number(row.qps ?? QPS_OPTIONS[0]),
    scopes: parseJsonArray(row.scopes),
    todayCount: Number(row.todayCount ?? 0),
    lastCalledAt: row.lastCalledAt ?? null,
    status: Number(row.status),
    rotateStatus: rotateStatusOf(row),
    rotateExpireAt: row.rotateExpireAt ?? null,
    remark: row.remark ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

/** 列表/详情共用的列清单（**不含 prev_api_secret**，且 api_key 出来后立即打码） */
const KEY_COLUMNS = `id, tenant_id AS tenantId, app_name AS appName, api_key AS apiKey,
       allowed_ips AS allowedIps, daily_limit AS dailyLimit, qps, scopes,
       today_count AS todayCount, last_called_at AS lastCalledAt, status, remark,
       rotate_expire_at AS rotateExpireAt, created_at AS createdAt, updated_at AS updatedAt`;

/** insertId 归一化：真实 pool.query 返回 ResultSetHeader 本体，mock/部分路径返回数组 */
function insertIdOf(result: unknown): number {
  const direct = (result as { insertId?: number } | null | undefined)?.insertId;
  if (direct !== undefined) return Number(direct);
  if (Array.isArray(result)) {
    const first = (result[0] as { insertId?: number } | undefined)?.insertId;
    if (first !== undefined) return Number(first);
  }
  return 0;
}

/** affectedRows 归一化（同 insertIdOf 的理由） */
function affectedRowsOf(result: unknown): number {
  const direct = (result as { affectedRows?: number } | null | undefined)?.affectedRows;
  if (direct !== undefined) return Number(direct);
  if (Array.isArray(result)) {
    const first = (result[0] as { affectedRows?: number } | undefined)?.affectedRows;
    if (first !== undefined) return Number(first);
  }
  return 0;
}

/** 查询单个密钥行（不存在由调用方决定 404 口径） */
async function findKeyRow(id: number): Promise<ApiKeyRow | null> {
  return queryOne<ApiKeyRow>(
    `SELECT ${KEY_COLUMNS} FROM t_library_api_key WHERE id = ?`,
    [id]
  );
}

async function requireKeyRow(id: number): Promise<ApiKeyRow> {
  const row = await findKeyRow(id);
  if (!row) throw new AppError(`API 密钥不存在：${id}`, 404);
  return row;
}

// ─── 列表 ──────────────────────────────────────────────────────

export async function listApiKeys(params: ApiKeyListParams) {
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (params.tenantId) {
    conditions.push("tenant_id = ?");
    sqlParams.push(params.tenantId);
  }
  if (params.status !== undefined) {
    conditions.push("status = ?");
    sqlParams.push(params.status);
  }
  if (params.keyword) {
    conditions.push("(app_name LIKE ? OR api_key LIKE ?)");
    sqlParams.push(`%${params.keyword}%`, `%${params.keyword}%`);
  }
  const where = conditions.join(" AND ");

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM t_library_api_key WHERE ${where}`,
    sqlParams
  );
  const total = Number(countRow?.total ?? 0);

  const offset = (params.page - 1) * params.pageSize;
  const rows = await query<ApiKeyRow>(
    `SELECT ${KEY_COLUMNS} FROM t_library_api_key
      WHERE ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...sqlParams, params.pageSize, offset]
  );

  return {
    records: rows.map(toApiKeyItem),
    total,
    page: params.page,
    pageSize: params.pageSize,
  };
}

// ─── 创建（唯一一次明文出口之一） ───────────────────────────────

export async function createApiKey(input: ApiKeyCreateInput, operator: OperatorContext) {
  const appKey = generateAppKey();
  const apiSecretRaw = crypto.randomBytes(SECRET_BYTES).toString("hex");
  const apiSecretHash = await bcrypt.hash(apiSecretRaw, 10);

  const tenantId = input.tenantId || "default";
  const dailyLimit = input.dailyLimit ?? 10000;
  const qps = input.qps ?? QPS_OPTIONS[0];
  const scopes = input.scopes ?? [];
  const allowedIps = input.allowedIps && input.allowedIps.length > 0 ? JSON.stringify(input.allowedIps) : null;

  const result = await query(
    `INSERT INTO t_library_api_key
       (app_name, tenant_id, api_key, api_secret, allowed_ips, daily_limit, qps, scopes, today_count, status, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
    [
      input.appName,
      tenantId,
      appKey,
      apiSecretHash,
      allowedIps,
      dailyLimit,
      qps,
      scopes.length > 0 ? JSON.stringify(scopes) : null,
      input.remark ?? null,
    ]
  );
  const id = insertIdOf(result);

  await writeAudit(operator, "API_KEY_CREATE", `签发开放平台 API 密钥：${input.appName}`, id, {
    tenantId,
    appName: input.appName,
    appKeyMasked: maskAppKey(appKey),
    dailyLimit,
    qps,
    scopes,
  });

  // 明文 AppSecret 仅出现在本次响应（不入库、不入日志、不入审计）
  return {
    id,
    tenantId,
    appName: input.appName,
    apiKey: appKey,
    apiSecret: apiSecretRaw,
    allowedIps: input.allowedIps ?? [],
    dailyLimit,
    qps,
    scopes,
    status: 1,
  };
}

// ─── 编辑 / 启用 / 吊销 ────────────────────────────────────────

const UPDATE_FIELD_RULES: Array<{ key: keyof ApiKeyUpdateInput; column: string }> = [
  { key: "dailyLimit", column: "daily_limit" },
  { key: "qps", column: "qps" },
  { key: "status", column: "status" },
  { key: "remark", column: "remark" },
];

export async function updateApiKey(id: number, patch: ApiKeyUpdateInput, operator: OperatorContext) {
  await requireKeyRow(id);

  const fields: string[] = [];
  const values: unknown[] = [];
  const changedFields: string[] = [];

  for (const rule of UPDATE_FIELD_RULES) {
    const value = patch[rule.key];
    if (value === undefined) continue;
    fields.push(`${rule.column} = ?`);
    values.push(value);
    changedFields.push(rule.key);
  }
  if (patch.allowedIps !== undefined) {
    fields.push("allowed_ips = ?");
    values.push(patch.allowedIps && patch.allowedIps.length > 0 ? JSON.stringify(patch.allowedIps) : null);
    changedFields.push("allowedIps");
  }
  if (patch.scopes !== undefined) {
    fields.push("scopes = ?");
    values.push(patch.scopes.length > 0 ? JSON.stringify(patch.scopes) : null);
    changedFields.push("scopes");
  }

  if (fields.length === 0) {
    throw new AppError("没有需要更新的字段（dailyLimit/qps/allowedIps/scopes/status/remark 至少一项）", 400);
  }

  values.push(id);
  await query(`UPDATE t_library_api_key SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`, values);

  await writeAudit(operator, "API_KEY_UPDATE", `编辑开放平台 API 密钥：${id}`, id, {
    changedFields,
    // 只记录字段名与档位，不记录任何密钥本体
    dailyLimit: patch.dailyLimit,
    qps: patch.qps,
    status: patch.status,
  });

  return { id, updated: true, changedFields };
}

export async function enableApiKey(id: number, operator: OperatorContext) {
  await requireKeyRow(id);
  await query("UPDATE t_library_api_key SET status = 1, updated_at = NOW() WHERE id = ?", [id]);
  await writeAudit(operator, "API_KEY_ENABLE", `启用开放平台 API 密钥：${id}`, id, { status: 1 });
  return { id, status: 1, enabled: true };
}

export async function revokeApiKey(id: number, operator: OperatorContext) {
  const row = await requireKeyRow(id);
  await query("DELETE FROM t_library_api_key WHERE id = ?", [id]);
  await writeAudit(operator, "API_KEY_REVOKE", `吊销开放平台 API 密钥：${id}`, id, {
    appKeyMasked: maskAppKey(row.apiKey),
    tenantId: row.tenantId ?? "default",
  });
  return { id, deleted: true };
}

// ─── 轮换（唯一一次明文出口之二） ──────────────────────────────

export async function rotateApiKey(id: number, operator: OperatorContext) {
  const row = await requireKeyRow(id);

  const expire = toTime(row.rotateExpireAt);
  if (expire !== null && expire > Date.now()) {
    throw new AppError("该密钥正在轮换中，请先完成轮换（POST /api-keys/:id/rotate-complete）", 409);
  }

  const appKey = generateAppKey();
  const apiSecretRaw = crypto.randomBytes(SECRET_BYTES).toString("hex");
  const apiSecretHash = await bcrypt.hash(apiSecretRaw, 10);

  // 条件更新兜底并发：轮换中/已过期才允许覆盖，避免并发双轮换
  const result = await query(
    `UPDATE t_library_api_key
        SET prev_api_key = api_key,
            prev_api_secret = api_secret,
            api_key = ?,
            api_secret = ?,
            rotate_expire_at = DATE_ADD(NOW(), INTERVAL ${ROTATE_WINDOW_DAYS} DAY),
            updated_at = NOW()
      WHERE id = ? AND (rotate_expire_at IS NULL OR rotate_expire_at <= NOW())`,
    [appKey, apiSecretHash, id]
  );
  if (affectedRowsOf(result) === 0) {
    throw new AppError("该密钥正在轮换中，请先完成轮换（POST /api-keys/:id/rotate-complete）", 409);
  }

  const updated = await findKeyRow(id);

  await writeAudit(operator, "API_KEY_ROTATE", `轮换开放平台 API 密钥：${id}`, id, {
    previousAppKeyMasked: maskAppKey(row.apiKey),
    newAppKeyMasked: maskAppKey(appKey),
    rotateWindowDays: ROTATE_WINDOW_DAYS,
    rotateExpireAt: updated?.rotateExpireAt ?? null,
  });

  // 明文 AppSecret 仅出现在本次响应（旧密钥哈希已转存 prev_api_secret，用于并行期校验）
  return {
    id,
    apiKey: appKey,
    apiSecret: apiSecretRaw,
    previousAppKeyMasked: maskAppKey(row.apiKey),
    rotateExpireAt: updated?.rotateExpireAt ?? null,
    rotateStatus: "ROTATING" as const,
  };
}

export async function completeRotation(id: number, operator: OperatorContext) {
  const row = await requireKeyRow(id);
  if (!row.rotateExpireAt) {
    throw new AppError("该密钥当前不在轮换中，无需完成轮换", 400);
  }

  await query(
    `UPDATE t_library_api_key
        SET prev_api_key = NULL, prev_api_secret = NULL, rotate_expire_at = NULL, updated_at = NOW()
      WHERE id = ?`,
    [id]
  );
  await writeAudit(operator, "API_KEY_ROTATE_COMPLETE", `完成轮换：旧密钥立即失效（${id}）`, id, {
    previousKeyInvalidated: true,
  });

  return { id, rotateStatus: "ACTIVE" as const, previousKeyInvalidated: true };
}

// ─── 调用统计（数据源：t_open_api_call_daily 日聚合） ───────────

export async function getApiKeyStats(id: number, days: number, operator?: OperatorContext) {
  const row = await requireKeyRow(id);

  const seriesRows = await query<{ statDate: string; callCount: number; errorCount: number }>(
    `SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS statDate,
            call_count AS callCount,
            error_count AS errorCount
       FROM t_open_api_call_daily
      WHERE api_key_id = ? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ORDER BY stat_date ASC`,
    [id, days - 1]
  );

  const series: ApiCallDailyItem[] = seriesRows.map((r) => {
    const callCount = Number(r.callCount ?? 0);
    const errorCount = Number(r.errorCount ?? 0);
    return {
      date: String(r.statDate),
      callCount,
      errorCount,
      errorRate: callCount > 0 ? Number((errorCount / callCount).toFixed(4)) : null,
    };
  });

  const totalCall = series.reduce((sum, item) => sum + item.callCount, 0);
  const totalError = series.reduce((sum, item) => sum + item.errorCount, 0);

  if (operator) {
    await writeAudit(operator, "API_KEY_STATS_VIEW", `查看调用统计：${id}`, id, { days });
  }

  return {
    id: row.id,
    tenantId: row.tenantId ?? "default",
    appName: row.appName,
    apiKey: maskAppKey(row.apiKey),
    dailyLimit: Number(row.dailyLimit ?? 0),
    qps: Number(row.qps ?? QPS_OPTIONS[0]),
    scopes: parseJsonArray(row.scopes),
    todayCount: Number(row.todayCount ?? 0),
    lastCalledAt: row.lastCalledAt ?? null,
    status: Number(row.status),
    rotateStatus: rotateStatusOf(row),
    rotateExpireAt: row.rotateExpireAt ?? null,
    range: { days },
    series,
    total: {
      callCount: totalCall,
      errorCount: totalError,
      errorRate: totalCall > 0 ? Number((totalError / totalCall).toFixed(4)) : null,
    },
    hasData: series.length > 0,
  };
}
