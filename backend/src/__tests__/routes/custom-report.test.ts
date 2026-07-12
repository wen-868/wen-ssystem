import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/custom-report.service", () => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  executeTemplate: vi.fn(),
  listSchedules: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  toggleSchedule: vi.fn(),
  runSchedule: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: [],
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import * as reportService from "../../services/admin/custom-report.service";
import { customReportRouter } from "../../routes/custom-report.routes";

const app = createTestApp({
  prefix: "/api/custom-report",
  router: customReportRouter,
});

describe("routes/custom-report 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  // ========== 模板 ==========

  describe("GET /templates", () => {
    it("应返回模板列表", async () => {
      (reportService.listTemplates as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/custom-report/templates");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reportService.listTemplates).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("应传递 query 参数", async () => {
      (reportService.listTemplates as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/custom-report/templates?keyword=测试&type=SALES&page=2&pageSize=5");
      expect(res.status).toBe(200);
      expect(reportService.listTemplates).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ keyword: "测试", type: "SALES", page: 2, pageSize: 5 })
      );
    });

    it("service 抛错时返回500", async () => {
      (reportService.listTemplates as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/custom-report/templates");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /templates", () => {
    it("应创建模板", async () => {
      (reportService.createTemplate as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/custom-report/templates")
        .send({ name: "销售报表", type: "SALES", config: {} });
      expect(res.status).toBe(200);
      expect(reportService.createTemplate).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ name: "销售报表", type: "SALES", config: {} })
      );
    });

    it("zod 校验失败时返回500（缺少 name）", async () => {
      const res = await request(app)
        .post("/api/custom-report/templates")
        .send({ type: "SALES", config: {} });
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.createTemplate as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/custom-report/templates")
        .send({ name: "测试", type: "SALES", config: {} });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /templates/:id", () => {
    it("应更新模板", async () => {
      (reportService.updateTemplate as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/custom-report/templates/1")
        .send({ name: "更新名称", status: "ACTIVE" });
      expect(res.status).toBe(200);
      expect(reportService.updateTemplate).toHaveBeenCalledWith(
        "test-tenant",
        1,
        expect.objectContaining({ name: "更新名称", status: "ACTIVE" })
      );
    });

    it("zod 校验失败时返回500（id 非数字）", async () => {
      const res = await request(app)
        .put("/api/custom-report/templates/abc")
        .send({ name: "更新" });
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.updateTemplate as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/custom-report/templates/1")
        .send({ name: "更新" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /templates/:id", () => {
    it("应删除模板", async () => {
      (reportService.deleteTemplate as any).mockResolvedValue({ id: 1 });
      const res = await request(app).delete("/api/custom-report/templates/1");
      expect(res.status).toBe(200);
      expect(reportService.deleteTemplate).toHaveBeenCalledWith("test-tenant", 1);
    });

    it("zod 校验失败时返回500（id 非数字）", async () => {
      const res = await request(app).delete("/api/custom-report/templates/abc");
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.deleteTemplate as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/custom-report/templates/1");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /templates/:id/execute", () => {
    it("应执行模板", async () => {
      (reportService.executeTemplate as any).mockResolvedValue({ rows: [] });
      const res = await request(app)
        .post("/api/custom-report/templates/1/execute")
        .send({ dateStart: "2026-01-01", dateEnd: "2026-01-31" });
      expect(res.status).toBe(200);
      expect(reportService.executeTemplate).toHaveBeenCalledWith(
        "test-tenant",
        1,
        expect.objectContaining({ dateStart: "2026-01-01", dateEnd: "2026-01-31" })
      );
    });

    it("zod 校验失败时返回500（id 非数字）", async () => {
      const res = await request(app)
        .post("/api/custom-report/templates/abc/execute")
        .send({});
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.executeTemplate as any).mockRejectedValue(new Error("execute error"));
      const res = await request(app)
        .post("/api/custom-report/templates/1/execute")
        .send({});
      expect(res.status).toBe(500);
    });
  });

  // ========== 定时任务 ==========

  describe("GET /schedules", () => {
    it("应返回定时任务列表", async () => {
      (reportService.listSchedules as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/custom-report/schedules");
      expect(res.status).toBe(200);
      expect(reportService.listSchedules).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("应传递 query 参数", async () => {
      (reportService.listSchedules as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/custom-report/schedules?keyword=测试&status=active&page=2&pageSize=5");
      expect(res.status).toBe(200);
      expect(reportService.listSchedules).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ keyword: "测试", status: "active", page: 2, pageSize: 5 })
      );
    });

    it("service 抛错时返回500", async () => {
      (reportService.listSchedules as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/custom-report/schedules");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /schedules", () => {
    it("应创建定时任务", async () => {
      (reportService.createSchedule as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/custom-report/schedules")
        .send({ name: "日报", templateId: 1, cronExpression: "0 0 * * *", exportFormat: "XLSX" });
      expect(res.status).toBe(200);
      expect(reportService.createSchedule).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ name: "日报", templateId: 1, cronExpression: "0 0 * * *", exportFormat: "XLSX" })
      );
    });

    it("zod 校验失败时返回500（缺少 name）", async () => {
      const res = await request(app)
        .post("/api/custom-report/schedules")
        .send({ templateId: 1, cronExpression: "0 0 * * *", exportFormat: "XLSX" });
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.createSchedule as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/custom-report/schedules")
        .send({ name: "日报", templateId: 1, cronExpression: "0 0 * * *", exportFormat: "XLSX" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /schedules/:id", () => {
    it("应更新定时任务", async () => {
      (reportService.updateSchedule as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/custom-report/schedules/1")
        .send({ name: "更新日报", cronExpression: "0 1 * * *" });
      expect(res.status).toBe(200);
      expect(reportService.updateSchedule).toHaveBeenCalledWith(
        "test-tenant",
        1,
        expect.objectContaining({ name: "更新日报", cronExpression: "0 1 * * *" })
      );
    });

    it("zod 校验失败时返回500（id 非数字）", async () => {
      const res = await request(app)
        .put("/api/custom-report/schedules/abc")
        .send({ name: "更新" });
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.updateSchedule as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/custom-report/schedules/1")
        .send({ name: "更新" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /schedules/:id", () => {
    it("应删除定时任务", async () => {
      (reportService.deleteSchedule as any).mockResolvedValue({ id: 1 });
      const res = await request(app).delete("/api/custom-report/schedules/1");
      expect(res.status).toBe(200);
      expect(reportService.deleteSchedule).toHaveBeenCalledWith("test-tenant", 1);
    });

    it("zod 校验失败时返回500（id 非数字）", async () => {
      const res = await request(app).delete("/api/custom-report/schedules/abc");
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.deleteSchedule as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/custom-report/schedules/1");
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /schedules/:id/toggle", () => {
    it("应切换定时任务状态", async () => {
      (reportService.toggleSchedule as any).mockResolvedValue({ id: 1, status: "active" });
      const res = await request(app)
        .put("/api/custom-report/schedules/1/toggle")
        .send({ status: "active" });
      expect(res.status).toBe(200);
      expect(reportService.toggleSchedule).toHaveBeenCalledWith("test-tenant", 1, "active");
    });

    it("zod 校验失败时返回500（status 非法值）", async () => {
      const res = await request(app)
        .put("/api/custom-report/schedules/1/toggle")
        .send({ status: "invalid" });
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.toggleSchedule as any).mockRejectedValue(new Error("toggle error"));
      const res = await request(app)
        .put("/api/custom-report/schedules/1/toggle")
        .send({ status: "active" });
      expect(res.status).toBe(500);
    });
  });

  describe("POST /schedules/:id/run", () => {
    it("应立即执行定时任务", async () => {
      (reportService.runSchedule as any).mockResolvedValue({ id: 1 });
      const res = await request(app).post("/api/custom-report/schedules/1/run");
      expect(res.status).toBe(200);
      expect(reportService.runSchedule).toHaveBeenCalledWith("test-tenant", 1);
    });

    it("zod 校验失败时返回500（id 非数字）", async () => {
      const res = await request(app).post("/api/custom-report/schedules/abc/run");
      expect(res.status).toBe(500);
    });

    it("service 抛错时返回500", async () => {
      (reportService.runSchedule as any).mockRejectedValue(new Error("run error"));
      const res = await request(app).post("/api/custom-report/schedules/1/run");
      expect(res.status).toBe(500);
    });
  });
});
