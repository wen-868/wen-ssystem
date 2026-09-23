/**
 * 开放平台 Webhook 服务（R101-C3-1）
 *
 * 依据：`docs/tasks/cards/R101-C3-0-凌舟裁定.md` §三.2（新表 t_open_webhook / t_open_webhook_delivery）
 *      派单卡 `docs/tasks/cards/R101-派单-20260923-C3.md`（C3-1 段）
 *
 * 口径：
 * - 订阅密钥 `sign_secret` 与密钥族同纪律：bcrypt 存储、明文只在创建响应出现一次、日志/审计不含明文；
 * - 出站请求前做 **SSRF 防护**（仅 https、禁本机/内网/保留地址字面量），并带超时（5s）；
 * - 「近 7 日推送数 / 成功率」由投递记录表聚合派生，不落冗余列；
 * - 「连续失败 ≥ pause_threshold 自动暂停」只在**本文件内的投递路径**（测试推送 / 手动重推）生效；
 *   事件驱动（AUTO）推送器不在本批次端点清单内，已列入回传卡「未完成与阻塞」。
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import logger from "../../shared/logger";
import { insertPlatformAuditLog } from "../admin/platform-audit-log.service";
import type { OperatorContext } from "./open-api-key.service";
import { isOpenPlatformEvent } from "../../config/open-platform";

/** 出站超时（毫秒） */
export const DELIVER_TIMEOUT_MS = 5000;
/** 默认重试策略与自动暂停阈值（与 DDL 默认值一致） */
export const DEFAULT_RETRY_POLICY = "1m/5m/30m x3";
export const DEFAULT_PAUSE_THRESHOLD = 10;
/** 失败原因入库长度上限（列 VARCHAR(512)） */
const ERROR_MAX_LENGTH = 500;

export interface WebhookRow {
  id: number;
  tenantId: string;
  eventType: string;
  callbackUrl: string;
  signSecret?: string | null;
  retryPolicy: string;
  pauseThreshold: number;
  paused: number | boolean;
  lastTriggerAt: string | Date | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  recentPushCount?: number;
  recentOkCount?: number;
}

export interface WebhookDeliveryRow {
  id: number;
  subscriptionId: number;
  tenantId: string;
  eventType: string;
  payload: string | null;
  attempt: number;
  status: string;
  httpStatus: number | null;
  error: string | null;
  triggeredBy: string;
  durationMs: number | null;
  createdAt: string | Date | null;
}

export interface WebhookItem {
  id: number;
  tenantId: string;
  eventType: string;
  callbackUrl: string;
  retryPolicy: string;
  pauseThreshold: number;
  paused: boolean;
  lastTriggerAt: string | Date | null;
  lastStatus: string | null;
  lastError: string | null;
  recentPushCount: number;
  recentSuccessRate: number | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

export interface WebhookDeliveryItem {
  id: number;
  subscriptionId: number;
  eventType: string;
  payload: Record<string, unknown> | null;
  attempt: number;
  status: string;
  httpStatus: number | null;
  error: string | null;
  triggeredBy: string;
  durationMs: number | null;
  createdAt: string | Date | null;
}

export interface WebhookCreateInput {
  eventType: string;
  callbackUrl: string;
  tenantId?: string;
}

// ─── SSRF 防护 ─────────────────────────────────────────────────

/** IPv4 字面量是否属于本机/内网/保留段 */
function isBlockedIpv4(host: string): boolean {
  const matched = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!matched) return false;
  const first = Number(matched[1]);
  const second = Number(matched[2]);
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;
  if (first >= 224) return true; // 组播/保留
  return false;
}

/** IPv6 字面量（new URL 的 hostname 保留方括号）一律拒绝：回调用途不需要 IPv6 直连 */
function isBlockedIpv6(host: string): boolean {
  return host.startsWith("[");
}

