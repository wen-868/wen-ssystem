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

// 与本目录既有用例 platform-c1-2-tenant.test.ts 同范式：路由级测试把同路由挂载的其余服务整块 mock，
// 既保证断言只看端点行为，也避免加载这些 service（及其依赖 config/env.ts、shared/logger.ts，
// 二者含 process.env 字面量会让 Vite 的 vite:define 插件调 esbuild；沙箱内 node 不能 spawn ⇒ EPERM）。
vi.mock("../../services/platform/tenant-status-stats.service", () => ({
  getTenantStatusStats: vi.fn(),
}));

vi.mock("../../services/platform/tenant-export.service", () => ({
  TENANT_EXPORT_COLUMNS: [
    "ID", "租户编码", "租户名称", "联系人", "联系电话", "联系邮箱", "状态", "到期时间", "创建时间",
  ],
  listTenantsForExport: vi.fn(),
  formatCell: vi.fn((value: unknown) => (value == null ? "" : String(value))),
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
}));

vi.mock("../../services/platform/tenant-usage.service", () => ({
  getUsageStats: vi.fn(),
  getRank: vi.fn(),
}));

vi.mock("../../services/platform/tenant-quota.service", () => ({
  getTenantQuota: vi.fn(),
}));

// S3-150：路由级测试只断言端点行为（服务层已整块 mock），这里再隔离 DB/日志模块 ——
// 既避免真连库，也避免加载 src/config/database.ts / src/shared/logger.ts
// （两者含 process.env 字面量，会让 Vite 的 vite:define 插件调 esbuild 做替换；沙箱内 node 不能 spawn ⇒ EPERM）
vi.mock("../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  connQuery: vi.fn(),
  connQueryOne: vi.fn(),
  connExecute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
  getTenantId: (req: any) => req.tenantId || "default",
}));

import * as platformTenantService from "../../services/platform-tenant.service";
import { platformTenantRouter } from "../../routes/platform-tenant.routes";

const app = createTestApp({ prefix: "/api/platform-tenant", router: platformTenantRouter });

/** S3-150：t_tenant.id 是 VARCHAR(36)，列表里的 id 原值就是 UUID/default */
const UUID_ID = "11111111-1111-4111-8111-111111111111";

