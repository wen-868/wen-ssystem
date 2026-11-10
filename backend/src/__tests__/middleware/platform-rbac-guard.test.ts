/**
 * TOTAL-PLATFORM-SERVER-SIDE-RBAC-01 · 平台 RBAC 中央守卫单测
 * （middleware/platform-rbac-guard.ts）
 *
 * 覆盖判据（与任务卡 §五/§七逐条对应）：
 *   ① 域解析：/api/platform 根→dashboard、tenants→tenant、support→ticket、
 *     config→sysconfig、admins|roles|permissions→platform-admin、error-logs→errorlog、
 *     /api/saas→saas、/api/padmin→padmin；
 *   ② 超管口径（PLATFORM_SUPER_ADMIN / SUPER_ADMIN）⇒ 全通，且不查角色矩阵；
 *   ③ SUPPORT 五域只读白名单（dashboard/tenant/billing/monitor/ticket）GET 放行；
 *   ④ SUPPORT 写（POST/PUT/PATCH/DELETE）⇒ fail-closed 拒绝；
 *   ⑤ 敏感读（sysconfig/platform-admin/ai/ai-billing/open/errorlog）⇒ 仅超管；
 *   ⑥ 非白名单域读 ⇒ 拒绝；未登记角色 ⇒ 拒绝；role 空 ⇒ 拒绝；
 *   ⑦ DB 异常 ⇒ check_error fail-closed；
 *   ⑧ 中间件：无 user ⇒ 401；拒绝 ⇒ 403（fail 结构带 traceId）+ 审计留痕；
 *     留痕失败不影响 403；OPTIONS 预检放行。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

const hoisted = vi.hoisted(() => ({
  queryOne: vi.fn(),
  insertPlatformAuditLog: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: vi.fn(),
  queryOne: hoisted.queryOne,
  queryWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../services/admin/platform-audit-log.service", () => ({
  insertPlatformAuditLog: hoisted.insertPlatformAuditLog,
}));

import {
  PLATFORM_ROLE_READ_MATRIX,
  SENSITIVE_READ_DOMAINS,
  checkPlatformAccess,
  platformAccessGuard,
  resolvePlatformDomain,
} from "../../middleware/platform-rbac-guard";

/** 按 SQL 分派 mock：当前只查 t_platform_admin.role */
function mockAdminRole(roleById: Record<number, string | null>) {
  hoisted.queryOne.mockImplementation(async (_sql: string, params?: unknown[]) => {
    const id = Number((params as unknown[])?.[0]);
    return { role: roleById[id] ?? null };
  });
}

beforeEach(() => {
  hoisted.queryOne.mockReset();
  hoisted.insertPlatformAuditLog.mockReset();
  hoisted.insertPlatformAuditLog.mockResolvedValue(1);
});

describe("TOTAL-RBAC · 域解析（单一矩阵的路由侧真相）", () => {
  it("① 平台前缀按段映射：tenants→tenant、support→ticket、config→sysconfig、admins/roles/permissions→platform-admin、error-logs→errorlog", () => {
    expect(resolvePlatformDomain("/api/platform/tenants")).toBe("tenant");
    expect(resolvePlatformDomain("/api/platform/tenants/12/toggle")).toBe("tenant");
    expect(resolvePlatformDomain("/api/platform/support/tickets")).toBe("ticket");
    expect(resolvePlatformDomain("/api/platform/config/sys-config")).toBe("sysconfig");
    expect(resolvePlatformDomain("/api/platform/admins/roles")).toBe("platform-admin");
    expect(resolvePlatformDomain("/api/platform/roles")).toBe("platform-admin");
    expect(resolvePlatformDomain("/api/platform/permissions/catalog")).toBe("platform-admin");
    expect(resolvePlatformDomain("/api/platform/error-logs")).toBe("errorlog");
    expect(resolvePlatformDomain("/api/platform/dashboard/overview")).toBe("dashboard");
    expect(resolvePlatformDomain("/api/platform/billing/arrears")).toBe("billing");
    expect(resolvePlatformDomain("/api/platform/monitor/db-status")).toBe("monitor");
  });

  it("① /api/platform 根与总览归 dashboard；/api/saas→saas、/api/padmin→padmin、未知段=段名（deny-by-default）", () => {
    expect(resolvePlatformDomain("/api/platform")).toBe("dashboard");
    expect(resolvePlatformDomain("/api/platform/overview")).toBe("dashboard");
    expect(resolvePlatformDomain("/api/saas/tenants")).toBe("saas");
    expect(resolvePlatformDomain("/api/padmin/app-versions")).toBe("padmin");
    expect(resolvePlatformDomain("/api/platform/plans")).toBe("plans");
    expect(resolvePlatformDomain("/api/platform/open/api-keys")).toBe("open");
    expect(resolvePlatformDomain("/api/platform/ai/public-models")).toBe("ai");
    expect(resolvePlatformDomain("/api/platform/ai-billing/overview")).toBe("ai-billing");
  });

  it("① 敏感读域清单至少覆盖任务卡 §五.5 五项", () => {
    for (const d of ["sysconfig", "platform-admin", "ai", "ai-billing", "open", "errorlog"]) {
      expect(SENSITIVE_READ_DOMAINS.has(d)).toBe(true);
    }
  });
});