/**
 * 回调地址安全校验（SSRF）：仅 https + 禁本机/内网/保留地址与内网主机名。
 * 违规一律 400（不静默放行），校验结果供出站前再次使用。
 */
export function assertSafeCallbackUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    throw new AppError("回调地址不是合法的 URL", 400);
  }
  if (url.protocol !== "https:") {
    throw new AppError("回调地址必须使用 https://（禁止 http）", 400);
  }
  const host = url.hostname.toLowerCase();
  if (!host) {
    throw new AppError("回调地址缺少主机名", 400);
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new AppError("回调地址禁止使用本机/内网主机名（SSRF 防护）", 400);
  }
  if (isBlockedIpv6(host) || isBlockedIpv4(host)) {
    throw new AppError("回调地址禁止使用本机/内网/保留地址（SSRF 防护）", 400);
  }
  return url;
}

// ─── 公共工具 ──────────────────────────────────────────────────

function insertIdOf(result: unknown): number {
  const direct = (result as { insertId?: number } | null | undefined)?.insertId;
  if (direct !== undefined) return Number(direct);
  if (Array.isArray(result)) {
    const first = (result[0] as { insertId?: number } | undefined)?.insertId;
    if (first !== undefined) return Number(first);
  }
  return 0;
}

function parsePayload(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function truncateError(message: string): string {
  const text = String(message ?? "").replace(/\s+/g, " ").trim();
  return text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH)}…` : text;
}

async function writeAudit(
  operator: OperatorContext | undefined,
  action: string,
  description: string,
  targetId: number | null,
  detail: Record<string, unknown>
): Promise<void> {
  if (!operator) return;
  try {
    await insertPlatformAuditLog({
      adminId: operator.adminId,
      adminName: operator.adminName,
      module: "open_platform",
      action,
      auditType: "SECURITY",
      description,
      targetType: "t_open_webhook",
      targetId,
      detail,
      ip: operator.ip ?? null,
    });
  } catch (e) {
    logger.warn("[open-platform] 审计写入失败", e instanceof Error ? e.message : String(e));
  }
}

const WEBHOOK_COLUMNS = `w.id, w.tenant_id AS tenantId, w.event_type AS eventType, w.callback_url AS callbackUrl,
       w.retry_policy AS retryPolicy, w.pause_threshold AS pauseThreshold, w.paused,
       w.last_trigger_at AS lastTriggerAt, w.last_status AS lastStatus, w.last_error AS lastError,
       w.created_at AS createdAt, w.updated_at AS updatedAt`;

const DELIVERY_COLUMNS = `id, subscription_id AS subscriptionId, tenant_id AS tenantId, event_type AS eventType,
       payload, attempt, status, http_status AS httpStatus, error,
       triggered_by AS triggeredBy, duration_ms AS durationMs, created_at AS createdAt`;

function toWebhookItem(row: WebhookRow): WebhookItem {
  const pushCount = Number(row.recentPushCount ?? 0);
  const okCount = Number(row.recentOkCount ?? 0);
  return {
    id: Number(row.id),
    tenantId: row.tenantId ?? "default",
    eventType: row.eventType,
    callbackUrl: row.callbackUrl,
    retryPolicy: row.retryPolicy ?? DEFAULT_RETRY_POLICY,
    pauseThreshold: Number(row.pauseThreshold ?? DEFAULT_PAUSE_THRESHOLD),
    paused: Number(row.paused) === 1,
    lastTriggerAt: row.lastTriggerAt ?? null,
    lastStatus: row.lastStatus ?? null,
    lastError: row.lastError ?? null,
    recentPushCount: pushCount,
    recentSuccessRate: pushCount > 0 ? Number(((okCount / pushCount) * 100).toFixed(1)) : null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export function toDeliveryItem(row: WebhookDeliveryRow): WebhookDeliveryItem {
  return {
    id: Number(row.id),
    subscriptionId: Number(row.subscriptionId),
    eventType: row.eventType,
    payload: parsePayload(row.payload),
    attempt: Number(row.attempt ?? 1),
    status: row.status,
    httpStatus: row.httpStatus === null || row.httpStatus === undefined ? null : Number(row.httpStatus),
    error: row.error ?? null,
    triggeredBy: row.triggeredBy,
    durationMs: row.durationMs === null || row.durationMs === undefined ? null : Number(row.durationMs),
    createdAt: row.createdAt ?? null,
  };
}

async function findWebhookRow(id: number): Promise<WebhookRow | null> {
  return queryOne<WebhookRow>(
    `SELECT id, tenant_id AS tenantId, event_type AS eventType, callback_url AS callbackUrl,
            sign_secret AS signSecret, retry_policy AS retryPolicy, pause_threshold AS pauseThreshold,
            paused, last_trigger_at AS lastTriggerAt, last_status AS lastStatus, last_error AS lastError,
            created_at AS createdAt, updated_at AS updatedAt
       FROM t_open_webhook WHERE id = ?`,
    [id]
  );
}

async function requireWebhookRow(id: number): Promise<WebhookRow> {
  const row = await findWebhookRow(id);
  if (!row) throw new AppError(`Webhook 订阅不存在：${id}`, 404);
  return row;
}

// ─── 列表 / 创建 ───────────────────────────────────────────────

export async function listWebhooks(params: { tenantId?: string; paused?: number } = {}) {
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];
  if (params.tenantId) {
    conditions.push("w.tenant_id = ?");
    sqlParams.push(params.tenantId);
  }
  if (params.paused !== undefined) {
    conditions.push("w.paused = ?");
    sqlParams.push(params.paused);
  }

  const rows = await query<WebhookRow>(
    `SELECT ${WEBHOOK_COLUMNS},
            COALESCE(d.recentPushCount, 0) AS recentPushCount,
            COALESCE(d.recentOkCount, 0) AS recentOkCount
       FROM t_open_webhook w
       LEFT JOIN (
         SELECT subscription_id,
                COUNT(*) AS recentPushCount,
                SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) AS recentOkCount
           FROM t_open_webhook_delivery
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY subscription_id
       ) d ON d.subscription_id = w.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY w.created_at DESC, w.id DESC`,
    sqlParams
  );

  return { records: rows.map(toWebhookItem), total: rows.length };
}

export async function createWebhook(input: WebhookCreateInput, operator?: OperatorContext) {
  if (!isOpenPlatformEvent(input.eventType)) {
    throw new AppError(`事件类型不在事件目录内：${input.eventType}`, 400);
  }
  assertSafeCallbackUrl(input.callbackUrl);

  const signSecretRaw = crypto.randomBytes(24).toString("hex");
  const signSecretHash = await bcrypt.hash(signSecretRaw, 10);
  const tenantId = input.tenantId || "default";

  const result = await query(
    `INSERT INTO t_open_webhook
       (tenant_id, event_type, callback_url, sign_secret, retry_policy, pause_threshold, paused)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [tenantId, input.eventType, input.callbackUrl, signSecretHash, DEFAULT_RETRY_POLICY, DEFAULT_PAUSE_THRESHOLD]
  );
  const id = insertIdOf(result);

  await writeAudit(operator, "WEBHOOK_CREATE", `新建 Webhook 订阅：${input.eventType}`, id, {
    tenantId,
    eventType: input.eventType,
    callbackUrl: input.callbackUrl,
    signSecretIssued: true, // 只记录"已下发"，明文/哈希都不入审计
  });

  // 签名密钥明文仅出现在本次响应
  return {
    id,
    tenantId,
    eventType: input.eventType,
    callbackUrl: input.callbackUrl,
    signSecret: signSecretRaw,
    retryPolicy: DEFAULT_RETRY_POLICY,
    pauseThreshold: DEFAULT_PAUSE_THRESHOLD,
    paused: false,
  };
}

