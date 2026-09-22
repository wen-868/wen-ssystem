import jwt from "jsonwebtoken";
import { query, queryOne } from "../../shared/db";
import { env } from "../../shared/env";
import { AppError } from "../../shared/app-error";
import { MERCHANT_JWT_AUDIENCE, MERCHANT_JWT_ISSUER } from "../../middleware/auth";
import { insertPlatformAuditLog } from "../admin/platform-audit-log.service";

/**
 * C1-2 A4 / A5：租户写操作（代登录、临时扩容）
 *
 * 硬性口径：
 * 1. **不新建表**：扩容记录落既有 KV 表 `t_tenant_config`
 *    （`docs/migrations/115_missing_tables.sql:30`，唯一键 `(tenant_id, config_key)`），零 DDL。
 * 2. **写操作必留痕**：两者都写 `t_platform_audit_log`（`insertPlatformAuditLog`）。
 * 3. **入参非法必 400**：幅度/有效期/事由逐项校验，非法直接 AppError(400)，不落库。
 * 4. 代登录令牌与既有商家登录**同机制同密钥**：JWT_SECRET + 商家 issuer/audience
 *    （`backend/src/middleware/auth.ts` 的 MERCHANT_JWT_ISSUER/AUDIENCE），
 *    故可被既有 `requireAuth` 校验；有效期收短为 30 分钟并以 `proxy: true` 标注来源。
 *
 * 已知边界（如实报备，未越界实现）：
 * - 「代登录需审批」本实现落在「强制填写事由 + 平台审计留痕」；仓库无审批流表，
 *   按卡「禁止新建表」不做双人审批链，如需另立事项由凌舟裁定。
 * - 扩容记录写入后，既有 `GET /:id/quota` 尚未合并扩容值
 *   （`tenant-quota.service.ts` 不在 C1-2 文件域内），已在回执报备。
 */

export const QUOTA_EXPAND_FIELDS = [
  "accounts",
  "products",
  "stores",
  "storage",
  "aiMonthly",
] as const;
export type QuotaExpandField = (typeof QUOTA_EXPAND_FIELDS)[number];

/** 代登录令牌有效期（秒）：30 分钟，远短于常规商家令牌 4h */
export const PROXY_LOGIN_TTL_SECONDS = 30 * 60;

/** 扩容记录在 t_tenant_config 中的 config_key */
export const QUOTA_EXPAND_CONFIG_KEY = "quota_expand";

const MAX_EXPAND_AMOUNT = 1_000_000;
const MAX_EXPAND_DAYS = 365;

interface TenantRow {
  id: string;
  tenantCode: string | null;
  tenantName: string | null;
  tenantId: string | null;
  status: unknown;
}

interface AdminUserRow {
  id: number;
  username: string;
  realName: string | null;
  role: string | null;
}

interface ConfigRow {
  id: number;
  config_value: string | null;
}

export interface OperatorInfo {
  id: number;
  name: string;
}

async function requireTenant(tenantId: string): Promise<TenantRow> {
  const row = await queryOne<TenantRow>(
    `SELECT id, tenant_code AS tenantCode, tenant_name AS tenantName, tenant_id AS tenantId, status
     FROM t_tenant WHERE id = ?`,
    [tenantId]
  );
  if (!row) throw new AppError("租户不存在", 404);
  return row;
}

function toSqlDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ============ A4：代登录 ============

export interface ProxyLoginParams {
  /** 代登录事由（必填，2-200 字）——审批留痕的最小落点 */
  reason: string;
  /** 指定以哪个租户账号代登录（可选，默认取该租户的管理员账号） */
  username?: string;
}

export interface ProxyLoginResult {
  token: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  issuedAt: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  loginUsername: string;
  loginUserId: number;
  reason: string;
  auditLogId: number;
}

export async function proxyLogin(
  tenantId: string,
  params: ProxyLoginParams,
  operator: OperatorInfo,
  ip: string | null
): Promise<ProxyLoginResult> {
  const reason = (params.reason ?? "").trim();
  if (reason.length < 2 || reason.length > 200) {
    throw new AppError("代登录事由必填（2-200 字）", 400);
  }

  const tenant = await requireTenant(tenantId);

  const user = params.username
    ? await queryOne<AdminUserRow>(
        `SELECT id, username, real_name AS realName, role FROM t_sys_user
         WHERE tenant_id = ? AND username = ? LIMIT 1`,
        [tenantId, params.username]
      )
    : await queryOne<AdminUserRow>(
        `SELECT id, username, real_name AS realName, role FROM t_sys_user
         WHERE tenant_id = ? AND status = 'ACTIVE'
         ORDER BY (role = 'ADMIN') DESC, id ASC LIMIT 1`,
        [tenantId]
      );
  if (!user) {
    throw new AppError(params.username ? "该租户下不存在该账号" : "该租户下无可用管理员账号", 404);
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      realName: user.realName || undefined,
      roles: [user.role || "ADMIN"],
      tenantId: tenant.tenantId || String(tenant.id),
      proxy: true,
      proxyOperator: operator.name,
    },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: PROXY_LOGIN_TTL_SECONDS,
      issuer: MERCHANT_JWT_ISSUER,
      audience: MERCHANT_JWT_AUDIENCE,
    }
  );

  const issuedAt = new Date();
  const auditLogId = await insertPlatformAuditLog({
    adminId: operator.id,
    adminName: operator.name,
    module: "tenant",
    auditType: "PROXY_LOGIN",
    action: "PROXY_LOGIN",
    targetType: "tenant",
    targetId: tenant.id,
    description: `代登录租户「${tenant.tenantName || tenant.id}」（账号 ${user.username}，事由：${reason}）`,
    detail: {
      tenantId: tenant.id,
      tenantCode: tenant.tenantCode,
      loginUsername: user.username,
      loginUserId: user.id,
      reason,
      ttlSeconds: PROXY_LOGIN_TTL_SECONDS,
    },
    ip,
  });

  return {
    token,
    tokenType: "Bearer",
    expiresInSeconds: PROXY_LOGIN_TTL_SECONDS,
    issuedAt: issuedAt.toISOString(),
    tenantId: String(tenant.id),
    tenantCode: tenant.tenantCode ?? "",
    tenantName: tenant.tenantName ?? "",
    loginUsername: user.username,
    loginUserId: user.id,
    reason,
    auditLogId,
  };
}

