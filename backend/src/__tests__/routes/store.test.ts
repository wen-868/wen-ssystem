import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";
import { z } from "zod";

// 打破循环依赖：store.routes.ts → sale-bill.controller.ts → store-sale-bill.routes.ts → sale-bill.controller.ts
vi.mock("../../routes/store-sale-bill.routes", () => ({
  storeSaleBillRouter: { use: vi.fn(), get: vi.fn(), post: vi.fn() },
  storeSaleBillItemSchema: z.object({}).passthrough(),
  normalizeStoreSaleBillItem: vi.fn((input: unknown) => input),
  routeConfig: { prefix: "/api/store", router: {}, auth: "none" },
}));

vi.mock("../../services/store/auth.service", () => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  getStoreInfo: vi.fn(),
}));

vi.mock("../../services/store/product.service", () => ({
  listProducts: vi.fn(),
  listMembers: vi.fn(),
  getCategories: vi.fn(),
  getProductDetail: vi.fn(),
}));

vi.mock("../../services/store/order.service", () => ({
  listOrders: vi.fn(),
  getOrderDetail: vi.fn(),
  acceptOrder: vi.fn(),
  startDelivery: vi.fn(),
  completeDelivery: vi.fn(),
  rejectOrder: vi.fn(),
  cancelOrder: vi.fn(),
}));

vi.mock("../../services/store/sale-bill.service", () => ({
  listSaleBills: vi.fn(),
  getSaleBillDetail: vi.fn(),
  createSaleBill: vi.fn(),
  createCollectionLink: vi.fn(),
  offlinePayment: vi.fn(),
  paymentOnSaleBill: vi.fn(),
  listOverdueBills: vi.fn(),
  checkOverdueBills: vi.fn(),
}));

vi.mock("../../services/store/inventory.service", () => ({
  listInventory: vi.fn(),
  adjustInventory: vi.fn(),
  listInventoryLogs: vi.fn(),
  listInventoryAlerts: vi.fn(),
}));

vi.mock("../../services/store/other.service", () => ({
  createHoldOrder: vi.fn(),
  listHoldOrders: vi.fn(),
  restoreHoldOrder: vi.fn(),
  deleteHoldOrder: vi.fn(),
  listCollectionLinks: vi.fn(),
  listPaymentOrders: vi.fn(),
  listRefundOrders: vi.fn(),
}));

vi.mock("../../services/store/receivable.service", () => ({
  listReceivables: vi.fn(),
  paymentOnReceivable: vi.fn(),
  getDashboard: vi.fn(),
  getDailySales: vi.fn(),
}));

vi.mock("../../services/store/shift.service", () => ({
  getCurrentShift: vi.fn(),
  settleShift: vi.fn(),
  getShiftHistory: vi.fn(),
}));

vi.mock("../../services/admin/tag.service", () => ({
  listGroups: vi.fn(),
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  getProductTags: vi.fn(),
  setProductTags: vi.fn(),
}));

vi.mock("../../services/admin/inventory-batch.service", () => ({
  listBatches: vi.fn(),
  getBatchDetail: vi.fn(),
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  splitBatch: vi.fn(),
  getFifoSuggestion: vi.fn(),
  listExpiryConfigs: vi.fn(),
  createExpiryConfig: vi.fn(),
  updateExpiryConfig: vi.fn(),
  deleteExpiryConfig: vi.fn(),
  listExpiryAlerts: vi.fn(),
  handleExpiryAlert: vi.fn(),
  getExpiryAlertStatistics: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  transaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../shared/price-guard", () => ({
  canAccessPriceField: vi.fn().mockReturnValue(true),
  canAccessPriceLevel: vi.fn().mockResolvedValue(true),
  logUnauthorizedAccess: vi.fn().mockResolvedValue(undefined),
  filterPriceFields: vi.fn((user, data) => ({ filtered: data, blocked: [] })),
  filterPriceFieldsBatch: vi.fn((user, data) => ({ filtered: data, blocked: [] })),
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
  getUserAccessInfo: vi.fn().mockReturnValue({ accessModes: ["ADMIN", "CASHIER"], defaultMode: "ADMIN" }),
  signToken: vi.fn().mockReturnValue("fake-token"),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
  getTenantId: (req: any) => req.tenantId || "default",
}));