// ─── 出站投递 ──────────────────────────────────────────────────

/** 记录一次投递结果（成功或失败都落库），并回写订阅最近状态 */
async function recordDelivery(
  row: WebhookRow,
  payload: Record<string, unknown>,
  attempt: number,
  triggeredBy: "AUTO" | "MANUAL" | "TEST"
): Promise<WebhookDeliveryItem> {
  const start = Date.now();
  let status = "OK";
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVER_TIMEOUT_MS);
    try {
      const response = await fetch(row.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "zhixiang-open-webhook/1.0" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      httpStatus = Number(response.status);
      if (httpStatus < 200 || httpStatus >= 300) {
        status = "FAIL";
        errorMessage = `对端返回非 2xx：${httpStatus}`;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    status = "FAIL";
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      errorMessage = `请求超时（> ${DELIVER_TIMEOUT_MS}ms）`;
    } else {
      errorMessage = truncateError(e instanceof Error ? e.message : String(e));
    }
  }

  const durationMs = Date.now() - start;

  const insertResult = await query(
    `INSERT INTO t_open_webhook_delivery
       (subscription_id, tenant_id, event_type, payload, attempt, status, http_status, error, triggered_by, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.tenantId ?? "default",
      row.eventType,
      JSON.stringify(payload),
      attempt,
      status,
      httpStatus,
      errorMessage,
      triggeredBy,
      durationMs,
    ]
  );
  const deliveryId = insertIdOf(insertResult);

  await query(
    "UPDATE t_open_webhook SET last_trigger_at = NOW(), last_status = ?, last_error = ? WHERE id = ?",
    [status, errorMessage, row.id]
  );

  await autoPauseIfNeeded(row);

  const inserted = await queryOne<WebhookDeliveryRow>(
    `SELECT ${DELIVERY_COLUMNS} FROM t_open_webhook_delivery WHERE id = ?`,
    [deliveryId]
  );

  if (inserted) return toDeliveryItem(inserted);
  return toDeliveryItem({
    id: deliveryId,
    subscriptionId: row.id,
    tenantId: row.tenantId ?? "default",
    eventType: row.eventType,
    payload: JSON.stringify(payload),
    attempt,
    status,
    httpStatus,
    error: errorMessage,
    triggeredBy,
    durationMs,
    createdAt: null,
  });
}

/** 最近 pause_threshold 次投递全失败 ⇒ 自动暂停订阅（设计稿规则） */
async function autoPauseIfNeeded(row: WebhookRow): Promise<boolean> {
  const threshold = Number(row.pauseThreshold ?? DEFAULT_PAUSE_THRESHOLD);
  if (threshold <= 0) return false;

  const stat = await queryOne<{ total: number; failCount: number | null }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) AS failCount
       FROM (SELECT status FROM t_open_webhook_delivery
              WHERE subscription_id = ? ORDER BY id DESC LIMIT ?) AS recent`,
    [row.id, threshold]
  );

  const total = Number(stat?.total ?? 0);
  const failCount = Number(stat?.failCount ?? 0);
  if (total >= threshold && failCount === total && Number(row.paused) !== 1) {
    await query("UPDATE t_open_webhook SET paused = 1 WHERE id = ?", [row.id]);
    logger.warn(`[open-platform] Webhook 订阅连续失败 ${failCount} 次，已自动暂停（订阅 ${row.id}）`);
    return true;
  }
  return false;
}

