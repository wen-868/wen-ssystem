/**
 * 平台侧 RBAC 机制（S3-193：平台端点权限中间件 + 端点级权限码）
 *
 * ── 背景（S3-185 实测，收口总清单第 50 项）────────────────────────────────────
 *   · 29 个 `platform*.routes.ts` 共 **105 个写端点**，`requirePermission` 命中 **0**；
 *   · 平台侧唯一鉴权是 `requirePlatformAuth`（middleware/auth.ts），只校验 JWT
 *     `type === "platform_admin"` ⇒ 任何平台管理员都能做任何事，**没有权限粒度**；
 *   · 平台 JWT（`signPlatformToken`）**不携带 roles**，因此租户侧的 `requirePermission`
 *     （读 `user.roles` + `t_sys_role`）在平台域**不可复用**（`user.roles` 为 undefined 会直接抛错）。
 *   ⇒ 这不是"漏挂几处"，是**机制缺失**；本文件即该机制的唯一定点。
 *
 * ── 权限数据来源（零 DDL：全部读既有表）──────────────────────────────────────
 *   · `t_platform_admin.role`（粗粒度角色，080/081 种子；生产唯一管理员 = PLATFORM_SUPER_ADMIN）
 *   · `t_platform_role`（迁移 179，平台角色主表：code 唯一、enabled 启停）
 *   · `t_platform_role_permission`（迁移 179，角色 × 功能域矩阵：can_menu / can_page_btn / data_scope）
 *   绑定口径：`lower(t_platform_admin.role)` = `t_platform_role.code`
 *   （例：`PLATFORM_ADMIN` → 角色码 `platform_admin`；`SUPPORT` → `support`）。
 *   ⚠️ 一个管理员当前只绑一个平台角色（与既有 role 列一一对应）。独立绑定表（多角色 /
 *      管理员级权限）属**后继单**，不在本单范围。
 *
 * ── 判据（逐条可核对）───────────────────────────────────────────────────────
 *   · **全通**：`t_platform_admin.role ∈ {PLATFORM_SUPER_ADMIN, SUPER_ADMIN}` ⇒ 放行
 *     （派单卡 §二.1 给定口径："SUPER_ADMIN 视为全通"；两套写法都兼容，见 PLATFORM_SUPER_ROLES）；
 *   · 读码（`:view`，对应目录 MENU 级）⇒ 需该域 `can_menu = 1`；
 *   · 写码（`:manage`，本单新增的端点级码）⇒ 需该域 `can_page_btn = 1`；
 *   · 未绑定 / 角色未建 / 矩阵未配 / 矩阵未命中 ⇒ **403**（不是 401，也不回 500）；
 *   · DB 异常 ⇒ 记 error 日志 ⇒ **403（fail-closed）**：授权判定失败一律不放过。
 *
 * ── 审计留痕 ────────────────────────────────────────────────────────────────
 *   每一次拒绝都写 `t_platform_audit_log`（action=`PERMISSION_DENIED`、module=权限域、
 *   detail 带 permCode / HTTP 方法 / 请求路径 / 拒因）。留痕失败只记日志，不改变 403 响应。
 *
 * ── 与既有鉴权的关系（红线：不许放宽）───────────────────────────────────────
 *   本机制只**新增**校验，不放宽任何既有鉴权。未绑定管理员按"收紧"处理（403），S3-193
 *   试点域的生产影响面 = 0（生产 `t_platform_admin` 仅 1 行且为超管，见回执 §一.1 证据）；
 *   过渡期口径与"独立绑定表"两项**待凌舟裁定**，改动点集中在本文件，可单点回退。
 */
import type { RequestHandler } from "express";
import { queryOne } from "../shared/db";
import { fail } from "../shared/response";
import logger from "../shared/logger";
import { insertPlatformAuditLog } from "../services/admin/platform-audit-log.service";
import { PERMISSION_CATALOG } from "../services/platform/platform-role.service";
import type { AuthUser } from "./auth";

