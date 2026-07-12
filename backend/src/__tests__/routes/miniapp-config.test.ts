import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app.js";

vi.mock("../../services/admin/miniapp-config.service.js", () => ({
  MiniappConfigService: {
    listConfigs: vi.fn(),
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    publish: vi.fn(),
    listPublishLogs: vi.fn(),
  },
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant.js", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import { MiniappConfigService } from "../../services/admin/miniapp-config.service.js";
import { miniappConfigRouter } from "../../routes/miniapp-config.routes.js";

const app = createTestApp({ prefix: "/api/miniapp-config", router: miniappConfigRouter });

describe("routes/miniapp-config 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /configs", () => {
    it("应返回配置列表", async () => {
      (MiniappConfigService.listConfigs as any).mockResolvedValue([{ platform: "WECHAT" }]);
      const res = await request(app).get("/api/miniapp-config/configs");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(MiniappConfigService.listConfigs).toHaveBeenCalledWith("test-tenant");
    });

    it("service 抛错时返回500", async () => {
      (MiniappConfigService.listConfigs as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/miniapp-config/configs");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /configs/:platform", () => {
    it("应返回平台配置", async () => {
      (MiniappConfigService.getConfig as any).mockResolvedValue({ platform: "WECHAT", appId: "wx123" });
      const res = await request(app).get("/api/miniapp-config/configs/WECHAT");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(MiniappConfigService.getConfig).toHaveBeenCalledWith("test-tenant", "WECHAT");
    });

    it("service 抛错时返回500", async () => {
      (MiniappConfigService.getConfig as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/miniapp-config/configs/WECHAT");
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /configs/:platform", () => {
    it("应保存配置", async () => {
      (MiniappConfigService.saveConfig as any).mockResolvedValue({ success: true });
      const res = await request(app)
        .put("/api/miniapp-config/configs/WECHAT")
        .send({ appId: "wx123", appSecret: "secret" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(MiniappConfigService.saveConfig).toHaveBeenCalledWith(
        "test-tenant",
        "WECHAT",
        expect.objectContaining({ appId: "wx123", appSecret: "secret" })
      );
    });

    it("appId 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .put("/api/miniapp-config/configs/WECHAT")
        .send({ appSecret: "secret" });
      expect(res.status).toBe(500);
      expect(MiniappConfigService.saveConfig).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (MiniappConfigService.saveConfig as any).mockRejectedValue(new Error("save error"));
      const res = await request(app)
        .put("/api/miniapp-config/configs/WECHAT")
        .send({ appId: "wx123", appSecret: "secret" });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /templates", () => {
    it("应返回模板列表", async () => {
      (MiniappConfigService.listTemplates as any).mockResolvedValue([{ id: 1, name: "模板1" }]);
      const res = await request(app).get("/api/miniapp-config/templates");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(MiniappConfigService.listTemplates).toHaveBeenCalledWith("test-tenant");
    });

    it("service 抛错时返回500", async () => {
      (MiniappConfigService.listTemplates as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/miniapp-config/templates");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /templates/:id", () => {
    it("应返回模板详情", async () => {
      (MiniappConfigService.getTemplate as any).mockResolvedValue({ id: 1, name: "模板1" });
      const res = await request(app).get("/api/miniapp-config/templates/1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(MiniappConfigService.getTemplate).toHaveBeenCalledWith("test-tenant", 1);
    });

    it("service 抛错时返回500", async () => {
      (MiniappConfigService.getTemplate as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/miniapp-config/templates/1");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /publish", () => {
    it("应发布小程序", async () => {
      (MiniappConfigService.publish as any).mockResolvedValue({ success: true });
      const res = await request(app)
        .post("/api/miniapp-config/publish")
        .send({ platform: "WECHAT", templateId: 1, version: "1.0.0" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(MiniappConfigService.publish).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ platform: "WECHAT", templateId: 1, version: "1.0.0" })
      );
    });

    it("platform 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/miniapp-config/publish")
        .send({ templateId: 1, version: "1.0.0" });
      expect(res.status).toBe(500);
      expect(MiniappConfigService.publish).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (MiniappConfigService.publish as any).mockRejectedValue(new Error("publish error"));
      const res = await request(app)
        .post("/api/miniapp-config/publish")
        .send({ platform: "WECHAT", templateId: 1, version: "1.0.0" });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /publish-logs", () => {
    it("应返回发布日志列表", async () => {
      (MiniappConfigService.listPublishLogs as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/miniapp-config/publish-logs");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(MiniappConfigService.listPublishLogs).toHaveBeenCalledWith("test-tenant", 1, 20);
    });

    it("应传递分页参数", async () => {
      (MiniappConfigService.listPublishLogs as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/miniapp-config/publish-logs?page=2&pageSize=10");
      expect(res.status).toBe(200);
      expect(MiniappConfigService.listPublishLogs).toHaveBeenCalledWith("test-tenant", 2, 10);
    });

    it("service 抛错时返回500", async () => {
      (MiniappConfigService.listPublishLogs as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/miniapp-config/publish-logs");
      expect(res.status).toBe(500);
    });
  });
});