/** 测试推送：不依赖真实事件，发一条标记为测试的报文并记录投递 */
export async function testWebhook(id: number, operator?: OperatorContext) {
  const row = await requireWebhookRow(id);
  // 出站前二次校验（防止历史数据里存了非法地址）
  assertSafeCallbackUrl(row.callbackUrl);

  const payload = {
    event: row.eventType,
    test: true,
    subscriptionId: Number(row.id),
    sentAt: new Date().toISOString(),
  };
  const delivery = await recordDelivery(row, payload, 1, "TEST");

  await writeAudit(operator, "WEBHOOK_TEST", `测试推送：订阅 ${id}`, id, {
    status: delivery.status,
    httpStatus: delivery.httpStatus,
    durationMs: delivery.durationMs,
  });

  return { subscriptionId: Number(row.id), eventType: row.eventType, delivery };
}

// ─── 投递记录 / 失败原因 / 重推 / 恢复 ─────────────────────────

export async function listDeliveries(id: number, params: { page: number; pageSize: number }) {
  await requireWebhookRow(id);
  const offset = (params.page - 1) * params.pageSize;

  const countRow = await queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM t_open_webhook_delivery WHERE subscription_id = ?",
    [id]
  );
  const rows = await query<WebhookDeliveryRow>(
    `SELECT ${DELIVERY_COLUMNS} FROM t_open_webhook_delivery
      WHERE subscription_id = ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?`,
    [id, params.pageSize, offset]
  );

  return {
    subscriptionId: id,
    records: rows.map(toDeliveryItem),
    total: Number(countRow?.total ?? 0),
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function listFailures(id: number, limit: number) {
  await requireWebhookRow(id);

  const countRow = await queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM t_open_webhook_delivery WHERE subscription_id = ? AND status = 'FAIL'",
    [id]
  );
  const rows = await query<WebhookDeliveryRow>(
    `SELECT ${DELIVERY_COLUMNS} FROM t_open_webhook_delivery
      WHERE subscription_id = ? AND status = 'FAIL'
      ORDER BY id DESC
      LIMIT ?`,
    [id, limit]
  );

  return {
    subscriptionId: id,
    records: rows.map(toDeliveryItem),
    total: Number(countRow?.total ?? 0),
  };
}