/** 平台超管口径（`t_platform_admin.role` 的「全通」取值） */
export const PLATFORM_SUPER_ROLES: readonly string[] = ["PLATFORM_SUPER_ADMIN", "SUPER_ADMIN"];

/** 权限级别：READ=菜单级可见（目录 MENU 码），WRITE=写操作（本单新增的 `:manage` 码） */
export type PlatformPermissionLevel = "READ" | "WRITE";

export interface PlatformPermissionSpec {
  /** 权限码本身（如 `sysconfig:manage`） */
  permCode: string;
  /** 该码对应的功能域（= `t_platform_role_permission.module_code`） */
  moduleCode: string;
  level: PlatformPermissionLevel;
  /** 是否已存在于既有权限点目录（`PERMISSION_CATALOG`）；false ⇒ 需先扩目录才能被授予 */
  catalogReady: boolean;
}

/**
 * 端点级**写**权限码（本单新增）——一域一码，不按端点数 1:1 建码。
 *
 * 为什么不是 105 个码：105 个端点里大量是同域同语义的 CRUD（如商品库 15 条、
 * 开放平台 10 条），按端点建码会让角色矩阵碎片化到无法配置；粒度取"功能域 × 读写"，
 * 与迁移 179 的矩阵结构（`module_code` + can_menu/can_page_btn）天然对齐。
 *
 * `catalogReady` **不手写**，一律派生自平台侧目录 `PERMISSION_CATALOG`（见下 CATALOG_MODULE_CODES）：
 * 域不在目录内 ⇒ 现在建了码也无法在矩阵里授予（`updateRolePermissions()` 对目录外域直接 400）。
 * S3-219（收口总清单第 67 项）已把 library / open / review 3 个域扩进平台侧目录 ⇒ 对应写码
 * `catalogReady` 自动为 true；miniapp 域仍在目录外（其端点按豁免登记，本单未接线）。
 * 为什么不继续手写布尔值：手写值与目录是两份真相，改了一处漏改另一处就会出现
 * "码已接线但永远无法被授予"的静默失效（S3-219 之前 library/open/review 正是这个状态）。
 */
const PLATFORM_WRITE_CODES: ReadonlyArray<{ code: string; moduleCode: string }> = [
  { code: "tenant:manage", moduleCode: "tenant" },
  { code: "billing:manage", moduleCode: "billing" },
  { code: "sysconfig:manage", moduleCode: "sysconfig" },
  { code: "monitor:manage", moduleCode: "monitor" },
  { code: "marketing:manage", moduleCode: "marketing" },
  { code: "library:manage", moduleCode: "library" },
  { code: "open:manage", moduleCode: "open" },
  { code: "review:manage", moduleCode: "review" },
  { code: "miniapp:manage", moduleCode: "miniapp" },
];

/** 平台侧目录里已登记的功能域集合（`catalogReady` 的唯一判据；与 platform-role.service 同源） */
const CATALOG_MODULE_CODES: ReadonlySet<string> = new Set(
  PERMISSION_CATALOG.map((entry) => entry.moduleCode)
);

/**
 * 平台端点级权限点总表（写码 + 既有目录里的 MENU 读码）。
 * 读码**派生自 `PERMISSION_CATALOG`**（单一真相源，不复制字面量）：凡 permLevel='MENU'
 * 的目录条目即一个可用的 `<module>:view` 读码。
 */
export const PLATFORM_PERMISSIONS: ReadonlyMap<string, PlatformPermissionSpec> = (() => {
  const map = new Map<string, PlatformPermissionSpec>();
  for (const entry of PERMISSION_CATALOG) {
    if (entry.permLevel !== "MENU") continue;
    map.set(entry.permCode, {
      permCode: entry.permCode,
      moduleCode: entry.moduleCode,
      level: "READ",
      catalogReady: true,
    });
  }
  for (const item of PLATFORM_WRITE_CODES) {
    map.set(item.code, {
      permCode: item.code,
      moduleCode: item.moduleCode,
      level: "WRITE",
      catalogReady: CATALOG_MODULE_CODES.has(item.moduleCode),
    });
  }
  return map;
})();

