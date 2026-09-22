/**
 * C1-2（批次 A · 租户域）路由级测试
 * 范式：src/__tests__/routes/platform-r97.test.ts + fixtures/create-test-app.ts
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
  TENANT_EXPORT_COLUMNS: [
    "ID",
    "租户编码",
    "租户名称",
    "联系人",
    "联系电话",
    "联系邮箱",
    "状态",
    "到期时间",
    "创建时间",
  ],
  listTenantsForExport: vi.fn(),
  formatCell: vi.fn((value: unknown) => (value == null ? "" : String(value))),
  toCsvRows: vi.fn(() => [
    ["1", "T001", "测试租户", "张三", "13800138000", "", "ACTIVE", "2026-12-31 00:00:00", "2026-01-01 00:00:00"],
  ]),
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

import * as platformTenantService from "../../services/platform-tenant.service";
import * as statsService from "../../services/platform/tenant-status-stats.service";
import * as exportService from "../../services/platform/tenant-export.service";
import * as overviewService from "../../services/platform/tenant-overview.service";
import * as opsService from "../../services/platform/tenant-ops.service";
import { AppError } from "../../shared/app-error";
import { platformTenantRouter } from "../../routes/platform-tenant.routes";
import { requirePlatformAuth } from "../../middleware/auth";

const app = createTestApp({ prefix: "/api/platform/tenants", router: platformTenantRouter });

const STATS_SAMPLE = {
  total: 4,
  counts: { normal: 3, owed: 0, frozen: 1, cancelled: 0, expired: 0 },
  byStatus: [
    { status: "ACTIVE", count: 3 },
    { status: "DISABLED", count: 1 },
  ],
  unmapped: [],
};

describe("C1-2 A1 GET /api/platform/tenants/stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 四态计数（缺状态为 0 且字段不缺）", async () => {
    (statsService.getTenantStatusStats as any).mockResolvedValue(STATS_SAMPLE);
    const res = await request(app).get("/api/platform/tenants/stats");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("0");
    expect(Object.keys(res.body.data.counts).sort()).toEqual(
      ["cancelled", "expired", "frozen", "normal", "owed"].sort()
    );
    expect(res.body.data.counts.normal).toBe(3);
    expect(res.body.data.counts.owed).toBe(0);
    expect(res.body.data.byStatus).toHaveLength(2);
  });

  it("/stats 未被 /:id 捕获（不调用 getTenantById）", async () => {
    (statsService.getTenantStatusStats as any).mockResolvedValue(STATS_SAMPLE);
    await request(app).get("/api/platform/tenants/stats");
    expect(platformTenantService.getTenantById).not.toHaveBeenCalled();
  });

  it("路由注册顺序：/stats 与 /export 均在 /:id 之前", () => {
    const stack = (platformTenantRouter as any).stack;
    const paths = stack.map((l: any) => l.route?.path).filter(Boolean);
    const idxId = paths.indexOf("/:id");
    expect(idxId).toBeGreaterThan(-1);
    expect(paths.indexOf("/stats")).toBeGreaterThan(-1);
    expect(paths.indexOf("/stats")).toBeLessThan(idxId);
    expect(paths.indexOf("/export")).toBeLessThan(idxId);
  });

  it("service 抛错 → 500", async () => {
    (statsService.getTenantStatusStats as any).mockRejectedValue(new Error("db error"));
    const res = await request(app).get("/api/platform/tenants/stats");
    expect(res.status).toBe(500);
  });
});

describe("C1-2 A2 GET /api/platform/tenants/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + text/csv 附件 + 表头与数据行", async () => {
    (exportService.listTenantsForExport as any).mockResolvedValue({
      total: 1,
      exported: 1,
      columns: ["ID"],
      records: [],
    });
    const res = await request(app).get("/api/platform/tenants/export?keyword=测试");

    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/csv");
    expect(String(res.headers["content-disposition"])).toContain("attachment");
    expect(res.headers["x-export-total"]).toBe("1");
    expect(res.headers["x-export-rows"]).toBe("1");
    expect(res.text).toContain("租户编码");
    expect(res.text).toContain("测试租户");
    expect(exportService.listTenantsForExport).toHaveBeenCalledWith("测试");
  });

  it("无 keyword 时传 undefined（与列表筛选口径一致）", async () => {
    (exportService.listTenantsForExport as any).mockResolvedValue({
      total: 0,
      exported: 0,
      columns: ["ID"],
      records: [],
    });
    const res = await request(app).get("/api/platform/tenants/export");
    expect(res.status).toBe(200);
    expect(exportService.listTenantsForExport).toHaveBeenCalledWith(undefined);
  });
});

describe("C1-2 A3 GET /api/platform/tenants/:id/overview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 概况字段（无数据源维度为 null）", async () => {
    (overviewService.getTenantOverview as any).mockResolvedValue({
      tenantId: "tenant_1",
      goods: 12,
      goodsCap: 500,
      orders: 3,
      ordersMomPct: null,
      staff: 4,
      docCount: 5,
      docRate: null,
      store: 1.5,
      storeRate: 1.5,
      unavailable: [{ key: "docRate", reason: "无单据上限数据源" }],
    });
    const res = await request(app).get("/api/platform/tenants/tenant_1/overview");

    expect(res.status).toBe(200);
    expect(res.body.data.goods).toBe(12);
    expect(res.body.data.docRate).toBeNull();
    expect(res.body.data.unavailable).toHaveLength(1);
    expect(overviewService.getTenantOverview).toHaveBeenCalledWith("tenant_1");
  });

  it("租户不存在 → 404", async () => {
    (overviewService.getTenantOverview as any).mockRejectedValue(
      new AppError("租户不存在", 404)
    );
    const res = await request(app).get("/api/platform/tenants/none/overview");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("404");
  });
});

describe("C1-2 A4 POST /api/platform/tenants/:id/proxy-login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 下发令牌（带事由 + 操作人 + IP 传入 service）", async () => {
    (opsService.proxyLogin as any).mockResolvedValue({
      token: "jwt-token",
      tokenType: "Bearer",
      expiresInSeconds: 1800,
      auditLogId: 88,
    });
    const res = await request(app)
      .post("/api/platform/tenants/tenant_1/proxy-login")
      .send({ reason: "客户报障排查" });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe("jwt-token");
    expect(opsService.proxyLogin).toHaveBeenCalledWith(
      "tenant_1",
      { reason: "客户报障排查", username: undefined },
      expect.objectContaining({ id: 1, name: "testadmin" }),
      expect.anything()
    );
  });

  it("缺事由 → 400 且不调 service", async () => {
    const res = await request(app).post("/api/platform/tenants/tenant_1/proxy-login").send({});
    expect(res.status).toBe(400);
    expect(opsService.proxyLogin).not.toHaveBeenCalled();
  });

  it("事由过短 → 400", async () => {
    const res = await request(app)
      .post("/api/platform/tenants/tenant_1/proxy-login")
      .send({ reason: "x" });
    expect(res.status).toBe(400);
    expect(opsService.proxyLogin).not.toHaveBeenCalled();
  });

  it("service 报租户不存在 → 404", async () => {
    (opsService.proxyLogin as any).mockRejectedValue(new AppError("租户不存在", 404));
    const res = await request(app)
      .post("/api/platform/tenants/none/proxy-login")
      .send({ reason: "排查问题" });
    expect(res.status).toBe(404);
  });
});

describe("C1-2 A5 POST /api/platform/tenants/:id/quota-expand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 + 扩容参数传入 service", async () => {
    (opsService.expandTenantQuota as any).mockResolvedValue({
      tenantId: "tenant_1",
      field: "storage",
      amount: 10,
      days: 7,
      expireAt: "2026-09-29 10:00:00",
      records: [],
      auditLogId: 89,
    });
    const res = await request(app)
      .post("/api/platform/tenants/tenant_1/quota-expand")
      .send({ field: "storage", amount: 10, days: 7, reason: "活动期临时扩容" });

    expect(res.status).toBe(200);
    expect(res.body.data.auditLogId).toBe(89);
    expect(opsService.expandTenantQuota).toHaveBeenCalledWith(
      "tenant_1",
      { field: "storage", amount: 10, days: 7, reason: "活动期临时扩容" },
      expect.objectContaining({ name: "testadmin" }),
      expect.anything()
    );
  });

  it("缺 field / amount / days → 400 且不调 service", async () => {
    const noField = await request(app)
      .post("/api/platform/tenants/tenant_1/quota-expand")
      .send({ amount: 10, days: 7 });
    expect(noField.status).toBe(400);

    const noAmount = await request(app)
      .post("/api/platform/tenants/tenant_1/quota-expand")
      .send({ field: "storage", days: 7 });
    expect(noAmount.status).toBe(400);

    const noDays = await request(app)
      .post("/api/platform/tenants/tenant_1/quota-expand")
      .send({ field: "storage", amount: 10 });
    expect(noDays.status).toBe(400);

    expect(opsService.expandTenantQuota).not.toHaveBeenCalled();
  });

  it("service 判非法幅度 → 400", async () => {
    (opsService.expandTenantQuota as any).mockRejectedValue(
      new AppError("扩容幅度必须为 1..1000000 的整数", 400)
    );
    const res = await request(app)
      .post("/api/platform/tenants/tenant_1/quota-expand")
      .send({ field: "storage", amount: 0, days: 7 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("400");
  });
});

describe("C1-2 鉴权守卫", () => {
  it("router 级挂载 requirePlatformAuth（覆盖新增端点）", () => {
    const guardLayer = (platformTenantRouter as any).stack.find(
      (l: any) => l.handle === (requirePlatformAuth as any)
    );
    expect(guardLayer).toBeTruthy();
  });
});