export async function redeliver(id: number, deliveryId: number | undefined, operator?: OperatorContext) {
  const row = await requireWebhookRow(id);
  assertSafeCallbackUrl(row.callbackUrl);

  const source = deliveryId
    ? await queryOne<WebhookDeliveryRow>(
        `SELECT ${DELIVERY_COLUMNS} FROM t_open_webhook_delivery WHERE id = ? AND subscription_id = ?`,
        [deliveryId, id]
      )
    : await queryOne<WebhookDeliveryRow>(
        `SELECT ${DELIVERY_COLUMNS} FROM t_open_webhook_delivery
          WHERE subscription_id = ? ORDER BY id DESC LIMIT 1`,
        [id]
      );

  if (!source) {
    throw new AppError(
      deliveryId
        ? `投递记录不存在或不属于该订阅：${deliveryId}`
        : "该订阅暂无投递记录，无法重推（请先执行测试推送）",
      404
    );
  }

  const payload = parsePayload(source.payload) ?? {
    event: row.eventType,
    redeliverOf: Number(source.id),
    sentAt: new Date().toISOString(),
  };
  const attempt = Number(source.attempt ?? 1) + 1;
  const delivery = await recordDelivery(row, payload, attempt, "MANUAL");

  await writeAudit(operator, "WEBHOOK_REDELIVER", `手动重推：订阅 ${id}（源投递 ${source.id}）`, id, {
    redeliverOf: Number(source.id),
    attempt,
    status: delivery.status,
    httpStatus: delivery.httpStatus,
  });

  return {
    subscriptionId: id,
    redeliverOf: Number(source.id),
    attempt,
    delivery,
  };
}

export async function resumeWebhook(id: number, operator?: OperatorContext) {
  const row = await requireWebhookRow(id);
  if (Number(row.paused) === 0) {
    return { id, paused: false, resumed: false };
  }
  await query("UPDATE t_open_webhook SET paused = 0 WHERE id = ?", [id]);
  await writeAudit(operator, "WEBHOOK_RESUME", `恢复订阅：${id}`, id, { paused: false });
  return { id, paused: false, resumed: true };
}
