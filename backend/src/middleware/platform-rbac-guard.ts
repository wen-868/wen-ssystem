/**
 * 平台侧 RBAC 中央守卫（TOTAL-PLATFORM-SERVER-SIDE-RBAC-01 · P0-1）
 *
 * ── 背景与审计事实（任务卡 §二）────────────────────────────────────────────
 *   · SUPPORT 合法体创建租户曾返回 HTTP 200 并落库 t_tenant + t_sys_user；
 *   · SUPPORT 调租户 toggle、敏感 sysconfig 读曾返回 HTTP 200；
 *   · 平台路由此前主要仅挂 requirePlatformAuth（JWT type=platform_admin 即放行），
 *     S3-193 的 requirePlatformPermission 只试点接了 5 个文件 ⇒ 其余 platform 写/敏感读
 *     端点对任何平台管理员（含 SUPPORT）无 role/module 强校验。
 *
 * ── 单一权限矩阵（真源，禁止逐路由散写角色字符串）─────────────────────────
 *   本文件是「角色 → 可读域」矩阵的唯一载体（PLATFORM_ROLE_READ_MATRIX）：
 *     · 超管口径：PLATFORM_SUPER_ROLES = { PLATFORM_SUPER_ADMIN, SUPER_ADMIN }（复用
 *       platform-rbac.ts 既有常量，两处同源不复制）⇒ 全通（读写皆放行）；
 *     · SUPPORT（t_platform_admin.role='SUPPORT' → 角色码 'support'）：仅
 *       dashboard / tenant / billing / monitor / ticket 五域 **GET/HEAD 只读**；
 *     · 其余非超管角色：矩阵未登记 ⇒ 全拒（fail-closed，无静默豁免）；
 *     · 非超管的一切 POST/PUT/PATCH/DELETE：**默认拒绝**（写 fail-closed，仅超管）；
 *     · 敏感读（SENSITIVE_READ_DOMAINS：sysconfig、管理员权限、AI 配置/计费、open
 *       平台、error-logs）：即便未来某角色被授予更大读面也**仅超管**（显式清单压在
 *       白名单判定之前，防白名单扩大时静默放敏）。
 *   未在矩阵登记的域 = 拒绝面（deny-by-default），新增域不需要改本文件即默认收紧；
 *   要给某角色开读面，必须在 PLATFORM_ROLE_READ_MATRIX 显式登记一行（可评审）。
 *
 * ── 挂载（认证/CSRF/rate-limit 顺序不回退）────────────────────────────────
 *   挂载点在 `auto-routes.setupRoutes`：凡 `routeConfig.auth === "requirePlatformAuth"`
 *   的路由，按 `app.use(prefix, requirePlatformAuth, csrfMiddleware, <本守卫>, router)`
 *   注册 —— 守卫必然晚于平台认证与 CSRF（rate-limit 是路由内联中间件，位于守卫之后，
 *   仅作用于已放行请求，顺序语义不变）。`getAuthMiddlewares()` 本身不动（既有契约
 *   `middleware.length === 2` 由 auto-routes.test.ts 冻结，属本卡允许路径之外）。
 *   注：`platform-auth.routes.ts`（登录）auth="none"、`platform-miniapp.routes.ts`
 *   （公开套餐页）auth="none" ⇒ 不经过本守卫，公开面不变。
 *
 * ── 403 结构与留痕 ────────────────────────────────────────────────────────
 *   · 拒绝统一 `shared/response.fail()` 结构：{ code:"403", msg, traceId }（traceId 为
 *     响应体自带，uuid 每请求新生）；
 *   · 每次拒绝写 `t_platform_audit_log`（既有 insertPlatformAuditLog 设施，复用
 *     S3-193 的 PERMISSION_DENIED 口径）：action=PERMISSION_DENIED、module=权限域、
 *     detail 带 permKind / domain / method / path / reason / traceId；留痕失败只记
 *     warn 日志，不改变 403 响应（与 platform-rbac.ts 同口径）。
 *
 * ── 不削弱既有机制 ────────────────────────────────────────────────────────
 *   · 本守卫只**新增**拒绝面：S3-193 试点端点上的内联 requirePlatformPermission
 *     照常执行（守卫在前，端点级粒度判定在后，两层都过才放行）；
 *   · 租户侧中间件（requireAuthWithTenant / tenant 隔离）零改动；
 *   · DB 异常 ⇒ fail-closed 403（check_error），不放过、不 500。
 */
import type { RequestHandler } from "express";
import { queryOne } from "../shared/db";
import { fail } from "../shared/response";
import logger from "../shared/logger";
import { insertPlatformAuditLog } from "../services/admin/platform-audit-log.service";
import { isPlatformSuperRole, normalizePlatformRoleCode } from "./platform-rbac";
import type { AuthUser } from "./auth";

/** 平台管理员角色行（t_platform_admin.role） */
interface PlatformAdminRoleRow {
  role: string | null;
}