// ============ A5：临时扩容 ============

export interface QuotaExpandParams {
  field: string;
  amount: number;
  days: number;
  reason?: string;
}

export interface QuotaExpandRecord {
  field: QuotaExpandField;
  amount: number;
  days: number;
  reason: string;
  effectiveFrom: string;
  expireAt: string;
  operator: string;
  createdAt: string;
}

export interface QuotaExpandResult {
  tenantId: string;
  tenantCode: string;
  field: QuotaExpandField;
  amount: number;
  days: number;
  expireAt: string;
  records: QuotaExpandRecord[];
  auditLogId: number;
}

function parseExpandRecords(raw: string | null | undefined): QuotaExpandRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuotaExpandRecord[]) : [];
  } catch {
    // 脏数据按「无记录」处理，不抛出、不丢弃写入能力
    return [];
  }
}

export async function expandTenantQuota(
  tenantId: string,
  params: QuotaExpandParams,
  operator: OperatorInfo,
  ip: string | null
): Promise<QuotaExpandResult> {
  const field = String(params.field ?? "").trim();
  if (!(QUOTA_EXPAND_FIELDS as readonly string[]).includes(field)) {
    throw new AppError(`扩容维度非法（可选：${QUOTA_EXPAND_FIELDS.join(" / ")}）`, 400);
  }

  const amount = Number(params.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_EXPAND_AMOUNT) {
    throw new AppError(`扩容幅度必须为 1..${MAX_EXPAND_AMOUNT} 的整数`, 400);
  }

  const days = Number(params.days);
  if (!Number.isInteger(days) || days <= 0 || days > MAX_EXPAND_DAYS) {
    throw new AppError(`有效期必须为 1..${MAX_EXPAND_DAYS} 天的整数`, 400);
  }

  const reason = (params.reason ?? "").trim();
  if (reason.length > 200) {
    throw new AppError("扩容事由最长 200 字", 400);
  }

  const tenant = await requireTenant(tenantId);

  const now = new Date();
  const expireAtDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const record: QuotaExpandRecord = {
    field: field as QuotaExpandField,
    amount,
    days,
    reason,
    effectiveFrom: toSqlDateTime(now),
    expireAt: toSqlDateTime(expireAtDate),
    operator: operator.name,
    createdAt: toSqlDateTime(now),
  };

  // 追加到既有 KV 表（不新建表、不新增列）
  const existing = await queryOne<ConfigRow>(
    `SELECT id, config_value FROM t_tenant_config WHERE tenant_id = ? AND config_key = ? LIMIT 1`,
    [tenantId, QUOTA_EXPAND_CONFIG_KEY]
  );
  const records = parseExpandRecords(existing?.config_value);
  records.push(record);
  const json = JSON.stringify(records);

  if (existing) {
    await query(
      `UPDATE t_tenant_config
         SET config_value = ?, config_type = 'json', description = ?, updated_at = NOW()
       WHERE id = ?`,
      [json, `临时扩容记录(${records.length} 条)`, existing.id]
    );
  } else {
    await query(
      `INSERT INTO t_tenant_config (tenant_id, config_key, config_value, config_type, description)
       VALUES (?, ?, ?, 'json', ?)`,
      [tenantId, QUOTA_EXPAND_CONFIG_KEY, json, `临时扩容记录(1 条)`]
    );
  }

  const auditLogId = await insertPlatformAuditLog({
    adminId: operator.id,
    adminName: operator.name,
    module: "tenant",
    auditType: "QUOTA_EXPAND",
    action: "QUOTA_EXPAND",
    targetType: "tenant",
    targetId: tenant.id,
    description: `临时扩容租户「${tenant.tenantName || tenant.id}」：${field} +${amount}，有效期 ${days} 天${
      reason ? `，事由：${reason}` : ""
    }`,
    detail: {
      tenantId: tenant.id,
      tenantCode: tenant.tenantCode,
      field,
      amount,
      days,
      expireAt: record.expireAt,
      reason,
    },
    ip,
  });

  return {
    tenantId: String(tenant.id),
    tenantCode: tenant.tenantCode ?? "",
    field: record.field,
    amount,
    days,
    expireAt: record.expireAt,
    records,
    auditLogId,
  };
}
