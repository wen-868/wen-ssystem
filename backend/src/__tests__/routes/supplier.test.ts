import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app.js";

vi.mock("../../services/supplier.service.js", () => ({
  supplierService: {
    getPageList: vi.fn(),
    getDetail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addContact: vi.fn(),
    deleteContact: vi.fn(),
    getPurchaseOrders: vi.fn(),
    getPayments: vi.fn(),
    getProducts: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data, traceId: "test-trace", apiCost: 0 })),
  fail: vi.fn((msg, code = "400") => ({ code, msg, traceId: "test-trace", apiCost: 0 })),
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuthWithTenant: [],
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant.js", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import { supplierService } from "../../services/supplier.service.js";
import { supplierRouter } from "../../routes/supplier.routes.js";

const app = createTestApp({
  prefix: "/api/admin/suppliers",
  router: supplierRouter,
});

describe("routes/supplier 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回供应商列表", async () => {
      (supplierService.getPageList as any).mockResolvedValue({ list: [{ id: 1 }] });
      const res = await request(app).get("/api/admin/suppliers");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.getPageList).toHaveBeenCalledWith(
        undefined, undefined, undefined, 1, 20,
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("应传递筛选参数", async () => {
      (supplierService.getPageList as any).mockResolvedValue({ list: [] });
      const res = await request(app).get("/api/admin/suppliers?keyword=茅台&status=1&page=2&pageSize=10");
      expect(res.status).toBe(200);
      expect(supplierService.getPageList).toHaveBeenCalledWith(
        "茅台", undefined, "1", 2, 10,
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("service 抛错时返回500", async () => {
      (supplierService.getPageList as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/suppliers");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id", () => {
    it("应返回供应商详情", async () => {
      (supplierService.getDetail as any).mockResolvedValue({ id: 1, name: "供应商A" });
      const res = await request(app).get("/api/admin/suppliers/1");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.getDetail).toHaveBeenCalledWith(1, expect.objectContaining({ tenantId: "test-tenant" }));
    });

    it("供应商不存在时返回404", async () => {
      (supplierService.getDetail as any).mockResolvedValue(null);
      const res = await request(app).get("/api/admin/suppliers/999");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("404");
    });

    it("service 抛错时返回500", async () => {
      (supplierService.getDetail as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/suppliers/1");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /", () => {
    it("应创建供应商", async () => {
      (supplierService.create as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/admin/suppliers")
        .send({ name: "新供应商", settlementType: "CASH" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "新供应商", settlementType: "CASH" }),
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("应使用默认值", async () => {
      (supplierService.create as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/admin/suppliers")
        .send({ name: "测试供应商" });
      expect(res.status).toBe(200);
      expect(supplierService.create).toHaveBeenCalledWith(
        expect.objectContaining({ creditLevel: "B", settlementType: "CASH", taxRate: 0 }),
        expect.any(Object)
      );
    });

    it("name 缺失时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .send({ settlementType: "CASH" });
      expect(res.status).toBe(500);
      expect(supplierService.create).not.toHaveBeenCalled();
    });

    it("name 为空字符串时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .send({ name: "" });
      expect(res.status).toBe(500);
      expect(supplierService.create).not.toHaveBeenCalled();
    });

    it("settlementDay 超过31时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .send({ name: "测试", settlementDay: 32 });
      expect(res.status).toBe(500);
      expect(supplierService.create).not.toHaveBeenCalled();
    });

    it("taxRate 超过1时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .send({ name: "测试", taxRate: 2 });
      expect(res.status).toBe(500);
      expect(supplierService.create).not.toHaveBeenCalled();
    });

    it("settlementType 非法时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers")
        .send({ name: "测试", settlementType: "INVALID" });
      expect(res.status).toBe(500);
      expect(supplierService.create).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (supplierService.create as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/admin/suppliers")
        .send({ name: "测试" });
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /:id", () => {
    it("应更新供应商", async () => {
      (supplierService.update as any).mockResolvedValue(true);
      const res = await request(app)
        .put("/api/admin/suppliers/1")
        .send({ name: "更新名称" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "更新名称" }),
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("供应商不存在时返回404", async () => {
      (supplierService.update as any).mockResolvedValue(false);
      const res = await request(app)
        .put("/api/admin/suppliers/999")
        .send({ name: "更新" });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("404");
    });

    it("name 为空字符串时 zod 校验失败", async () => {
      const res = await request(app)
        .put("/api/admin/suppliers/1")
        .send({ name: "" });
      expect(res.status).toBe(500);
      expect(supplierService.update).not.toHaveBeenCalled();
    });

    it("settlementType 非法时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .put("/api/admin/suppliers/1")
        .send({ settlementType: "BAD" });
      expect(res.status).toBe(500);
      expect(supplierService.update).not.toHaveBeenCalled();
    });

    it("settlementDay 小于1时 zod 校验失败", async () => {
      const res = await request(app)
        .put("/api/admin/suppliers/1")
        .send({ settlementDay: 0 });
      expect(res.status).toBe(500);
      expect(supplierService.update).not.toHaveBeenCalled();
    });

    it("status 超过1时 zod 校验失败", async () => {
      const res = await request(app)
        .put("/api/admin/suppliers/1")
        .send({ status: 2 });
      expect(res.status).toBe(500);
      expect(supplierService.update).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (supplierService.update as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/admin/suppliers/1")
        .send({ name: "测试" });
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:id/contacts", () => {
    it("应添加联系人", async () => {
      (supplierService.addContact as any).mockResolvedValue({ id: 10 });
      const res = await request(app)
        .post("/api/admin/suppliers/1/contacts")
        .send({ name: "联系人A" });
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.addContact).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "联系人A" }),
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("应使用 isPrimary 默认值", async () => {
      (supplierService.addContact as any).mockResolvedValue({ id: 10 });
      const res = await request(app)
        .post("/api/admin/suppliers/1/contacts")
        .send({ name: "联系人A" });
      expect(res.status).toBe(200);
      expect(supplierService.addContact).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ isPrimary: false }),
        expect.any(Object)
      );
    });

    it("供应商不存在时返回404", async () => {
      (supplierService.addContact as any).mockResolvedValue(null);
      const res = await request(app)
        .post("/api/admin/suppliers/999/contacts")
        .send({ name: "联系人" });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("404");
    });

    it("name 缺失时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers/1/contacts")
        .send({ mobile: "13800000000" });
      expect(res.status).toBe(500);
      expect(supplierService.addContact).not.toHaveBeenCalled();
    });

    it("email 格式非法时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers/1/contacts")
        .send({ name: "测试", email: "invalid-email" });
      expect(res.status).toBe(500);
      expect(supplierService.addContact).not.toHaveBeenCalled();
    });

    it("name 为空字符串时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/suppliers/1/contacts")
        .send({ name: "" });
      expect(res.status).toBe(500);
      expect(supplierService.addContact).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (supplierService.addContact as any).mockRejectedValue(new Error("err"));
      const res = await request(app)
        .post("/api/admin/suppliers/1/contacts")
        .send({ name: "联系人" });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /:id/contacts/:contactId", () => {
    it("应删除联系人", async () => {
      (supplierService.deleteContact as any).mockResolvedValue(true);
      const res = await request(app).delete("/api/admin/suppliers/1/contacts/10");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.deleteContact).toHaveBeenCalledWith(
        1, 10, expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("供应商不存在时返回404", async () => {
      (supplierService.deleteContact as any).mockResolvedValue(null);
      const res = await request(app).delete("/api/admin/suppliers/999/contacts/10");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("404");
    });

    it("联系人不存在时返回404", async () => {
      (supplierService.deleteContact as any).mockResolvedValue(false);
      const res = await request(app).delete("/api/admin/suppliers/1/contacts/999");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("404");
    });

    it("service 抛错时返回500", async () => {
      (supplierService.deleteContact as any).mockRejectedValue(new Error("err"));
      const res = await request(app).delete("/api/admin/suppliers/1/contacts/10");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id/purchase-orders", () => {
    it("应返回采购订单列表", async () => {
      (supplierService.getPurchaseOrders as any).mockResolvedValue({ list: [] });
      const res = await request(app).get("/api/admin/suppliers/1/purchase-orders");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.getPurchaseOrders).toHaveBeenCalledWith(
        1, undefined, 1, 20, expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("供应商不存在时返回404", async () => {
      (supplierService.getPurchaseOrders as any).mockResolvedValue(null);
      const res = await request(app).get("/api/admin/suppliers/999/purchase-orders");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (supplierService.getPurchaseOrders as any).mockRejectedValue(new Error("err"));
      const res = await request(app).get("/api/admin/suppliers/1/purchase-orders");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id/payments", () => {
    it("应返回付款记录", async () => {
      (supplierService.getPayments as any).mockResolvedValue({ list: [] });
      const res = await request(app).get("/api/admin/suppliers/1/payments");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.getPayments).toHaveBeenCalledWith(
        1, 1, 20, expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("供应商不存在时返回404", async () => {
      (supplierService.getPayments as any).mockResolvedValue(null);
      const res = await request(app).get("/api/admin/suppliers/999/payments");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (supplierService.getPayments as any).mockRejectedValue(new Error("err"));
      const res = await request(app).get("/api/admin/suppliers/1/payments");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id/products", () => {
    it("应返回商品列表", async () => {
      (supplierService.getProducts as any).mockResolvedValue({ list: [] });
      const res = await request(app).get("/api/admin/suppliers/1/products?keyword=酒");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.getProducts).toHaveBeenCalledWith(
        1, "酒", 1, 20, expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("供应商不存在时返回404", async () => {
      (supplierService.getProducts as any).mockResolvedValue(null);
      const res = await request(app).get("/api/admin/suppliers/999/products");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (supplierService.getProducts as any).mockRejectedValue(new Error("err"));
      const res = await request(app).get("/api/admin/suppliers/1/products");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:id/stats", () => {
    it("应返回统计信息", async () => {
      (supplierService.getStats as any).mockResolvedValue({ totalOrders: 10 });
      const res = await request(app).get("/api/admin/suppliers/1/stats");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(supplierService.getStats).toHaveBeenCalledWith(1, expect.objectContaining({ tenantId: "test-tenant" }));
    });

    it("供应商不存在时返回404", async () => {
      (supplierService.getStats as any).mockResolvedValue(null);
      const res = await request(app).get("/api/admin/suppliers/999/stats");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (supplierService.getStats as any).mockRejectedValue(new Error("err"));
      const res = await request(app).get("/api/admin/suppliers/1/stats");
      expect(res.status).toBe(500);
    });
  });
});
