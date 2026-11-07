import { randomUUID } from "node:crypto";
import type { ResultSetHeader } from "mysql2";
import { connExecute, query, queryOne, transaction } from "../shared/db";
import { makeBizNo } from "../shared/id";
import { AppError } from "../shared/app-error";
import {
  bindTenantAdminToOwnSuperAdmin,
  provisionTenantRbac,
  type SqlRunner,
} from "./platform/tenant-rbac-provision.service";
// TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01：租户启停统一审计入口（唯一写入口，见该文件头注释）
import {
  recordTenantToggleAudit,
  type TenantToggleAuditContext,
} from "./admin/platform-audit-tenant-toggle.service";
// S3-205（总清单第 26 项）：开通租户时首个管理员的口令哈希一律走 `shared/password.ts` 的唯一封装
// （`v2$` + cost 12），禁止裸 `bcrypt.hash`（两种口径并存会让裸 bcrypt 校验对 `v2$` 哈希恒 false）。
import { hashPassword } from "../shared/password";

/**
 * S3-150：租户 status 的**对外唯一口径**（字符串）。
 * DB 列 `t_tenant.status` 是 TINYINT（1=启用 / 0=停用），只在服务层做映射；
 * 列表/详情（读）与启停（写）两条路径返回同一形态。
 * 存量库同时存在 `1` 与老写法 `ACTIVE` 两套取值，故两者都按启用处理
 * （与 platform/tenant-status-stats.service.ts 的枚举口径一致）。
 */
export type TenantStatus = "ACTIVE" | "DISABLED";

/** DB 值 ⇒ 对外字符串：0/"0"/"DISABLED" ⇒ DISABLED，其余（1/"1"/"ACTIVE"）⇒ ACTIVE */
export function toTenantStatus(value: number | string | null | undefined): TenantStatus {
  return value === 0 || value === "0" || value === "DISABLED" ? "DISABLED" : "ACTIVE";
}

/** 对外字符串 ⇒ DB TINYINT；取值不在统一口径内 ⇒ null（调用方按 400 处理，不静默兜底） */
export function toTenantStatusValue(value: string | number): 0 | 1 | null {
  const text = String(value);
  if (text === "ACTIVE" || text === "1") return 1;
  if (text === "DISABLED" || text === "0") return 0;
  return null;
}

export interface TenantRecord {
  /** S3-150：t_tenant.id 是 VARCHAR(36)（default / UUID），一律按字符串传递 */
  id: string;
  tenantName: string;
  tenantCode: string;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
  status: TenantStatus;
  expireAt: string | null;
  createdAt: string;
}

/** 库内原始行：status 为 TINYINT（存量数据可能是 1/"1"/"ACTIVE"），出口统一映射为字符串 */
interface TenantRow {
  id: string;
  tenantName: string;
  tenantCode: string;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
  status: number | string | null;
  expireAt: string | null;
  createdAt: string;
}

export interface TenantListResult {
  total: number;
  page: number;
  pageSize: number;
  records: TenantRecord[];
}

interface CountTotalRow {
  total: number;
}

interface IdRow {
  /** t_tenant.id 为 VARCHAR(36) */
  id: string;
}

// ============ 租户列表 ============
export async function listTenants(page: number, pageSize: number, keyword?: string): Promise<TenantListResult> {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (keyword) {
    conditions.push("tenant_name LIKE ?");
    params.push(`%${keyword}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [totalResult, rows] = await Promise.all([
    queryOne<CountTotalRow>(`SELECT COUNT(*) AS total FROM t_tenant ${where}`, params),
    query<TenantRow>(
      `SELECT id, tenant_code AS tenantCode, tenant_name AS tenantName, contact_name AS contactName,
              contact_mobile AS contactMobile, contact_email AS contactEmail,
              status, expire_at AS expireAt, created_at AS createdAt
       FROM t_tenant ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
  ]);

  const records: TenantRecord[] = rows.map((row) => ({ ...row, status: toTenantStatus(row.status) }));
  return { total: totalResult?.total || 0, page, pageSize, records };
}

// ============ 租户详情 ============
export async function getTenantById(id: string): Promise<TenantRecord | null> {
  const row = await queryOne<TenantRow>(
    `SELECT id, tenant_code AS tenantCode, tenant_name AS tenantName, contact_name AS contactName,
            contact_mobile AS contactMobile, contact_email AS contactEmail,
            status, expire_at AS expireAt, created_at AS createdAt
     FROM t_tenant WHERE id = ?`,
    [id]
  );
  return row ? { ...row, status: toTenantStatus(row.status) } : null;
}

// ============ 检查租户名重复 ============
export async function checkTenantNameExists(name: string): Promise<boolean> {
  const existing = await queryOne<IdRow>("SELECT id FROM t_tenant WHERE tenant_name = ?", [name]);
  return !!existing;
}

