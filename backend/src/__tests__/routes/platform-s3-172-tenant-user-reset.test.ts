/**
 * S3-172 路由级测试：平台超管「代重置指定租户账号口令」
 * 端点：POST /api/platform/tenants/:tenantId/users/:userId/reset-password
 *
 * 范式：src/__tests__/routes/platform-c1-2-tenant.test.ts（同目录同结构的租户写操作测试）
 * 关注点：入参非法 400（不落到 service）、跨租户由 service 判 404、鉴权 + CSRF 由路由声明承担。
 */
import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/platform-tenant.service", () => ({
  listTenants: vi.fn(),
  getTenantById: vi.fn(),
  checkTenantNameExists: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
  toggleTenantStatus: vi.fn(),
}));

vi.mock("../../services/platform/tenant-status-stats.service", () => ({
  getTenantStatusStats: vi.fn(),
}));

vi.mock("../../services/platform/tenant-export.service", () => ({
  TENANT_EXPORT_COLUMNS: ["ID"],
  listTenantsForExport: vi.fn(),
  formatCell: vi.fn(),
  toCsvRows: vi.fn(() => []),
}));

vi.mock("../../services/platform/tenant-overview.service", () => ({
  getTenantOverview: vi.fn(),
}));

vi.mock("../../services/platform/tenant-ops.service", () => ({
  QUOTA_EXPAND_FIELDS: ["accounts", "products", "stores", "storage", "aiMonthly"],
  PROXY_LOGIN_TTL_SECONDS: 1800,
  QUOTA_EXPAND_CONFIG_KEY: "quota_expand",
  proxyLogin: vi.fn(),
  expandTenantQuota: vi.fn(),
  resetTenantUserPassword: vi.fn(),
}));

vi.mock("../../services/platform/tenant-usage.service", () => ({
  getUsageStats: vi.fn(),
  getRank: vi.fn(),
}));

vi.mock("../../services/platform/tenant-quota.service", () => ({
  getTenantQuota: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: [],
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/csrf", () => ({
  csrfMiddleware: (_req: any, _res: any, next: any) => next(),
  generateCsrfToken: vi.fn(() => "test-csrf"),
}));

import * as opsService from "../../services/platform/tenant-ops.service";
import { AppError } from "../../shared/app-error";
import { platformTenantRouter, routeConfig } from "../../routes/platform-tenant.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const app = createTestApp({ prefix: "/api/platform/tenants", router: platformTenantRouter });

const URL_9 = "/api/platform/tenants/tenant_1/users/9/reset-password";

describe("S3-172 POST /api/platform/tenants/:tenantId/users/:userId/reset-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200：返回一次性初始口令，且 tenantId/userId/操作人/IP 传给 service", async () => {
    (opsService.resetTenantUserPassword as any).mockResolvedValue({
      tenantId: "tenant_1",
      tenantCode: "T001",
      userId: 9,
      username: "boss",
      realName: "租户管理员",
      initialPassword: "Abc234def567",
      passwordShownOnce: true,
      auditLogId: 88,
    });

    const res = await request(app).post(URL_9);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(res.body.data.initialPassword).toBe("Abc234def567");
    expect(res.body.data.passwordShownOnce).toBe(true);
    expect(opsService.resetTenantUserPassword).toHaveBeenCalledWith(
      "tenant_1",
      9,
      expect.objectContaining({ id: 1, name: "testadmin" }),
      expect.anything()
    );
  });

  it("userId 非法（非数字 / 0 / 负数 / 小数）⇒ 400 且不调 service", async () => {
    for (const bad of ["abc", "0", "-3", "1.5", "NaN"]) {
      const res = await request(app).post(
        `/api/platform/tenants/tenant_1/users/${bad}/reset-password`
      );
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("400");
    }
    expect(opsService.resetTenantUserPassword).not.toHaveBeenCalled();
  });

  it("跨租户（userId 不属于 tenantId）⇒ 404，且不返回任何口令", async () => {
    (opsService.resetTenantUserPassword as any).mockRejectedValue(
      new AppError("该租户下不存在该账号", 404)
    );

    const res = await request(app).post(URL_9);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("404");
    expect(res.body.data).toBeUndefined();
  });

  it("租户不存在 ⇒ 404", async () => {
    (opsService.resetTenantUserPassword as any).mockRejectedValue(
      new AppError("租户不存在", 404)
    );
    const res = await request(app).post("/api/platform/tenants/none/users/9/reset-password");
    expect(res.status).toBe(404);
  });

  it("鉴权与 CSRF：router 级挂 requirePlatformAuth，且 routeConfig.auth 声明由 auto-routes 附加 csrfMiddleware", () => {
    const guardLayer = (platformTenantRouter as any).stack.find(
      (l: any) => l.handle === (requirePlatformAuth as any)
    );
    expect(guardLayer).toBeTruthy();
    // routeConfig.auth="requirePlatformAuth" ⇒ getAuthMiddlewares 返回 [requirePlatformAuth, csrfMiddleware]
    expect(routeConfig).toMatchObject({
      prefix: "/api/platform/tenants",
      auth: "requirePlatformAuth",
    });
  });

  it("路由确实注册在 /:tenantId/users/:userId/reset-password 上（不被 /:id 之类吞掉）", () => {
    const paths = (platformTenantRouter as any).stack
      .map((l: any) => l.route?.path)
      .filter(Boolean);
    expect(paths).toContain("/:tenantId/users/:userId/reset-password");
  });
});
