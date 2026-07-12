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

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
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
    it("应返回租户详情", async () => {
      (platformTenantService.getTenantById as any).mockResolvedValue({ id: 1, tenantName: "租户1" });
      const res = await request(app).get("/api/platform-tenant/1");
      expect(res.status).toBe(200);
      expect(platformTenantService.getTenantById).toHaveBeenCalledWith(1);
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
    it("应更新租户", async () => {
      (platformTenantService.updateTenant as any).mockResolvedValue(undefined);
      const res = await request(app)
        .put("/api/platform-tenant/1")
        .send({ tenantName: "更新租户" });
      expect(res.status).toBe(200);
      expect(platformTenantService.updateTenant).toHaveBeenCalledWith(1, { tenantName: "更新租户" });
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
    it("应启用/禁用租户", async () => {
      (platformTenantService.toggleTenantStatus as any).mockResolvedValue(undefined);
      const res = await request(app)
        .post("/api/platform-tenant/1/toggle")
        .send({ status: "ACTIVE" });
      expect(res.status).toBe(200);
      expect(platformTenantService.toggleTenantStatus).toHaveBeenCalledWith(1, "ACTIVE");
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