/** 平台 URL 第一段 → 权限域别名（非别名段 = 段名即域，deny-by-default） */
const PATH_DOMAIN_ALIASES: Readonly<Record<string, string>> = {
  tenants: "tenant",
  // 平台总览（platform.routes.ts 挂在 /api/platform 根）归大盘只读面
  overview: "dashboard",
  // 工单（platform-ticket.routes.ts 挂在 /api/platform/support）
  support: "ticket",
  // 全局系统配置（platform-config.routes.ts）
  config: "sysconfig",
  // 管理员权限三前缀（platform-role.routes.ts + platform.routes.ts 的 /admins 系）
  admins: "platform-admin",
  roles: "platform-admin",
  permissions: "platform-admin",
  // 错误日志（platform-error-log.routes.ts 挂在 /api/platform 根下）
  "error-logs": "errorlog",
  "error-report": "errorlog",
};

/**
 * 敏感读域（仅超管，任务卡 §五.5 最低清单）：
 *   sysconfig（全局系统配置）、platform-admin（管理员权限 / 角色矩阵 / 权限点目录）、
 *   ai（AI 能力管控）、ai-billing（AI 计费）、open（开放平台 api-keys/webhooks）、
 *   errorlog（平台错误日志）。
 */
export const SENSITIVE_READ_DOMAINS: ReadonlySet<string> = new Set([
  "sysconfig",
  "platform-admin",
  "ai",
  "ai-billing",
  "open",
  "errorlog",
]);

/** 单条角色只读授予：角色码（= lower(t_platform_admin.role)）→ 可读域清单 */
export interface PlatformRoleReadGrant {
  roleCode: string;
  readDomains: readonly string[];
}

/**
 * 角色只读矩阵（**单一真源**）。任务卡 §五.3：SUPPORT 只保留
 * dashboard / tenant / billing / monitor / ticket 五域只读。
 * 未登记角色 = 全拒；未登记域 = 拒绝；写 = 仅超管。
 */
export const PLATFORM_ROLE_READ_MATRIX: readonly PlatformRoleReadGrant[] = [
  {
    roleCode: "support",
    readDomains: ["dashboard", "tenant", "billing", "monitor", "ticket"],
  },
];

/** 惰性求值缓存（模块内一次性构建；矩阵是常量，无需每次请求重建） */
let roleGrantIndex: Map<string, ReadonlySet<string>> | null = null;
function getRoleGrantIndex(): Map<string, ReadonlySet<string>> {
  if (!roleGrantIndex) {
    roleGrantIndex = new Map(
      PLATFORM_ROLE_READ_MATRIX.map((grant) => [grant.roleCode, new Set(grant.readDomains)])
    );
  }
  return roleGrantIndex;
}

/**
 * 请求路径 → 权限域。
 *   /api/platform/<seg>/*  → seg 的别名或段名本身；/api/platform 根（overview）→ dashboard；
 *   /api/saas/*            → "saas"（SaaS 层平台面，非白名单域）；
 *   /api/padmin/*          → "padmin"（App 版本管理，非白名单域）；
 *   /api/admin/*           → "admin"（保险面：极少数 requirePlatformAuth 挂在 admin 前缀）；
 *   其余                    → "other"。
 * 判定只看**路径形态**（method × domain），不做逐端点枚举 —— 新增端点自动落入
 * 所在域的既有判定，不会因为"忘了接线"而敞开。
 */
export function resolvePlatformDomain(url: string): string {
  const pathname = String(url ?? "").split("?")[0];
  const segAfter = (base: string): string => {
    if (pathname === base || pathname === `${base}/`) return "";
    if (!pathname.startsWith(`${base}/`)) return "";
    return pathname.slice(base.length + 1).split("/")[0];
  };
  const seg = segAfter("/api/platform");
  if (pathname.startsWith("/api/platform")) {
    if (seg === "") return "dashboard"; // /api/platform、/api/platform/overview（平台总览）
    return PATH_DOMAIN_ALIASES[seg] ?? seg;
  }
  if (pathname.startsWith("/api/saas/")) return "saas";
  if (pathname.startsWith("/api/padmin")) return "padmin";
  if (pathname.startsWith("/api/admin/")) return "admin";
  return "other";
}

/** 读方法：GET/HEAD（带幂等语义的安全方法）；OPTIONS 预检在守卫入口直接放行 */
function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export type PlatformGuardReason =
  | "super"
  | "whitelist_read"
  | "no_user"
  | "no_admin_role"
  | "role_not_granted"
  | "domain_not_whitelisted"
  | "sensitive_read"
  | "write_fail_closed"
  | "check_error";

export interface PlatformGuardDecision {
  allow: boolean;
  reason: PlatformGuardReason;
  /** 403 文案（allow=true 时为空串） */
  message: string;
  /** 命中的权限域（审计/日志用） */
  domain: string;
  roleCode?: string;
}

/**
 * 中央判定（纯函数式，不含 HTTP）：可被单测直接调用。
 * 任何异常收敛为 check_error + allow=false（fail-closed），不向调用方抛错。
 */
