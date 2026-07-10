import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../server.js";
import { signToken } from "../middleware/auth.js";
import { resetMockDb } from "./mocks/mock-db.js";

const TOKEN = signToken({
  id: 1, username: "test-admin", roles: ["SUPER_ADMIN"],
  storeId: null, tenantId: "default"
});

describe("错误自动反馈功能测试 (Phase 18-C)", () => {
  beforeAll(() => resetMockDb());

  describe("错误日志 API", () => {
    it("前端错误上报 - POST /api/admin/error-report", async () => {
      const res = await request(app)
        .post("/api/admin/error-report")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({
          error_type: "vue_error",
          message: "测试前端错误",
          stack: "Error: test\n    at App.vue:1",
          url: "/dashboard"
        });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
    });

    it.skip("查询错误日志 - GET /api/admin/error-logs", async () => {
      const res = await request(app)
        .get("/api/admin/error-logs?page=1&pageSize=10")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("total");
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it("按来源筛选错误日志 - source=frontend", async () => {
      const res = await request(app)
        .get("/api/admin/error-logs?page=1&pageSize=10&source=frontend")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      const items = res.body.data.items;
      if (items.length > 0) {
        expect(items[0].source).toBe("frontend");
      }
    });

    it("按严重程度筛选 - severity=ERROR", async () => {
      const res = await request(app)
        .get("/api/admin/error-logs?page=1&pageSize=10&severity=ERROR")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
    });

    it("关键词搜索 - keyword=测试", async () => {
      const res = await request(app)
        .get("/api/admin/error-logs?page=1&pageSize=10&keyword=测试")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
    });

    it("未认证访问错误日志 - 应返回401", async () => {
      const res = await request(app)
        .get("/api/admin/error-logs");
      expect(res.status).toBe(401);
    });
  });

  describe("error-handler 错误持久化", () => {
    beforeEach(() => resetMockDb());

    it.skip("error-handler 捕获 ZodError 并记录 validation/WARN", async () => {
      const res = await request(app)
        .post("/api/admin/brands")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ name: "" });
      expect(res.status).toBe(400);

      const logsRes = await request(app)
        .get("/api/admin/error-logs?page=1&pageSize=10&error_type=validation")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(logsRes.status).toBe(200);
      expect(logsRes.body.code).toBe("0");
      const items = logsRes.body.data.items;
      const validationError = items.find((e: any) => e.error_type === "validation");
      expect(validationError).toBeTruthy();
      expect(validationError.severity).toBe("WARN");
      expect(validationError.status_code).toBe(400);
      expect(validationError.source).toBe("backend");
      expect(validationError.request_url).toContain("/api/admin/brands");
      expect(validationError.request_method).toBe("POST");
      expect(validationError.user_id).toBe(1);
      expect(validationError.tenant_id).toBe("default");
    });
  });

  describe("监控告警 API", () => {
    beforeAll(async () => {
      await request(app)
        .post("/api/admin/error-report")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ error_type: "test", message: "监控测试错误" });
    });

    it("GET /api/admin/monitor/db-status - 数据库状态", async () => {
      const res = await request(app)
        .get("/api/admin/monitor/db-status")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data).toHaveProperty("connection");
      expect(res.body.data).toHaveProperty("database");
      expect(res.body.data).toHaveProperty("tableCount");
    });

    it.skip("GET /api/admin/monitor/api-stats - API统计含错误率", async () => {
      const res = await request(app)
        .get("/api/admin/monitor/api-stats")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data).toHaveProperty("errorCount");
      expect(res.body.data).toHaveProperty("errorRate");
      expect(res.body.data).toHaveProperty("totalRequests");
      expect(res.body.data).toHaveProperty("todayErrorCount");
      expect(res.body.data).toHaveProperty("weeklyErrorTrend");
      expect(Array.isArray(res.body.data.weeklyErrorTrend)).toBe(true);
      expect(res.body.data.errorCount).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/admin/monitor/expiring-tenants - 到期租户", async () => {
      const res = await request(app)
        .get("/api/admin/monitor/expiring-tenants")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it.skip("POST /api/admin/monitor/notify-expiring - 发送通知", async () => {
      const res = await request(app)
        .post("/api/admin/monitor/notify-expiring")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ tenantIds: [1, 2, 3] });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(res.body.data.notifiedCount).toBe(3);
    });

    it("未认证访问监控 API - 应返回401", async () => {
      const res = await request(app)
        .get("/api/admin/monitor/db-status");
      expect(res.status).toBe(401);
    });
  });
});