/** 权限码是否已登记（供台账/测试做一致性核对） */
export function isRegisteredPlatformPermission(permCode: string): boolean {
  return PLATFORM_PERMISSIONS.has(permCode);
}

/** 取权限码定义；未登记 ⇒ 抛错（在**路由注册期**就炸，避免拼错码静默失效） */
export function resolvePlatformPermission(permCode: string): PlatformPermissionSpec {
  const spec = PLATFORM_PERMISSIONS.get(permCode);
  if (!spec) {
    throw new Error(
      `未登记的平台权限码：${permCode}（请先在 middleware/platform-rbac.ts 的权限点总表里登记）`
    );
  }
  return spec;
}

/** `t_platform_admin.role` 是否属于「全通」超管口径 */
export function isPlatformSuperRole(role: unknown): boolean {
  const value = String(role ?? "").trim().toUpperCase();
  return PLATFORM_SUPER_ROLES.includes(value);
}

/**
 * 粗粒度角色 → 平台角色码：小写化后必须满足 `t_platform_role.code` 的既有约束
 * （`^[a-z][a-z0-9_]{1,31}$`，见 platform-role.service.ROLE_CODE_PATTERN）。
 * 不满足 ⇒ null（无法绑定，按未分配处理）。
 */
export function normalizePlatformRoleCode(role: unknown): string | null {
  const code = String(role ?? "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(code)) return null;
  return code;
}

export type PlatformPermissionReason =
  | "super"
  | "matrix_allow"
  | "no_admin_role"
  | "role_not_configured"
  | "matrix_missing"
  | "matrix_deny"
  | "check_error";

export interface PlatformPermissionDecision {
  allow: boolean;
  reason: PlatformPermissionReason;
  /** 403 响应文案（allow=true 时为空串） */
  message: string;
  /** 审计 detail 用的补充信息 */
  roleCode?: string;
}

interface PlatformAdminRoleRow {
  role: string | null;
}

interface PlatformRoleRow {
  id: number;
  code: string;
}

interface PlatformMatrixRow {
  canMenu: number | string | null;
  canPageBtn: number | string | null;
}

/**
 * 权限判定（纯查询，不含 HTTP）：可被单测直接调用。
 * 任何异常都收敛为 `check_error` + allow=false（fail-closed），不向调用方抛错。
 */
export async function checkPlatformPermission(
  adminId: number,
  spec: PlatformPermissionSpec
): Promise<PlatformPermissionDecision> {
  try {
    const admin = await queryOne<PlatformAdminRoleRow>(
      "SELECT role FROM t_platform_admin WHERE id = ?",
      [adminId]
    );

    if (isPlatformSuperRole(admin?.role)) {
      return { allow: true, reason: "super", message: "" };
    }

    const roleCode = normalizePlatformRoleCode(admin?.role);
    if (!roleCode) {
      return {
        allow: false,
        reason: "no_admin_role",
        message: `未分配平台角色，已拒绝（需要权限: ${spec.permCode}）`,
      };
    }

    const role = await queryOne<PlatformRoleRow>(
      "SELECT id, code FROM t_platform_role WHERE code = ? AND enabled = 1",
      [roleCode]
    );
    if (!role) {
      return {
        allow: false,
        reason: "role_not_configured",
        message: `平台角色未配置：${roleCode}（需要权限: ${spec.permCode}）`,
        roleCode,
      };
    }

    const cell = await queryOne<PlatformMatrixRow>(
      `SELECT can_menu AS canMenu, can_page_btn AS canPageBtn
         FROM t_platform_role_permission WHERE role_id = ? AND module_code = ?`,
      [Number(role.id), spec.moduleCode]
    );
    if (!cell) {
      return {
        allow: false,
        reason: "matrix_missing",
        message: `平台角色 ${roleCode} 未配置「${spec.moduleCode}」域权限（需要权限: ${spec.permCode}）`,
        roleCode,
      };
    }

    const granted =
      spec.level === "READ" ? Number(cell.canMenu) === 1 : Number(cell.canPageBtn) === 1;
    if (granted) {
      return { allow: true, reason: "matrix_allow", message: "", roleCode };
    }
    return {
      allow: false,
      reason: "matrix_deny",
      message: `无权限执行此操作，需要权限: ${spec.permCode}`,
      roleCode,
    };
  } catch (error) {
    logger.error(
      `[platform-rbac] 权限校验失败（fail-closed，已拒绝）：adminId=${adminId} code=${spec.permCode} ` +
        `err=${error instanceof Error ? error.message : String(error)}`
    );
    return {
      allow: false,
      reason: "check_error",
      message: `权限校验失败，已按拒绝处理（需要权限: ${spec.permCode}）`,
    };
  }
}

/** 拒绝留痕（失败只记日志，不影响 403 响应） */
async function auditDenied(
  req: { ip?: string; method?: string; originalUrl?: string; path?: string },
  user: AuthUser,
  spec: PlatformPermissionSpec,
  decision: PlatformPermissionDecision
): Promise<void> {
  try {
    await insertPlatformAuditLog({
      adminId: Number(user.id),
      adminName: String(user.username ?? user.realName ?? ""),
      module: spec.moduleCode,
      action: "PERMISSION_DENIED",
      auditType: "PERMISSION_DENIED",
      description: `权限拒绝：${spec.permCode}`,
      targetType: "platform_permission",
      targetId: spec.permCode,
      ip: req.ip ?? null,
      detail: {
        permCode: spec.permCode,
        level: spec.level,
        reason: decision.reason,
        roleCode: decision.roleCode ?? null,
        method: req.method ?? null,
        path: req.originalUrl ?? req.path ?? null,
      },
    });
  } catch (error) {
    logger.warn(
      `[platform-rbac] 拒绝留痕写入失败（不影响 403）：adminId=${user.id} code=${spec.permCode} ` +
        `err=${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 平台端点权限中间件。
 *
 * 挂载位置：**必须在 `requirePlatformAuth` 之后**。平台路由由 `routeConfig.auth="requirePlatformAuth"`
 * 声明式挂载（`auto-routes.getAuthMiddlewares` 会一并挂 `csrfMiddleware`），本中间件在端点内联挂载
 * ⇒ 结构上必然晚于这两者（端点中间件在 router 之后执行）。
 *
 * @param permCode 平台权限码（如 `sysconfig:manage`）；未登记 ⇒ 注册期抛错
 */
export function requirePlatformPermission(permCode: string): RequestHandler {
  const spec = resolvePlatformPermission(permCode);
  return (req, res, next) => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }

    void checkPlatformPermission(Number(user.id), spec)
      .then(async (decision) => {
        if (decision.allow) {
          next();
          return;
        }
        logger.warn(
          `[platform-rbac] 拒绝 adminId=${user.id} code=${permCode} reason=${decision.reason} ` +
            `${req.method} ${req.originalUrl ?? req.path ?? ""}`
        );
        await auditDenied(req, user, spec, decision);
        res.status(403).json(fail(decision.message, "403"));
      })
      .catch((error) => {
        // checkPlatformPermission 自身已 fail-closed；能走到这里说明响应环节异常 ⇒ 同样拒绝，不回 500 假绿
        logger.error(
          `[platform-rbac] 中间件异常（已拒绝）：adminId=${user.id} code=${permCode} ` +
            `err=${error instanceof Error ? error.message : String(error)}`
        );
        res.status(403).json(fail(`权限校验失败，已按拒绝处理（需要权限: ${permCode}）`, "403"));
      });
  };
}
