import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/platform-reconciliation.service", () => ({
  listReconciliations: vi.fn(),
  createReconciliation: vi.fn(),
  updateReconciliation: vi.fn(),
  getDetail: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
  requirePlatformAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import * as reconciliationService from "../../services/admin/platform-reconciliation.service";
import { platformReconciliationRouter } from "../../routes/platform-reconciliation.routes";

const app = createTestApp({ prefix: "/api/platform-reconciliation", router: platformReconciliationRouter });

describe("routes/platform-reconciliation 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回对账列表", async () => {
      (reconciliationService.listReconciliations as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/platform-reconciliation");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reconciliationService.listReconciliations).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("应传递筛选参数", async () => {
      (reconciliationService.listReconciliations as any).mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/platform-reconciliation?reconciliationNo=RC001&platformName=JD&status=1&dateStart=2026-01-01&dateEnd=2026-01-31");
      expect(res.status).toBe(200);
      expect(reconciliationService.listReconciliations).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ reconciliationNo: "RC001", platformName: "JD", status: 1, dateStart: "2026-01-01", dateEnd: "2026-01-31" })
      );
    });

    it("service 抛错时返回500", async () => {
      (reconciliationService.listReconciliations as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-reconciliation");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /", () => {
    it("应创建对账", async () => {
      (reconciliationService.createReconciliation as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/platform-reconciliation")
        .send({ reconciliationNo: "RC001", platformNo: "P001", platformName: "JD", type: 0, amount: 100.5 });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reconciliationService.createReconciliation).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ reconciliationNo: "RC001", platformNo: "P001", platformName: "JD", type: 0, amount: 100.5 })
      );
    });

    it("reconciliationNo 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/platform-reconciliation")
        .send({ platformNo: "P001", platformName: "JD", type: 0, amount: 100 });
      expect(res.status).toBe(500);
      expect(reconciliationService.createReconciliation).not.toHaveBeenCalled();
    });

    it("amount 为负数时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/platform-reconciliation")
        .send({ reconciliationNo: "RC001", platformNo: "P001", platformName: "JD", type: 0, amount: -1 });
      expect(res.status).toBe(500);
      expect(reconciliationService.createReconciliation).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (reconciliationService.createReconciliation as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/platform-reconciliation")
        .send({ reconciliationNo: "RC001", platformNo: "P001", platformName: "JD", type: 0, amount: 100 });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /:id", () => {
    it("应更新对账", async () => {
      (reconciliationService.updateReconciliation as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/platform-reconciliation/1")
        .send({ status: 1, amount: 200 });
      expect(res.status).toBe(200);
      expect(reconciliationService.updateReconciliation).toHaveBeenCalledWith(
        "test-tenant",
        1,
        expect.objectContaining({ status: 1, amount: 200 })
      );
    });

    it("service 抛错时返回500", async () => {
      (reconciliationService.updateReconciliation as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/platform-reconciliation/1")
        .send({ status: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id", () => {
    it("应返回对账详情", async () => {
      (reconciliationService.getDetail as any).mockResolvedValue({ id: 1, reconciliationNo: "RC001" });
      const res = await request(app).get("/api/platform-reconciliation/1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(reconciliationService.getDetail).toHaveBeenCalledWith("test-tenant", 1);
    });

    it("service 抛错时返回500", async () => {
      (reconciliationService.getDetail as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-reconciliation/1");
      expect(res.status).toBe(500);
    });
  });
});