// ============ 创建租户（含管理员） ============
/**
 * 平台侧开租户（POST /api/platform/tenants）——S3-144 A 项真缺陷修复
 *
 * 原实现的三处缺陷（卡 §一①）：
 *  ① `t_tenant.id` 是 VARCHAR(36) 主键、无自增/默认值，原实现用 `insertId` 取 id ⇒ 恒为 0；
 *  ② 原 INSERT 未提供 016 定义的 NOT NULL 列 `tenant_code` / `company_name` / `contact_person`
 *     ⇒ 非严格模式"租户与管理员已写库、接口却返回 0"的脏写，严格模式 1364 直接失败；
 *  ③ 原 INSERT 写 `status='ACTIVE'`（字符串），而 t_tenant.status 是 TINYINT（1=正常）⇒ 严格模式 1366。
 *
 * 修法（最小改动）：应用层 `randomUUID()` 生成主键、`makeBizNo("T")` 生成租户编码，
 * 补齐 NOT NULL 列与数值状态；返回真实 tenant_id（字符串）而不是 insertId。
 *
 * 归因（S3-144 B/C 定案）：平台侧开租户**不是**邀请码注册的归因宿主（原本也非生产在用通道），
 * `source` 固定 'MANUAL'，本函数不写 t_tenant_attribution。
 */
