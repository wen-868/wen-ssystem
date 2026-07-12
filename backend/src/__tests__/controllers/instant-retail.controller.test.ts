import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/instant-retail.service.js", () => ({
  getShopConfig: vi.fn(),
  saveShopConfig: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  listRetailProducts: vi.fn(),
  addRetailProduct: vi.fn(),
  listRetailOrders: vi.fn(),
  getRetailOrderDetail: vi.fn(),
  updateRetailOrderStatus: vi.fn(),
  listBanners: vi.fn(),
  createBanner: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as instantRetailService from "../../../services/admin/instant-retail.service.js";
import { ok } from "../../../shared/response.js";
import {
  getShopConfig,
  saveShopConfig,
  listCategories,
  createCategory,
  listProducts,
  addProduct,
  listOrders,
  getOrderDetail,
  updateOrderStatus,
  listBanners,
  createBanner,
} from "../../../controllers/instant-retail.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
  ...overrides,
});

const mockRes = () => {
  const res: any = {};
  res.json = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.send = vi.fn();
  return res;
};

describe("instant-retail.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("shop config", () => {
    it("getShopConfig - 应获取店铺配置", async () => {
      (instantRetailService.getShopConfig as any).mockResolvedValue({ shopName: "test" });
      const req = mockReq();
      const res = mockRes();
      await getShopConfig(req as any, res as any);
      expect(instantRetailService.getShopConfig).toHaveBeenCalledWith("t1");
      expect(ok).toHaveBeenCalled();
    });

    it("saveShopConfig - 应保存店铺配置", async () => {
      (instantRetailService.saveShopConfig as any).mockResolvedValue({ success: true });
      const req = mockReq({ body: { shopName: "test", status: "OPEN" } });
      const res = mockRes();
      await saveShopConfig(req as any, res as any);
      expect(instantRetailService.saveShopConfig).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("saveShopConfig - zod验证失败", async () => {
      const req = mockReq({ body: { shopName: "" } });
      const res = mockRes();
      await expect(saveShopConfig(req as any, res as any)).rejects.toThrow();
    });
  });

  describe("categories", () => {
    it("listCategories - 应获取分类列表", async () => {
      (instantRetailService.listCategories as any).mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await listCategories(req as any, res as any);
      expect(instantRetailService.listCategories).toHaveBeenCalledWith("t1");
      expect(ok).toHaveBeenCalled();
    });

    it("createCategory - 应创建分类", async () => {
      (instantRetailService.createCategory as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { name: "分类1" } });
      const res = mockRes();
      await createCategory(req as any, res as any);
      expect(instantRetailService.createCategory).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("products", () => {
    it("listProducts - 应获取商品列表", async () => {
      (instantRetailService.listRetailProducts as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await listProducts(req as any, res as any);
      expect(instantRetailService.listRetailProducts).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("addProduct - 应添加商品", async () => {
      (instantRetailService.addRetailProduct as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { skuId: 1, retailPrice: 100, stock: 10 } });
      const res = mockRes();
      await addProduct(req as any, res as any);
      expect(instantRetailService.addRetailProduct).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("orders", () => {
    it("listOrders - 应获取订单列表", async () => {
      (instantRetailService.listRetailOrders as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await listOrders(req as any, res as any);
      expect(instantRetailService.listRetailOrders).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getOrderDetail - 应获取订单详情", async () => {
      (instantRetailService.getRetailOrderDetail as any).mockResolvedValue({ orderNo: "ORD001" });
      const req = mockReq({ params: { orderNo: "ORD001" } });
      const res = mockRes();
      await getOrderDetail(req as any, res as any);
      expect(instantRetailService.getRetailOrderDetail).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("updateOrderStatus - 应更新订单状态", async () => {
      (instantRetailService.updateRetailOrderStatus as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { orderNo: "ORD001" }, body: { status: "CONFIRMED" } });
      const res = mockRes();
      await updateOrderStatus(req as any, res as any);
      expect(instantRetailService.updateRetailOrderStatus).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("banners", () => {
    it("listBanners - 应获取轮播图列表", async () => {
      (instantRetailService.listBanners as any).mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await listBanners(req as any, res as any);
      expect(instantRetailService.listBanners).toHaveBeenCalledWith("t1");
      expect(ok).toHaveBeenCalled();
    });

    it("createBanner - 应创建轮播图", async () => {
      (instantRetailService.createBanner as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { title: "banner1", imageUrl: "http://example.com/img.jpg" } });
      const res = mockRes();
      await createBanner(req as any, res as any);
      expect(instantRetailService.createBanner).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });
});