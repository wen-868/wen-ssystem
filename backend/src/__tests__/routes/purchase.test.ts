import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

vi.mock("../../services/purchase.service", () => ({
  purchaseService: {
    getPageList: vi.fn(),
    getDetail: vi.fn(),
    createOrder: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    cancel: vi.fn(),
    updateOrder: vi.fn(),
    delete: vi.fn(),
    inStock: vi.fn(),
  },
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

import { purchaseService } from "../../services/purchase.service";
import { purchaseRouter } from "../../routes/purchase.routes";

const app = createTestApp({
  prefix: "/api/admin/purchase-orders",
  router: purchaseRouter,
});

describe("routes/purchase 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /", () => {
    it("应返回采购订单列表", async () => {
      (purchaseService.getPageList as any).mockResolvedValue({ total: 0, records: [] });
      const res = await request(app).get("/api/admin/purchase-orders");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.getPageList).toHaveBeenCalledWith(
        undefined, undefined, undefined, undefined, undefined, 1, 20,
        expect.objectContaining({ tenantId: "test-tenant", userId: 1, username: "testadmin" })
      );
    });

    it("应传递所有筛选参数", async () => {
      (purchaseService.getPageList as any).mockResolvedValue({ total: 0, records: [] });
      const res = await request(app).get(
        "/api/admin/purchase-orders?keyword=测试&supplierId=1&status=DRAFT&startDate=2024-01-01&endDate=2024-12-31&page=2&pageSize=10"
      );
      expect(res.status).toBe(200);
      expect(purchaseService.getPageList).toHaveBeenCalledWith(
        "测试", 1, "DRAFT", "2024-01-01", "2024-12-31", 2, 10,
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.getPageList as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/purchase-orders");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:orderNo", () => {
    it("应返回采购订单详情", async () => {
      (purchaseService.getDetail as any).mockResolvedValue({ orderNo: "PO001", status: "DRAFT" });
      const res = await request(app).get("/api/admin/purchase-orders/PO001");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.getDetail).toHaveBeenCalledWith(
        "PO001",
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("订单不存在时返回404", async () => {
      (purchaseService.getDetail as any).mockResolvedValue(null);
      const res = await request(app).get("/api/admin/purchase-orders/NOTEXIST");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("404");
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.getDetail as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/purchase-orders/PO001");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /", () => {
    const validBody = {
      supplierId: 1,
      supplierName: "测试供应商",
      storeId: 1,
      items: [{ skuId: 1, skuName: "测试商品", unitPrice: 100 }],
    };

    it("应创建采购订单", async () => {
      (purchaseService.createOrder as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .send(validBody);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ supplierId: 1, supplierName: "测试供应商", storeId: 1 }),
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("应使用默认值", async () => {
      (purchaseService.createOrder as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .send(validBody);
      expect(res.status).toBe(200);
      expect(purchaseService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ discountAmount: 0 }),
        expect.any(Object)
      );
    });

    it("supplierId 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .send({ supplierName: "测试", storeId: 1, items: [] });
      expect(res.status).toBe(500);
      expect(purchaseService.createOrder).not.toHaveBeenCalled();
    });

    it("items 为空数组时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .send({ ...validBody, items: [] });
      expect(res.status).toBe(500);
      expect(purchaseService.createOrder).not.toHaveBeenCalled();
    });

    it("item 缺少 skuId 时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .send({ ...validBody, items: [{ skuName: "测试", unitPrice: 100 }] });
      expect(res.status).toBe(500);
      expect(purchaseService.createOrder).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.createOrder as any).mockRejectedValue(new Error("create error"));
      const res = await request(app)
        .post("/api/admin/purchase-orders")
        .send(validBody);
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:orderNo/submit", () => {
    it("应提交采购订单", async () => {
      (purchaseService.submit as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app).post("/api/admin/purchase-orders/PO001/submit");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.submit).toHaveBeenCalledWith(
        "PO001",
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("订单不存在时返回404", async () => {
      (purchaseService.submit as any).mockResolvedValue(null);
      const res = await request(app).post("/api/admin/purchase-orders/NOTEXIST/submit");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.submit as any).mockRejectedValue(new Error("submit error"));
      const res = await request(app).post("/api/admin/purchase-orders/PO001/submit");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:orderNo/approve", () => {
    it("应审核采购订单", async () => {
      (purchaseService.approve as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app).post("/api/admin/purchase-orders/PO001/approve");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.approve).toHaveBeenCalledWith(
        "PO001",
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("订单不存在时返回404", async () => {
      (purchaseService.approve as any).mockResolvedValue(null);
      const res = await request(app).post("/api/admin/purchase-orders/NOTEXIST/approve");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.approve as any).mockRejectedValue(new Error("approve error"));
      const res = await request(app).post("/api/admin/purchase-orders/PO001/approve");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:orderNo/cancel", () => {
    it("应取消采购订单", async () => {
      (purchaseService.cancel as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app).post("/api/admin/purchase-orders/PO001/cancel");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.cancel).toHaveBeenCalledWith(
        "PO001",
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("订单不存在时返回404", async () => {
      (purchaseService.cancel as any).mockResolvedValue(null);
      const res = await request(app).post("/api/admin/purchase-orders/NOTEXIST/cancel");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.cancel as any).mockRejectedValue(new Error("cancel error"));
      const res = await request(app).post("/api/admin/purchase-orders/PO001/cancel");
      expect(res.status).toBe(500);
    });
  });

  describe("PUT /:orderNo", () => {
    const validBody = {
      supplierName: "更新供应商",
      items: [{ skuId: 1, skuName: "测试商品", unitPrice: 100 }],
    };

    it("应更新采购订单", async () => {
      (purchaseService.updateOrder as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app)
        .put("/api/admin/purchase-orders/PO001")
        .send(validBody);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.updateOrder).toHaveBeenCalledWith(
        "PO001",
        expect.objectContaining({ supplierName: "更新供应商" }),
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("订单不存在时返回404", async () => {
      (purchaseService.updateOrder as any).mockResolvedValue(null);
      const res = await request(app)
        .put("/api/admin/purchase-orders/NOTEXIST")
        .send({ supplierName: "测试" });
      expect(res.status).toBe(404);
    });

    it("supplierId 为负数时 zod 校验失败", async () => {
      const res = await request(app)
        .put("/api/admin/purchase-orders/PO001")
        .send({ supplierId: -1 });
      expect(res.status).toBe(500);
      expect(purchaseService.updateOrder).not.toHaveBeenCalled();
    });

    it("item taxRate 超过1时 zod 校验失败", async () => {
      const res = await request(app)
        .put("/api/admin/purchase-orders/PO001")
        .send({ items: [{ skuId: 1, skuName: "测试", unitPrice: 100, taxRate: 2 }] });
      expect(res.status).toBe(500);
      expect(purchaseService.updateOrder).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.updateOrder as any).mockRejectedValue(new Error("update error"));
      const res = await request(app)
        .put("/api/admin/purchase-orders/PO001")
        .send(validBody);
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /:orderNo", () => {
    it("应删除采购订单", async () => {
      (purchaseService.delete as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app).delete("/api/admin/purchase-orders/PO001");
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.delete).toHaveBeenCalledWith(
        "PO001",
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("订单不存在时返回404", async () => {
      (purchaseService.delete as any).mockResolvedValue(null);
      const res = await request(app).delete("/api/admin/purchase-orders/NOTEXIST");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.delete as any).mockRejectedValue(new Error("delete error"));
      const res = await request(app).delete("/api/admin/purchase-orders/PO001");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:orderNo/in-stock", () => {
    const validBody = {
      items: [{ skuId: 1, boxQty: 1, bottleQty: 2 }],
    };

    it("应入库采购订单", async () => {
      (purchaseService.inStock as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app)
        .post("/api/admin/purchase-orders/PO001/in-stock")
        .send(validBody);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe("0");
      expect(purchaseService.inStock).toHaveBeenCalledWith(
        "PO001",
        expect.objectContaining({ items: expect.any(Array) }),
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("订单不存在时返回404", async () => {
      (purchaseService.inStock as any).mockResolvedValue(null);
      const res = await request(app)
        .post("/api/admin/purchase-orders/NOTEXIST/in-stock")
        .send(validBody);
      expect(res.status).toBe(404);
    });

    it("items 为空数组时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders/PO001/in-stock")
        .send({ items: [] });
      expect(res.status).toBe(500);
      expect(purchaseService.inStock).not.toHaveBeenCalled();
    });

    it("item 缺少 skuId 时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/admin/purchase-orders/PO001/in-stock")
        .send({ items: [{ boxQty: 1 }] });
      expect(res.status).toBe(500);
      expect(purchaseService.inStock).not.toHaveBeenCalled();
    });

    it("应使用 item 默认值", async () => {
      (purchaseService.inStock as any).mockResolvedValue({ purchaseNo: "PO001" });
      const res = await request(app)
        .post("/api/admin/purchase-orders/PO001/in-stock")
        .send({ items: [{ skuId: 1 }] });
      expect(res.status).toBe(200);
      expect(purchaseService.inStock).toHaveBeenCalledWith(
        "PO001",
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ boxQty: 0, bottleQty: 0 })
          ])
        }),
        expect.any(Object)
      );
    });

    it("service 抛错时返回500", async () => {
      (purchaseService.inStock as any).mockRejectedValue(new Error("in-stock error"));
      const res = await request(app)
        .post("/api/admin/purchase-orders/PO001/in-stock")
        .send(validBody);
      expect(res.status).toBe(500);
    });
  });
});