export async function createTenant(data: {
  tenantName: string;
  contactName: string;
  contactMobile: string;
  contactEmail?: string;
  adminUsername: string;
  adminPassword: string;
  expireAt?: string | null;
}): Promise<string> {
  const tenantId = randomUUID();
  const tenantCode = makeBizNo("T");

  const hashedPassword = await hashPassword(data.adminPassword);

  // S3-183（收口总清单第 18 项）：开通链路必须**原子地**产出「租户 + 首个管理员 + 角色/菜单 + 管理员绑定」，
  // 否则中途失败只留下一半，正是"能登录但功能中心空白"的坏租户（本单要修的现象）。
  await transaction(async (conn) => {
    const run: SqlRunner = (sql, params) => conn.query(sql, params as never);

    await conn.query(
      `INSERT INTO t_tenant (
         id, tenant_code, name, tenant_name, company_name, company_short_name,
         contact_name, contact_person, contact_mobile, contact_email,
         source, status, expire_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', 1, ?)`,
      [
        tenantId, tenantCode, data.tenantName, data.tenantName, data.tenantName, data.tenantName,
        data.contactName, data.contactName, data.contactMobile, data.contactEmail || "",
        data.expireAt || null,
      ] as never
    );

    // t_sys_user.status 是 TINYINT（1=正常），原实现写 'ACTIVE' 字符串在严格模式会 1366 —— 一并按数值落库
    const [userResult] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_sys_user (tenant_id, username, password_hash, real_name, mobile, status, role)
       VALUES (?, ?, ?, ?, ?, 1, 'ADMIN')`,
      [tenantId, data.adminUsername, hashedPassword, data.contactName, data.contactMobile]
    );

    // 克隆角色 + 菜单（照 197 口径），再把该租户首个管理员绑到**本租户自己的** SUPER_ADMIN 角色行
    await provisionTenantRbac(run, tenantId);
    await bindTenantAdminToOwnSuperAdmin(run, tenantId, Number(userResult.insertId));
  });

  return tenantId;
}

// ============ 更新租户 ============
export async function updateTenant(id: string, data: {
  tenantName?: string;
  contactName?: string;
  contactMobile?: string;
  contactEmail?: string;
  expireAt?: string | null;
}): Promise<void> {
  const existing = await queryOne<IdRow>("SELECT id FROM t_tenant WHERE id = ?", [id]);
  if (!existing) {
    throw Object.assign(new Error("租户不存在"), { statusCode: 404 });
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.tenantName !== undefined) { sets.push("tenant_name = ?"); params.push(data.tenantName); }
  if (data.contactName !== undefined) { sets.push("contact_name = ?"); params.push(data.contactName); }
  if (data.contactMobile !== undefined) { sets.push("contact_mobile = ?"); params.push(data.contactMobile); }
  if (data.contactEmail !== undefined) { sets.push("contact_email = ?"); params.push(data.contactEmail); }
  if (data.expireAt !== undefined) { sets.push("expire_at = ?"); params.push(data.expireAt); }

  if (sets.length > 0) {
    params.push(id);
    await query(`UPDATE t_tenant SET ${sets.join(", ")} WHERE id = ?`, params);
  }
}

// ============ 启用/禁用租户 ============
/**
 * TOTAL-TENANT-TOGGLE-AUDIT-TRAIL-01：租户启停的**活路径**统一入口（控制器
 * POST /api/platform/tenants/:id/toggle → 本函数）。成功 / 业务失败
 * （无效状态 400 / 未知租户 404）/ 重复提交四类结果全部经
 * `recordTenantToggleAudit`（唯一审计写入口）留痕；RBAC 403 的 REJECTED 行
 * 由中央守卫的 PERMISSION_DENIED 留痕承担（同一设施同一表，detail.result=REJECTED）。
 *
 * - 审计上下文 `auditCtx` 由控制器注入（操作者/来源/traceId）；缺省（直调兜底）按
 *   system/traceId 自生成补齐 —— 生产入口（控制器）恒传，任何路径都不漏痕。
 * - 审计写失败不阻断、不回滚已生效 toggle（统一入口内 catch + error 日志 + 计数）。
 * - 响应契约不变：返回对外字符串口径 status；400/404 语义与文案同旧实现。
 */
export async function toggleTenantStatus(
  id: string,
  status: TenantStatus,
  auditCtx?: TenantToggleAuditContext
): Promise<TenantStatus> {
  const ctx: TenantToggleAuditContext = auditCtx ?? {
    operatorId: 0,
    operatorName: "",
    source: "system",
    traceId: randomUUID(),
  };

  // API 契约（旧控制器前置校验同义）：仅接受字面 "ACTIVE"/"DISABLED"，其余一律 400
  const statusValue = status === "ACTIVE" ? 1 : status === "DISABLED" ? 0 : null;
  if (statusValue === null) {
    await recordTenantToggleAudit({
      operatorId: ctx.operatorId,
      operatorName: ctx.operatorName,
      targetTenantId: id,
      fromStatus: null,
      toStatus: String(status ?? ""),
      result: "FAILED",
      failReason: "invalid_status(400)",
      source: ctx.source,
      traceId: ctx.traceId,
      ip: ctx.ip,
    });
    throw new AppError("无效的状态值", 400);
  }

  // 留痕前置读：取目标租户名与 fromStatus（未知租户先行 404，语义与旧实现一致）
  const before = await queryOne<{ tenantName: string | null; status: number | string | null }>(
    "SELECT tenant_name AS tenantName, status FROM t_tenant WHERE id = ?",
    [id]
  );
  if (!before) {
    await recordTenantToggleAudit({
      operatorId: ctx.operatorId,
      operatorName: ctx.operatorName,
      targetTenantId: id,
      fromStatus: null,
      toStatus: status,
      result: "FAILED",
      failReason: "tenant_not_found(404)",
      source: ctx.source,
      traceId: ctx.traceId,
      ip: ctx.ip,
    });
    throw new AppError("租户不存在", 404);
  }
  const fromStatus = toTenantStatus(before.status);

  const raw = await query<{ affectedRows: number }>(
    "UPDATE t_tenant SET status = ? WHERE id = ?",
    [statusValue, id]
  );
  // 真实库（mysql2）写操作返回 ResultSetHeader 对象；mock 模式的 query 统一包成数组 —— 两种都兼容
  const result = (Array.isArray(raw) ? raw[0] : raw) as { affectedRows?: number } | undefined;

  // S3-65 教训：affectedRows=0 不得当成功返回，按「租户不存在」处理
  if (!result || Number(result.affectedRows || 0) === 0) {
    await recordTenantToggleAudit({
      operatorId: ctx.operatorId,
      operatorName: ctx.operatorName,
      targetTenantId: id,
      targetTenantName: before.tenantName ?? null,
      fromStatus,
      toStatus: status,
      result: "FAILED",
      failReason: "tenant_not_found(404)",
      source: ctx.source,
      traceId: ctx.traceId,
      ip: ctx.ip,
    });
    throw new AppError("租户不存在", 404);
  }

  // 回读：以库内真实值为准（不凭入参臆断），出口统一字符串口径
  const row = await queryOne<{ status: number | string | null }>(
    "SELECT status FROM t_tenant WHERE id = ?",
    [id]
  );
  if (!row) {
    await recordTenantToggleAudit({
      operatorId: ctx.operatorId,
      operatorName: ctx.operatorName,
      targetTenantId: id,
      targetTenantName: before.tenantName ?? null,
      fromStatus,
      toStatus: null,
      result: "FAILED",
      failReason: "tenant_not_found(404)",
      source: ctx.source,
      traceId: ctx.traceId,
      ip: ctx.ip,
    });
    throw new AppError("租户不存在", 404);
  }
  const toStatus = toTenantStatus(row.status);

  // 成功留痕（含重复提交标记：目标状态与切换前一致 ⇒ no-op 重复提交，仍按成功口径返回）
  await recordTenantToggleAudit({
    operatorId: ctx.operatorId,
    operatorName: ctx.operatorName,
    targetTenantId: id,
    targetTenantName: before.tenantName ?? null,
    fromStatus,
    toStatus,
    result: "SUCCESS",
    duplicate: fromStatus === toStatus,
    source: ctx.source,
    traceId: ctx.traceId,
    ip: ctx.ip,
  });
  return toStatus;
}