import * as authService from "../../services/store/auth.service";
import * as productService from "../../services/store/product.service";
import * as orderService from "../../services/store/order.service";
import * as saleBillService from "../../services/store/sale-bill.service";
import * as inventoryService from "../../services/store/inventory.service";
import * as otherService from "../../services/store/other.service";
import * as receivableService from "../../services/store/receivable.service";
import * as shiftService from "../../services/store/shift.service";
import * as tagService from "../../services/admin/tag.service";
import * as batchService from "../../services/admin/inventory-batch.service";
import { storeRouter } from "../../routes/store.routes";

const app = createTestApp({ prefix: "/api/store", router: storeRouter });

describe("routes/store 集成测试", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /me", () => {
    it("应返回当前用户", async () => {
      (authService.getCurrentUser as any).mockReturnValue({ id: 1, username: "testadmin" });
      const res = await request(app).get("/api/store/me");
      expect(res.status).toBe(200);
      expect(authService.getCurrentUser).toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      (authService.getCurrentUser as any).mockImplementation(() => { throw new Error("err"); });
      const res = await request(app).get("/api/store/me");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /info", () => {
    it("应返回门店信息", async () => {
      (authService.getStoreInfo as any).mockResolvedValue({ id: 1, name: "测试门店" });
      const res = await request(app).get("/api/store/info");
      expect(res.status).toBe(200);
      expect(authService.getStoreInfo).toHaveBeenCalledWith(1, "test-tenant");
    });

    it("门店不存在时返回404", async () => {
      (authService.getStoreInfo as any).mockResolvedValue(null);
      const res = await request(app).get("/api/store/info");
      expect(res.status).toBe(404);
    });

    it("service 抛错时返回500", async () => {
      (authService.getStoreInfo as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/store/info");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /products", () => {
    it("应返回产品列表", async () => {
      (productService.listProducts as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/store/products?keyword=测试");
      expect(res.status).toBe(200);
      expect(productService.listProducts).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "测试", tenantId: "test-tenant" })
      );
    });

    it("service 抛错时返回500", async () => {
      (productService.listProducts as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/store/products");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /product-categories", () => {
    it("应返回分类列表", async () => {
      (productService.getCategories as any).mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get("/api/store/product-categories");
      expect(res.status).toBe(200);
      expect(productService.getCategories).toHaveBeenCalledWith("test-tenant");
    });
  });

  describe("GET /products/:spuId", () => {
    it("应返回产品详情", async () => {
      (productService.getProductDetail as any).mockResolvedValue({ id: 1 });
      const res = await request(app).get("/api/store/products/1");
      expect(res.status).toBe(200);
      expect(productService.getProductDetail).toHaveBeenCalledWith(1, "test-tenant");
    });

    it("service 抛错时返回500", async () => {
      (productService.getProductDetail as any).mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/store/products/1");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /members", () => {
    it("应返回会员列表", async () => {
      (productService.listMembers as any).mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get("/api/store/members?keyword=张");
      expect(res.status).toBe(200);
      expect(productService.listMembers).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "张", tenantId: "test-tenant" })
      );
    });
  });

  describe("GET /orders", () => {
    it("应返回订单列表", async () => {
      (orderService.listOrders as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/store/orders?status=PENDING");
      expect(res.status).toBe(200);
      expect(orderService.listOrders).toHaveBeenCalledWith(
        expect.objectContaining({ status: "PENDING", tenantId: "test-tenant" })
      );
    });
  });

  describe("GET /orders/:orderNo", () => {
    it("应返回订单详情", async () => {
      (orderService.getOrderDetail as any).mockResolvedValue({ orderNo: "O001" });
      const res = await request(app).get("/api/store/orders/O001");
      expect(res.status).toBe(200);
    });

    it("订单不存在时返回404", async () => {
      (orderService.getOrderDetail as any).mockResolvedValue(null);
      const res = await request(app).get("/api/store/orders/O001");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /orders/:orderNo/accept", () => {
    it("应接单", async () => {
      (orderService.acceptOrder as any).mockResolvedValue({ accepted: true });
      const res = await request(app).post("/api/store/orders/O001/accept");
      expect(res.status).toBe(200);
    });

    it("订单不存在时返回404", async () => {
      (orderService.acceptOrder as any).mockResolvedValue(null);
      const res = await request(app).post("/api/store/orders/O001/accept");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /sale-bills", () => {
    it("应返回销售单列表", async () => {
      (saleBillService.listSaleBills as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/store/sale-bills");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /sale-bills", () => {
    it("应创建销售单", async () => {
      (saleBillService.createSaleBill as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/store/sale-bills")
        .send({ items: [{ skuId: 1, totalBottleQty: 2, unitPrice: 10 }] });
      expect(res.status).toBe(200);
    });

    it("items 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/store/sale-bills")
        .send({});
      expect(res.status).toBe(500);
      expect(saleBillService.createSaleBill).not.toHaveBeenCalled();
    });
  });

  describe("GET /sale-bills/:billNo", () => {
    it("应返回销售单详情", async () => {
      (saleBillService.getSaleBillDetail as any).mockResolvedValue({ billNo: "B001" });
      const res = await request(app).get("/api/store/sale-bills/B001");
      expect(res.status).toBe(200);
    });

    it("销售单不存在时返回404", async () => {
      (saleBillService.getSaleBillDetail as any).mockResolvedValue(null);
      const res = await request(app).get("/api/store/sale-bills/B001");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /inventory", () => {
    it("应返回库存列表", async () => {
      (inventoryService.listInventory as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/store/inventory");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /inventory/adjust", () => {
    it("应调整库存", async () => {
      (inventoryService.adjustInventory as any).mockResolvedValue({ adjusted: true });
      const res = await request(app)
        .post("/api/store/inventory/adjust")
        .send({ skuId: 1, change: 10 });
      expect(res.status).toBe(200);
    });

    it("skuId 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/store/inventory/adjust")
        .send({ change: 10 });
      expect(res.status).toBe(500);
    });
  });

  describe("POST /hold-orders", () => {
    it("应创建挂单", async () => {
      (otherService.createHoldOrder as any).mockResolvedValue({ id: 1 });
      const res = await request(app)
        .post("/api/store/hold-orders")
        .send({ customerName: "张三" });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /collection-links", () => {
    it("应返回收款链接列表", async () => {
      (otherService.listCollectionLinks as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/store/collection-links");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /receivables", () => {
    it("应返回应收列表", async () => {
      (receivableService.listReceivables as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/store/receivables");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /receivables/:receivableNo/payment", () => {
    it("应支付应收单", async () => {
      (receivableService.paymentOnReceivable as any).mockResolvedValue({ paid: true });
      const res = await request(app)
        .post("/api/store/receivables/R001/payment")
        .send({ amount: 100, paymentMethod: "CASH" });
      expect(res.status).toBe(200);
    });

    it("amount 缺失时 zod 校验失败", async () => {
      const res = await request(app)
        .post("/api/store/receivables/R001/payment")
        .send({ paymentMethod: "CASH" });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /dashboard", () => {
    it("应返回仪表盘数据", async () => {
      (receivableService.getDashboard as any).mockResolvedValue({ total: 100 });
      const res = await request(app).get("/api/store/dashboard");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /daily-sales", () => {
    it("应返回日销售额", async () => {
      (receivableService.getDailySales as any).mockResolvedValue([]);
      const res = await request(app).get("/api/store/daily-sales");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /shift/current", () => {
    it("应返回当前班次", async () => {
      (shiftService.getCurrentShift as any).mockResolvedValue({ id: 1 });
      const res = await request(app).get("/api/store/shift/current");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /shift/settle", () => {
    it("应结算班次", async () => {
      (shiftService.settleShift as any).mockResolvedValue({ settled: true });
      const res = await request(app)
        .post("/api/store/shift/settle")
        .send({ actualAmount: 1000 });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /shift/history", () => {
    it("应返回班次历史", async () => {
      (shiftService.getShiftHistory as any).mockResolvedValue({ list: [], total: 0 });
      const res = await request(app).get("/api/store/shift/history");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /tags", () => {
    it("应返回标签列表", async () => {
      (tagService.listTags as any).mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get("/api/store/tags");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /tag-groups", () => {
    it("应返回标签组列表", async () => {
      (tagService.listGroups as any).mockResolvedValue([{ id: 1 }]);
      const res = await request(app).get("/api/store/tag-groups");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /batches/:id", () => {
    it("应返回批次详情", async () => {
      (batchService.getBatchDetail as any).mockResolvedValue({ id: 1 });
      const res = await request(app).get("/api/store/batches/1");
      expect(res.status).toBe(200);
    });

    it("批次不存在时返回404", async () => {
      (batchService.getBatchDetail as any).mockResolvedValue(null);
      const res = await request(app).get("/api/store/batches/1");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /batches/:id/trace", () => {
    it("应返回批次追溯链", async () => {
      (batchService.getBatchDetail as any).mockResolvedValue({ id: 1 });
      const res = await request(app).get("/api/store/batches/1/trace");
      expect(res.status).toBe(200);
    });

    it("批次不存在时返回404", async () => {
      (batchService.getBatchDetail as any).mockResolvedValue(null);
      const res = await request(app).get("/api/store/batches/1/trace");
      expect(res.status).toBe(404);
    });
  });
});