describe("TOTAL-RBAC · 中央判定 checkPlatformAccess", () => {
  it("② 超管两套写法全通（读/写/敏感读都放行）", async () => {
    mockAdminRole({ 1: "PLATFORM_SUPER_ADMIN", 2: "SUPER_ADMIN" });
    for (const id of [1, 2]) {
      expect((await checkPlatformAccess(id, "GET", "/api/platform/tenants")).allow).toBe(true);
      expect((await checkPlatformAccess(id, "POST", "/api/platform/tenants")).allow).toBe(true);
      expect(
        (await checkPlatformAccess(id, "GET", "/api/platform/config/sys-config")).allow
      ).toBe(true);
      expect((await checkPlatformAccess(id, "GET", "/api/platform/open/api-keys")).allow).toBe(
        true
      );
    }
  });

  it("③ SUPPORT 五域白名单 GET 放行（reason=whitelist_read），列表/详情/统计形态不误伤", async () => {
    mockAdminRole({ 9: "SUPPORT" });
    for (const url of [
      "/api/platform/dashboard",
      "/api/platform/tenants",
      "/api/platform/tenants/12",
      "/api/platform/tenants/stats",
      "/api/platform/billing/arrears",
      "/api/platform/monitor/db-status",
      "/api/platform/support/tickets",
    ]) {
      const d = await checkPlatformAccess(9, "GET", url);
      expect(d.allow, url).toBe(true);
      expect(d.reason, url).toBe("whitelist_read");
    }
  });

  it("④ SUPPORT 写端点一律 fail-closed（建租户/toggle/更新/账单生成…）", async () => {
    mockAdminRole({ 9: "SUPPORT" });
    for (const [method, url] of [
      ["POST", "/api/platform/tenants"],
      ["POST", "/api/platform/tenants/12/toggle"],
      ["PUT", "/api/platform/tenants/12"],
      ["DELETE", "/api/platform/tenants/12"],
      ["PATCH", "/api/platform/plans/3"],
      ["POST", "/api/platform/billing/generate"],
    ] as const) {
      const d = await checkPlatformAccess(9, method, url);
      expect(d.allow, `${method} ${url}`).toBe(false);
      expect(d.reason, `${method} ${url}`).toBe("write_fail_closed");
    }
  });

  it("⑤ 敏感读仅超管：SUPPORT 读 sysconfig/管理员权限/AI 配置/AI 计费/open api-keys/error-logs 全拒", async () => {
    mockAdminRole({ 9: "SUPPORT" });
    for (const url of [
      "/api/platform/config/sys-config",
      "/api/platform/config",
      "/api/platform/admins/roles",
      "/api/platform/roles",
      "/api/platform/permissions/catalog",
      "/api/platform/ai/public-models",
      "/api/platform/ai-billing/overview",
      "/api/platform/open/api-keys",
      "/api/platform/error-logs",
    ]) {
      const d = await checkPlatformAccess(9, "GET", url);
      expect(d.allow, url).toBe(false);
      expect(d.reason, url).toBe("sensitive_read");
    }
  });

  it("⑥ 非白名单域读与未登记角色/空角色全拒", async () => {
    mockAdminRole({ 9: "SUPPORT", 10: "PLATFORM_ADMIN", 11: null });
    // SUPPORT 读非白名单域（library / open 之外的普通域）
    const lib = await checkPlatformAccess(9, "GET", "/api/platform/library");
    expect(lib.allow).toBe(false);
    expect(lib.reason).toBe("domain_not_whitelisted");
    // 未登记角色（矩阵里没有 platform_admin 授予面）
    const other = await checkPlatformAccess(10, "GET", "/api/platform/tenants");
    expect(other.allow).toBe(false);
    expect(other.reason).toBe("role_not_granted");
    // role 为空
    const none = await checkPlatformAccess(11, "GET", "/api/platform/tenants");
    expect(none.allow).toBe(false);
    expect(none.reason).toBe("no_admin_role");
  });

  it("⑦ DB 异常 ⇒ check_error fail-closed（不抛错、不放过）", async () => {
    hoisted.queryOne.mockRejectedValue(new Error("db down"));
    const d = await checkPlatformAccess(1, "POST", "/api/platform/tenants");
    expect(d.allow).toBe(false);
    expect(d.reason).toBe("check_error");
  });

  it("矩阵形状：SUPPORT 恰好五域只读（dashboard/tenant/billing/monitor/ticket）", () => {
    expect(PLATFORM_ROLE_READ_MATRIX).toHaveLength(1);
    expect(PLATFORM_ROLE_READ_MATRIX[0].roleCode).toBe("support");
    expect([...PLATFORM_ROLE_READ_MATRIX[0].readDomains].sort()).toEqual([
      "billing",
      "dashboard",
      "monitor",
      "tenant",
      "ticket",
    ]);
  });
});

