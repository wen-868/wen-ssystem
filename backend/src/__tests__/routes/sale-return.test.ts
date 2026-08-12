import { vi, describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../fixtures/create-test-app";

const mocks = vi.hoisted(() => ({
  saleReturnService: {
    getPageList: vi.fn(),
    getDetail: vi.fn(),
    createReturn: vi.fn(),
    approve: vi.fn(),
    refund: vi.fn(),
    getSaleBill: vi.fn(),
  },
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code: string = "400") => ({ code, message: msg })),
}));

vi.mock("../../services/sale-return.service", () => ({
  saleReturnService: mocks.saleReturnService,
}));

vi.mock("../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../middleware/auth", () => ({
  requireAuthWithTenant: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/tenant", () => ({
  tenantMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import { saleReturnRouter, routeConfigs } from "../../routes/sale-return.routes";

const app = createTestApp({
  prefix: "/api/admin/sale-returns",
  router: saleReturnRouter,
});

describe("routes/sale-return 集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ok.mockImplementation((data?: any) => ({ code: "0", data }));
    mocks.fail.mockImplementation((msg: string, code: string = "400") => ({ code, message: msg }));
  });

  describe("routeConfigs 导出", () => {
    it("应导出 routeConfigs 数组", () => {
      expect(Array.isArray(routeConfigs)).toBe(true);
      expect(routeConfigs).toHaveLength(2);
    });

    it("门店端销退路由配置应正确", () => {
      const storeConfig = routeConfigs[0];
      expect(storeConfig).toBeDefined();
      expect(storeConfig.prefix).toBe("/api/store/sale-returns");
      expect(storeConfig.router).toBeDefined();
      expect(storeConfig.auth).toBe("requireAuthWithTenant");
    });

    it("工作台销退路由配置应正确", () => {
      const adminConfig = routeConfigs[1];
      expect(adminConfig).toBeDefined();
      expect(adminConfig.prefix).toBe("/api/admin/sale-returns");
      expect(adminConfig.router).toBeDefined();
      expect(adminConfig.auth).toBe("requireAuthWithTenant");
    });

    it("所有 router 都应该是 Router 实例", () => {
      routeConfigs.forEach((cfg) => {
        expect(typeof cfg.router.get).toBe("function");
        expect(typeof cfg.router.post).toBe("function");
        expect(typeof cfg.router.put).toBe("function");
        expect(typeof cfg.router.delete).toBe("function");
      });
    });
  });

  describe("GET / — 列表", () => {
    it("应返回退货单列表（默认分页）", async () => {
      mocks.saleReturnService.getPageList.mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/admin/sale-returns/");
      expect(res.status).toBe(200);
      expect(mocks.saleReturnService.getPageList).toHaveBeenCalledWith(
        undefined, undefined, undefined, undefined, undefined, undefined, 1, 20,
        expect.objectContaining({ tenantId: "test-tenant", userId: 1, username: "testadmin", storeId: undefined })
      );
    });

    it("应支持所有查询参数", async () => {
      mocks.saleReturnService.getPageList.mockResolvedValue({ records: [], total: 0 });
      const res = await request(app).get("/api/admin/sale-returns/")
        .query({
          keyword: "测试",
          storeId: "1",
          customerId: "2",
          status: "PENDING",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          page: "2",
          pageSize: "10",
        });
      expect(res.status).toBe(200);
      expect(mocks.saleReturnService.getPageList).toHaveBeenCalledWith(
        "测试", 1, 2, "PENDING", "2024-01-01", "2024-12-31", 2, 10,
        expect.any(Object)
      );
    });

    it("service 抛错时返回500", async () => {
      mocks.saleReturnService.getPageList.mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/sale-returns/");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /:returnNo — 详情", () => {
    it("应返回退货单详情", async () => {
      mocks.saleReturnService.getDetail.mockResolvedValue({ returnNo: "RT001", items: [] });
      const res = await request(app).get("/api/admin/sale-returns/RT001");
      expect(res.status).toBe(200);
      expect(mocks.saleReturnService.getDetail).toHaveBeenCalledWith(
        "RT001",
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("退货单不存在时返回404", async () => {
      mocks.saleReturnService.getDetail.mockResolvedValue(null);
      const res = await request(app).get("/api/admin/sale-returns/NOT_EXIST");
      expect(res.status).toBe(404);
      expect(mocks.fail).toHaveBeenCalledWith("退货单不存在", "404");
    });

    it("service 抛错时返回500", async () => {
      mocks.saleReturnService.getDetail.mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/sale-returns/RT001");
      expect(res.status).toBe(500);
    });
  });

  describe("POST / — 创建", () => {
    const validBody = {
      storeId: 1,
      items: [
        { skuId: 1, skuName: "商品A", boxQty: 1, bottleQty: 0, unitPrice: 10 },
      ],
    };

    it("应创建退货单", async () => {
      mocks.saleReturnService.createReturn.mockResolvedValue({ returnNo: "RT001" });
      const res = await request(app)
        .post("/api/admin/sale-returns/")
        .send(validBody);
      expect(res.status).toBe(200);
      expect(mocks.saleReturnService.createReturn).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: 1, items: expect.any(Array) }),
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("应支持完整参数", async () => {
      mocks.saleReturnService.createReturn.mockResolvedValue({ returnNo: "RT001" });
      const res = await request(app)
        .post("/api/admin/sale-returns/")
        .send({
          sourceBillNo: "SB001",
          storeId: 1,
          customerId: 2,
          customerName: "张三",
          customerMobile: "13800138000",
          discountAmount: 5,
          remark: "测试备注",
          items: [
            { skuId: 1, skuName: "商品A", boxQty: 1, bottleQty: 2, unitPrice: 10, reason: "质量问题" },
          ],
        });
      expect(res.status).toBe(200);
    });

    it("storeId 缺失时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/admin/sale-returns/")
        .send({ items: [{ skuId: 1, skuName: "A", unitPrice: 10 }] });
      expect(res.status).toBe(500);
      expect(mocks.saleReturnService.createReturn).not.toHaveBeenCalled();
    });

    it("items 为空数组时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/admin/sale-returns/")
        .send({ storeId: 1, items: [] });
      expect(res.status).toBe(500);
      expect(mocks.saleReturnService.createReturn).not.toHaveBeenCalled();
    });

    it("service 抛错时返回500", async () => {
      mocks.saleReturnService.createReturn.mockRejectedValue(new Error("db error"));
      const res = await request(app)
        .post("/api/admin/sale-returns/")
        .send(validBody);
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:returnNo/approve — 审核", () => {
    it("应审核通过", async () => {
      mocks.saleReturnService.approve.mockResolvedValue({ returnNo: "RT001", returnStatus: "APPROVED" });
      const res = await request(app).post("/api/admin/sale-returns/RT001/approve");
      expect(res.status).toBe(200);
      expect(mocks.saleReturnService.approve).toHaveBeenCalledWith(
        "RT001",
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("退货单不存在时 AppError 404", async () => {
      mocks.saleReturnService.approve.mockResolvedValue(null);
      const res = await request(app).post("/api/admin/sale-returns/NOT_EXIST/approve");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("退货单不存在");
    });

    it("service 抛错时返回500", async () => {
      mocks.saleReturnService.approve.mockRejectedValue(new Error("db error"));
      const res = await request(app).post("/api/admin/sale-returns/RT001/approve");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /:returnNo/refund — 退款", () => {
    it("应退款成功", async () => {
      mocks.saleReturnService.refund.mockResolvedValue({ returnNo: "RT001", refundStatus: "REFUNDED" });
      const res = await request(app)
        .post("/api/admin/sale-returns/RT001/refund")
        .send({ refundMethod: "CASH" });
      expect(res.status).toBe(200);
      expect(mocks.saleReturnService.refund).toHaveBeenCalledWith(
        "RT001",
        { refundMethod: "CASH" },
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("应支持 WECHAT 退款方式", async () => {
      mocks.saleReturnService.refund.mockResolvedValue({ returnNo: "RT001" });
      const res = await request(app)
        .post("/api/admin/sale-returns/RT001/refund")
        .send({ refundMethod: "WECHAT" });
      expect(res.status).toBe(200);
    });

    it("应支持 BANK 退款方式", async () => {
      mocks.saleReturnService.refund.mockResolvedValue({ returnNo: "RT001" });
      const res = await request(app)
        .post("/api/admin/sale-returns/RT001/refund")
        .send({ refundMethod: "BANK" });
      expect(res.status).toBe(200);
    });

    it("refundMethod 缺失时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/admin/sale-returns/RT001/refund")
        .send({});
      expect(res.status).toBe(500);
      expect(mocks.saleReturnService.refund).not.toHaveBeenCalled();
    });

    it("refundMethod 枚举值非法时 zod 校验失败返回500", async () => {
      const res = await request(app)
        .post("/api/admin/sale-returns/RT001/refund")
        .send({ refundMethod: "INVALID" });
      expect(res.status).toBe(500);
      expect(mocks.saleReturnService.refund).not.toHaveBeenCalled();
    });

    it("退货单不存在时 AppError 404", async () => {
      mocks.saleReturnService.refund.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/admin/sale-returns/NOT_EXIST/refund")
        .send({ refundMethod: "CASH" });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("退货单不存在");
    });

    it("service 抛错时返回500", async () => {
      mocks.saleReturnService.refund.mockRejectedValue(new Error("db error"));
      const res = await request(app)
        .post("/api/admin/sale-returns/RT001/refund")
        .send({ refundMethod: "CASH" });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /sale-bills/:billNo — 查询销售单", () => {
    it("应返回销售单详情", async () => {
      mocks.saleReturnService.getSaleBill.mockResolvedValue({ billNo: "SB001", items: [] });
      const res = await request(app).get("/api/admin/sale-returns/sale-bills/SB001");
      expect(res.status).toBe(200);
      expect(mocks.saleReturnService.getSaleBill).toHaveBeenCalledWith(
        "SB001",
        expect.objectContaining({ tenantId: "test-tenant" })
      );
    });

    it("销售单不存在时返回404", async () => {
      mocks.saleReturnService.getSaleBill.mockResolvedValue(null);
      const res = await request(app).get("/api/admin/sale-returns/sale-bills/NOT_EXIST");
      expect(res.status).toBe(404);
      expect(mocks.fail).toHaveBeenCalledWith("销售单不存在", "404");
    });

    it("service 抛错时返回500", async () => {
      mocks.saleReturnService.getSaleBill.mockRejectedValue(new Error("db error"));
      const res = await request(app).get("/api/admin/sale-returns/sale-bills/SB001");
      expect(res.status).toBe(500);
    });
  });
});
