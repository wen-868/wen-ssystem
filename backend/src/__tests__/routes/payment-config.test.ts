import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app.js";

vi.mock("../../services/admin/payment-config.service.js", () => ({
  PaymentConfigService: {
    getChannelConfig: vi.fn(),
    saveChannelConfig: vi.fn(),
    testConnection: vi.fn(),
    getStatus: vi.fn(),
    listBankAccounts: vi.fn(),
    createBankAccount: vi.fn(),
    updateBankAccount: vi.fn(),
    deleteBankAccount: vi.fn(),
    setDefaultBankAccount: vi.fn(),
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

import { PaymentConfigService } from "../../services/admin/payment-config.service.js";
import { paymentConfigRouter } from "../../routes/payment-config.routes.js";

const app = createTestApp({ prefix: "/api/payment-config", router: paymentConfigRouter });

describe("routes/payment-config 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /configs/:provider", () => {
    it("应返回渠道配置", async () => {
      (PaymentConfigService.getChannelConfig as any).mockResolvedValue({ provider: "WECHAT", enabled: true });
      const res = await request(app).get("/api/payment-config/configs/WECHAT");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(PaymentConfigService.getChannelConfig).toHaveBeenCalledWith("test-tenant", "WECHAT");
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.getChannelConfig as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/payment-config/configs/WECHAT");
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /configs/:provider", () => {
    it("应保存渠道配置", async () => {
      (PaymentConfigService.saveChannelConfig as any).mockResolvedValue({ success: true });
      const res = await request(app)
        .put("/api/payment-config/configs/WECHAT")
        .send({ appId: "wx123", appSecret: "secret" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(PaymentConfigService.saveChannelConfig).toHaveBeenCalledWith(
        "test-tenant",
        "WECHAT",
        expect.objectContaining({ appId: "wx123", appSecret: "secret" })
      );
    });

    it("appId 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .put("/api/payment-config/configs/WECHAT")
        .send({ appSecret: "secret" });
      expect(res.status).toBe(500);
      expect(PaymentConfigService.saveChannelConfig).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.saveChannelConfig as any).mockRejectedValue(new Error("save error"));
      const res = await request(app)
        .put("/api/payment-config/configs/WECHAT")
        .send({ appId: "wx123", appSecret: "secret" });
      expect(res.status).toBe(500);
    });
  });

  describe("POST /configs/:provider/test", () => {
    it("应测试连接", async () => {
      (PaymentConfigService.testConnection as any).mockResolvedValue({ connected: true });
      const res = await request(app).post("/api/payment-config/configs/WECHAT/test");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(PaymentConfigService.testConnection).toHaveBeenCalledWith("test-tenant", "WECHAT");
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.testConnection as any).mockRejectedValue(new Error("test error"));
      const res = await request(app).post("/api/payment-config/configs/WECHAT/test");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /status", () => {
    it("应返回支付状态", async () => {
      (PaymentConfigService.getStatus as any).mockResolvedValue({ enabled: true });
      const res = await request(app).get("/api/payment-config/status");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(PaymentConfigService.getStatus).toHaveBeenCalledWith("test-tenant");
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.getStatus as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/payment-config/status");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /bank-accounts", () => {
    it("应返回银行账户列表", async () => {
      (PaymentConfigService.listBankAccounts as any).mockResolvedValue([{ id: 1, bankName: "建行" }]);
      const res = await request(app).get("/api/payment-config/bank-accounts");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(PaymentConfigService.listBankAccounts).toHaveBeenCalledWith("test-tenant");
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.listBankAccounts as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/payment-config/bank-accounts");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /bank-accounts", () => {
    it("应创建银行账户", async () => {
      (PaymentConfigService.createBankAccount as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/payment-config/bank-accounts")
        .send({ bankName: "建行", accountName: "公司", accountNumber: "1234" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(PaymentConfigService.createBankAccount).toHaveBeenCalledWith(
        "test-tenant",
        expect.objectContaining({ bankName: "建行", accountName: "公司", accountNumber: "1234" })
      );
    });

    it("bankName 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/payment-config/bank-accounts")
        .send({ accountName: "公司", accountNumber: "1234" });
      expect(res.status).toBe(500);
      expect(PaymentConfigService.createBankAccount).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.createBankAccount as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/payment-config/bank-accounts")
        .send({ bankName: "建行", accountName: "公司", accountNumber: "1234" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /bank-accounts/:id", () => {
    it("应更新银行账户", async () => {
      (PaymentConfigService.updateBankAccount as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .put("/api/payment-config/bank-accounts/1")
        .send({ bankName: "工行" });
      expect(res.status).toBe(200);
      expect(PaymentConfigService.updateBankAccount).toHaveBeenCalledWith(
        "test-tenant",
        1,
        expect.objectContaining({ bankName: "工行" })
      );
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.updateBankAccount as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/payment-config/bank-accounts/1")
        .send({ bankName: "工行" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /bank-accounts/:id", () => {
    it("应删除银行账户", async () => {
      (PaymentConfigService.deleteBankAccount as any).mockResolvedValue({ success: true });
      const res = await request(app).delete("/api/payment-config/bank-accounts/1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(PaymentConfigService.deleteBankAccount).toHaveBeenCalledWith("test-tenant", 1);
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.deleteBankAccount as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/payment-config/bank-accounts/1");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /bank-accounts/:id/default", () => {
    it("应设置默认银行账户", async () => {
      (PaymentConfigService.setDefaultBankAccount as any).mockResolvedValue({ success: true });
      const res = await request(app).post("/api/payment-config/bank-accounts/1/default");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(PaymentConfigService.setDefaultBankAccount).toHaveBeenCalledWith("test-tenant", 1);
    });

    it("service 抛错时返回500", async () => {
      (PaymentConfigService.setDefaultBankAccount as any).mockRejectedValue(new Error("set error"));
      const res = await request(app).post("/api/payment-config/bank-accounts/1/default");
      expect(res.status).toBe(500);
    });
  });
});