describe("TOTAL-RBAC · 中间件形态 platformAccessGuard", () => {
  function run(mw: ReturnType<typeof platformAccessGuard>, req: Partial<Request>) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;
    mw(req as Request, res, next);
    return { res, next };
  }

  it("⑧ 无 user ⇒ 401（fail 结构）", async () => {
    const mw = platformAccessGuard();
    const { res, next } = run(mw, { method: "GET", originalUrl: "/api/platform/tenants" });
    await vi.waitFor(() => expect(next).not.toHaveBeenCalled());
    expect(res.status).toHaveBeenCalledWith(401);
    expect((res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ code: "401" });
  });

  it("⑧ 超管 ⇒ next()，不写审计", async () => {
    mockAdminRole({ 1: "PLATFORM_SUPER_ADMIN" });
    const mw = platformAccessGuard();
    const { res, next } = run(mw, {
      method: "POST",
      originalUrl: "/api/platform/tenants",
      user: { id: 1, username: "root", type: "platform_admin" },
    });
    await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(1));
    expect(res.status).not.toHaveBeenCalled();
    expect(hoisted.insertPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("⑧ SUPPORT 写租户 ⇒ 403 + code 403 + traceId + 审计留痕（PERMISSION_DENIED，detail 带 domain/method/path/traceId）", async () => {
    mockAdminRole({ 9: "SUPPORT" });
    const mw = platformAccessGuard();
    const { res, next } = run(mw, {
      method: "POST",
      originalUrl: "/api/platform/tenants",
      ip: "10.0.0.9",
      user: { id: 9, username: "support01", type: "platform_admin" },
    });
    await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
    expect(next).not.toHaveBeenCalled();
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.code).toBe("403");
    expect(String(body.traceId)).not.toBe("");
    const auditArg = hoisted.insertPlatformAuditLog.mock.calls[0][0];
    expect(auditArg).toMatchObject({
      adminId: 9,
      module: "tenant",
      action: "PERMISSION_DENIED",
      auditType: "PERMISSION_DENIED",
    });
    expect(auditArg.detail).toMatchObject({
      permKind: "platform-guard",
      domain: "tenant",
      method: "POST",
      path: "/api/platform/tenants",
      traceId: body.traceId,
    });
  });

  it("⑧ 留痕写入失败只记日志，不影响 403 响应", async () => {
    mockAdminRole({ 9: "SUPPORT" });
    hoisted.insertPlatformAuditLog.mockRejectedValue(new Error("audit down"));
    const mw = platformAccessGuard();
    const { res } = run(mw, {
      method: "PUT",
      originalUrl: "/api/platform/tenants/12",
      user: { id: 9, username: "support01", type: "platform_admin" },
    });
    await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
    expect((res.json as ReturnType<typeof vi.fn>).mock.calls[0][0].code).toBe("403");
  });

  it("⑧ OPTIONS 预检直接放行（不查库、不审计）", () => {
    const mw = platformAccessGuard();
    const { next } = run(mw, {
      method: "OPTIONS",
      originalUrl: "/api/platform/tenants",
      user: { id: 9, type: "platform_admin" },
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(hoisted.queryOne).not.toHaveBeenCalled();
  });
});
