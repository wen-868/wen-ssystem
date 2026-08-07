import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/admin/platform-reconciliation.service", () => ({
  listReconciliations: vi.fn(),
  createReconciliation: vi.fn(),
  updateReconciliation: vi.fn(),
  getDetail: vi.fn(),
}));

vi.mock("../../services/admin/platform-settlement.service", () => ({
  listSettlements: vi.fn(),
  getSettlementById: vi.fn(),
  getSettlementStats: vi.fn(),
  updateSettlementStatus: vi.fn(),
}));

vi.mock("../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace" })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace" })),
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
import * as settlementService from "../../services/admin/platform-settlement.service";
import { platformReconciliationRouter } from "../../routes/platform-reconciliation.routes";

const app = createTestApp({ prefix: "/api/platform-reconciliation", router: platformReconciliationRouter });

describe("routes/platform-reconciliation 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回财务结算列表（平台视角，数据源 t_platform_settlement）", async () => {
      (settlementService.listSettlements as any).mockResolvedValue({
        records: [{
          id: 1,
          settlementNo: "SET123",
          tenantName: "测试租户",
          periodStart: "2026-07-01",
          periodEnd: "2026-07-31",
          totalAmount: 1000,
          settledAmount: 800,
          status: "PENDING",
          createdAt: "2026-08-01T00:00:00.000Z",
        }],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      const res = await request(app).get("/api/platform-reconciliation");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(settlementService.listSettlements).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
      expect(res.body.data.records[0]).toEqual(expect.objectContaining({
        reconciliationNo: "SET123",
        tenantName: "测试租户",
        period: "2026-07-01 ~ 2026-07-31",
        orderAmount: 1000,
        settleAmount: 800,
        status: "PENDING",
      }));
    });

    it("应传递 keyword/status 筛选参数", async () => {
      (settlementService.listSettlements as any).mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 20 });
      const res = await request(app).get("/api/platform-reconciliation?keyword=测试&status=SETTLED");
      expect(res.status).toBe(200);
      expect(settlementService.listSettlements).toHaveBeenCalledWith(
        expect.objectContaining({ tenantName: "测试", status: "SETTLED" })
      );
    });

    it("service 抛错时返回500", async () => {
      (settlementService.listSettlements as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-reconciliation");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /stats", () => {
    it("应返回财务结算统计（对齐 saas-admin 字段）", async () => {
      (settlementService.getSettlementStats as any).mockResolvedValue({
        currentMonthRevenue: 1000,
        pendingSettlement: 200,
        settledAmount: 800,
        settlementCount: 5,
      });
      const res = await request(app).get("/api/platform-reconciliation/stats");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        monthlyRevenue: 1000,
        pendingAmount: 200,
        settledAmount: 800,
        totalCount: 5,
      });
    });
  });

  describe("PUT /:id/settle", () => {
    it("应确认结算（置为 SETTLED）", async () => {
      (settlementService.updateSettlementStatus as any).mockResolvedValue({ id: 1, status: "SETTLED" });
      const res = await request(app).put("/api/platform-reconciliation/1/settle");
      expect(res.status).toBe(200);
      expect(settlementService.updateSettlementStatus).toHaveBeenCalledWith(1, "SETTLED");
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
  });

  describe("GET /:id", () => {
    it("应返回财务结算详情（平台视角）", async () => {
      (settlementService.getSettlementById as any).mockResolvedValue({
        id: 1,
        settlementNo: "SET123",
        tenantName: "测试租户",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        totalAmount: 1000,
        settledAmount: 800,
        status: "PENDING",
        createdAt: "2026-08-01T00:00:00.000Z",
      });
      const res = await request(app).get("/api/platform-reconciliation/1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(settlementService.getSettlementById).toHaveBeenCalledWith(1);
      expect(res.body.data.reconciliationNo).toBe("SET123");
    });

    it("service 抛错时返回500", async () => {
      (settlementService.getSettlementById as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/platform-reconciliation/1");
      expect(res.status).toBe(500);
    });
  });
});