describe("routes/platform-tenant 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回租户列表", async () => {
      (platformTenantService.listTenants as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/platform-tenant?page=1&pageSize=20&keyword=测试");
      expect(res.status).toBe(200);
      expect(platformTenantService.listTenants).toHaveBeenCalledWith(1, 20, "测试");
    });

    it("keyword 缺失时传 undefined", async () => {
      (platformTenantService.listTenants as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/platform-tenant");
      expect(res.status).toBe(200);
      expect(platformTenantService.listTenants).toHaveBeenCalledWith(1, 20, undefined);
    });

    it("service 抛错时返回500", async () => {
      (platformTenantService.listTenants as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-tenant");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id", () => {
    it("应返回租户详情（id 按字符串原值透传，不 Number()）", async () => {
      (platformTenantService.getTenantById as any).mockResolvedValue({ id: "1", tenantName: "租户1" });
      const res = await request(app).get("/api/platform-tenant/1");
      expect(res.status).toBe(200);
      expect(platformTenantService.getTenantById).toHaveBeenCalledWith("1");
    });

    it("UUID 型 id 原样透传给服务层（不被转成 NaN）", async () => {
      (platformTenantService.getTenantById as any).mockResolvedValue({ id: UUID_ID, tenantName: "酒行UUID" });
      const res = await request(app).get(`/api/platform-tenant/${UUID_ID}`);
      expect(res.status).toBe(200);
      expect(platformTenantService.getTenantById).toHaveBeenCalledWith(UUID_ID);
    });

    it("租户不存在时返回404", async () => {
      (platformTenantService.getTenantById as any).mockResolvedValue(null);
      const res = await request(app).get("/api/platform-tenant/1");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (platformTenantService.getTenantById as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-tenant/1");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /", () => {
    it("应创建租户", async () => {
      (platformTenantService.checkTenantNameExists as any).mockResolvedValue(false);
      (platformTenantService.createTenant as any).mockResolvedValue(1);
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          tenantName: "新租户",
          contactName: "联系人",
          contactMobile: "13800138000",
          adminUsername: "admin",
          adminPassword: "password"
        });
      expect(res.status).toBe(200);
      expect(platformTenantService.createTenant).toHaveBeenCalled();
    });

    it("tenantName 缺失时返回400", async () => {
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          contactName: "联系人",
          contactMobile: "13800138000",
          adminUsername: "admin",
          adminPassword: "password"
        });
      expect(res.status).toBe(400);
      expect(platformTenantService.createTenant).not.toHaveBeenCalled();
    });

    it("contactName 缺失时返回400", async () => {
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          tenantName: "新租户",
          contactMobile: "13800138000",
          adminUsername: "admin",
          adminPassword: "password"
        });
      expect(res.status).toBe(400);
    });

    it("contactMobile 缺失时返回400", async () => {
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          tenantName: "新租户",
          contactName: "联系人",
          adminUsername: "admin",
          adminPassword: "password"
        });
      expect(res.status).toBe(400);
    });

    it("adminUsername 缺失时返回400", async () => {
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          tenantName: "新租户",
          contactName: "联系人",
          contactMobile: "13800138000",
          adminPassword: "password"
        });
      expect(res.status).toBe(400);
    });

    it("adminPassword 缺失时返回400", async () => {
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          tenantName: "新租户",
          contactName: "联系人",
          contactMobile: "13800138000",
          adminUsername: "admin"
        });
      expect(res.status).toBe(400);
    });

    it("租户名称已存在时返回400", async () => {
      (platformTenantService.checkTenantNameExists as any).mockResolvedValue(true);
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          tenantName: "已存在租户",
          contactName: "联系人",
          contactMobile: "13800138000",
          adminUsername: "admin",
          adminPassword: "password"
        });
      expect(res.status).toBe(400);
      expect(platformTenantService.createTenant).not.toHaveBeenCalled();
    });

    it("checkTenantNameExists 抛错时返回500", async () => {
      (platformTenantService.checkTenantNameExists as any).mockRejectedValue(new Error("db error"));
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          tenantName: "新租户",
          contactName: "联系人",
          contactMobile: "13800138000",
          adminUsername: "admin",
          adminPassword: "password"
        });
      expect(res.status).toBe(500);
    });

    it("createTenant 抛错时返回500", async () => {
      (platformTenantService.checkTenantNameExists as any).mockResolvedValue(false);
      (platformTenantService.createTenant as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/platform-tenant")
        .send({
          tenantName: "新租户",
          contactName: "联系人",
          contactMobile: "13800138000",
          adminUsername: "admin",
          adminPassword: "password"
        });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /:id", () => {
    it("应更新租户（id 按字符串原值透传）", async () => {
      (platformTenantService.updateTenant as any).mockResolvedValue(undefined);
      const res = await request(app)
        .put("/api/platform-tenant/1")
        .send({ tenantName: "更新租户" });
      expect(res.status).toBe(200);
      expect(platformTenantService.updateTenant).toHaveBeenCalledWith("1", { tenantName: "更新租户" });
    });

    it("未知 id 时服务层抛 404 ⇒ 端点返回404（业务级，不静默成功）", async () => {
      (platformTenantService.updateTenant as any).mockRejectedValue(
        Object.assign(new Error("租户不存在"), { statusCode: 404 })
      );
      const res = await request(app)
        .put("/api/platform-tenant/not-exist")
        .send({ tenantName: "更新租户" });
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (platformTenantService.updateTenant as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/platform-tenant/1")
        .send({ tenantName: "更新租户" });
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:id/toggle", () => {
    it("应启用租户：id 字符串透传 + 响应带 status 字符串口径", async () => {
      (platformTenantService.toggleTenantStatus as any).mockResolvedValue("ACTIVE");
      const res = await request(app)
        .post("/api/platform-tenant/1/toggle")
        .send({ status: "ACTIVE" });
      expect(res.status).toBe(200);
      expect(platformTenantService.toggleTenantStatus).toHaveBeenCalledWith("1", "ACTIVE");
      expect(res.body.data).toEqual({ success: true, status: "ACTIVE" });
    });

    it("UUID 型 id 启停原样透传（不再被 Number() 成 NaN）", async () => {
      (platformTenantService.toggleTenantStatus as any).mockResolvedValue("DISABLED");
      const res = await request(app)
        .post(`/api/platform-tenant/${UUID_ID}/toggle`)
        .send({ status: "DISABLED" });
      expect(res.status).toBe(200);
      expect(platformTenantService.toggleTenantStatus).toHaveBeenCalledWith(UUID_ID, "DISABLED");
      expect(res.body.data.status).toBe("DISABLED");
    });

    it("未知 id 时服务层抛 404 ⇒ 端点返回404", async () => {
      (platformTenantService.toggleTenantStatus as any).mockRejectedValue(
        Object.assign(new Error("租户不存在"), { statusCode: 404 })
      );
      const res = await request(app)
        .post("/api/platform-tenant/123/toggle")
        .send({ status: "ACTIVE" });
      expect(res.status).toBe(404);
    });

    it("status 缺失时返回400", async () => {
      const res = await request(app)
        .post("/api/platform-tenant/1/toggle")
        .send({});
      expect(res.status).toBe(400);
      expect(platformTenantService.toggleTenantStatus).not.toHaveBeenCalled();
    });

    it("status 非法时返回400", async () => {
      const res = await request(app)
        .post("/api/platform-tenant/1/toggle")
        .send({ status: "INVALID" });
      expect(res.status).toBe(400);
      expect(platformTenantService.toggleTenantStatus).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (platformTenantService.toggleTenantStatus as any).mockRejectedValue(new Error("toggle error"));
      const res = await request(app)
        .post("/api/platform-tenant/1/toggle")
        .send({ status: "ACTIVE" });
      expect(res.status).toBe(500);
    });
  });
});