export async function checkPlatformAccess(
  adminId: number,
  method: string,
  url: string
): Promise<PlatformGuardDecision> {
  const domain = resolvePlatformDomain(url);
  const deny = (reason: PlatformGuardReason, message: string, roleCode?: string) => ({
    allow: false as const,
    reason,
    message,
    domain,
    roleCode,
  });
  try {
    const admin = await queryOne<PlatformAdminRoleRow>(
      "SELECT role FROM t_platform_admin WHERE id = ?",
      [adminId]
    );

    if (isPlatformSuperRole(admin?.role)) {
      return { allow: true, reason: "super", message: "", domain };
    }

    const roleCode = normalizePlatformRoleCode(admin?.role);
    if (!roleCode) {
      return deny(
        "no_admin_role",
        `未分配平台角色，已拒绝（域: ${domain}）`
      );
    }

    // 敏感读压在白名单判定之前：即便未来白名单扩域，敏感读也只可能是超管
    if (isReadMethod(method) && SENSITIVE_READ_DOMAINS.has(domain)) {
      return deny(
        "sensitive_read",
        `敏感数据仅平台超管可读（域: ${domain}）`,
        roleCode
      );
    }

    if (isReadMethod(method)) {
      const grant = getRoleGrantIndex().get(roleCode);
      if (!grant) {
        return deny(
          "role_not_granted",
          `平台角色未授予只读面（角色: ${roleCode}，域: ${domain}）`,
          roleCode
        );
      }
      if (grant.has(domain)) {
        return { allow: true, reason: "whitelist_read", message: "", domain, roleCode };
      }
      return deny(
        "domain_not_whitelisted",
        `只读白名单不含该域（角色: ${roleCode}，域: ${domain}）`,
        roleCode
      );
    }

    // 一切写方法（POST/PUT/PATCH/DELETE…）：fail-closed，仅超管
    return deny("write_fail_closed", "平台写操作仅平台超管可执行", roleCode);
  } catch (error) {
    logger.error(
      `[platform-rbac-guard] 权限校验失败（fail-closed，已拒绝）：adminId=${adminId} ` +
        `method=${method} url=${url} err=${error instanceof Error ? error.message : String(error)}`
    );
    return deny("check_error", "权限校验失败，已按拒绝处理");
  }
}

/** 拒绝留痕（失败只记日志，不影响 403 响应；traceId 取自响应体，可回查） */
async function auditGuardDenied(
  req: { ip?: string; method?: string; originalUrl?: string; path?: string },
  user: AuthUser,
  decision: PlatformGuardDecision,
  traceId: string
): Promise<void> {
  try {
    await insertPlatformAuditLog({
      adminId: Number(user.id),
      adminName: String(user.username ?? user.realName ?? ""),
      module: decision.domain,
      action: "PERMISSION_DENIED",
      auditType: "PERMISSION_DENIED",
      description: `权限拒绝（平台守卫）：${decision.reason}`,
      targetType: "platform_permission",
      targetId: decision.domain,
      ip: req.ip ?? null,
      detail: {
        permKind: "platform-guard",
        domain: decision.domain,
        reason: decision.reason,
        roleCode: decision.roleCode ?? null,
        method: req.method ?? null,
        path: req.originalUrl ?? req.path ?? null,
        traceId,
      },
    });
  } catch (error) {
    logger.warn(
      `[platform-rbac-guard] 拒绝留痕写入失败（不影响 403）：adminId=${user.id} ` +
        `domain=${decision.domain} err=${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 平台 RBAC 中央守卫。
 *
 * 挂载位置：`auto-routes.setupRoutes` 对 `auth === "requirePlatformAuth"` 的路由
 * 按 `app.use(prefix, requirePlatformAuth, csrfMiddleware, platformAccessGuard(), router)`
 * 注册 ⇒ 必然晚于平台认证与 CSRF；路由内联的 rate-limit / 端点级
 * requirePlatformPermission 在其之后照常执行，顺序语义不回退。
 */
export function platformAccessGuard(): RequestHandler {
  return (req, res, next) => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    // CORS 预检不带副作用也无凭据语义，交回既有链路处理
    if (req.method === "OPTIONS") {
      next();
      return;
    }

    void checkPlatformAccess(Number(user.id), req.method, req.originalUrl ?? req.path ?? "")
      .then(async (decision) => {
        if (decision.allow) {
          next();
          return;
        }
        logger.warn(
          `[platform-rbac-guard] 拒绝 adminId=${user.id} domain=${decision.domain} ` +
            `reason=${decision.reason} ${req.method} ${req.originalUrl ?? req.path ?? ""}`
        );
        const body = fail(decision.message, "403");
        await auditGuardDenied(req, user, decision, String(body.traceId));
        res.status(403).json(body);
      })
      .catch((error) => {
        // checkPlatformAccess 自身已 fail-closed；能到这里说明响应环节异常 ⇒ 同样拒绝，不回 500 假绿
        logger.error(
          `[platform-rbac-guard] 守卫异常（已拒绝）：adminId=${user.id} ` +
            `err=${error instanceof Error ? error.message : String(error)}`
        );
        res.status(403).json(fail("权限校验失败，已按拒绝处理", "403"));
      });
  };
}
