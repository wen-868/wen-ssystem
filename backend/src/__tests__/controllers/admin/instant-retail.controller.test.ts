import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/instant-retail.service", () => ({
  handleWebhook: vi.fn(),
  getPlatforms: vi.fn(),
  getConfigs: vi.fn(),
  getConfigByPlatform: vi.fn(),
  upsertConfig: vi.fn(),
  testConnection: vi.fn(),
  syncOrders: vi.fn(),
  syncProducts: vi.fn(),
  deleteConfig: vi.fn(),
  listOrders: vi.fn(),
  getOrderDetail: vi.fn(),
  confirmOrder: vi.fn(),
  startDelivery: vi.fn(),
  completeDelivery: vi.fn(),
  cancelOrder: vi.fn(),
}));

vi.mock("../../../services/instant-retail/retail-shop.service", () => ({
  getShopConfig: vi.fn(),
  saveShopConfig: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listRetailProducts: vi.fn(),
  addRetailProduct: vi.fn(),
  updateRetailProduct: vi.fn(),
  deleteRetailProduct: vi.fn(),
  listRetailOrders: vi.fn(),
  getRetailOrderDetail: vi.fn(),
  updateRetailOrderStatus: vi.fn(),
  listBanners: vi.fn(),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as instantRetailService from "../../../services/admin/instant-retail.service";
import * as retailShopSvc from "../../../services/instant-retail/retail-shop.service";
import { ok } from "../../../shared/response";
import {
  handleJdWebhook,
  handleMeituanWebhook,
  handleElemeWebhook,
  getPlatforms,
  getConfigs,
  getConfigByPlatform,
  upsertConfig,
  testConnection,
  syncOrders,
  syncProducts,
  deleteConfig,
  listOrders,
  getOrderDetail,
  confirmOrder,
  startDelivery,
  completeDelivery,
  cancelOrder,
  getShopConfig,
  saveShopConfig,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listRetailProducts,
  addRetailProduct,
  updateRetailProduct,
  deleteRetailProduct,
  listRetailOrders,
  getRetailOrderDetail,
  updateRetailOrderStatus,
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from "../../../controllers/admin/instant-retail.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", storeId: 1 },
  query: {},
  params: {},
  body: {},
  headers: {},
  ip: "127.0.0.1",
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

  describe("Webhook 端点", () => {
    it("handleJdWebhook - 应处理京东webhook", async () => {
      (instantRetailService.handleWebhook as any).mockResolvedValue({ status: 200, response: { code: 0 } });
      const req = mockReq({ body: { test: true }, headers: { "x-signature": "sig", "x-timestamp": "123" } });
      const res = mockRes();
      await handleJdWebhook(req as any, res as any, vi.fn());
      expect(instantRetailService.handleWebhook).toHaveBeenCalledWith("JD", expect.any(Object), "sig", "123");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("handleMeituanWebhook - 应处理美团webhook", async () => {
      (instantRetailService.handleWebhook as any).mockResolvedValue({ status: 200, response: { code: 0 } });
      const req = mockReq({ body: { test: true }, headers: { "x-signature": "sig", "x-timestamp": "123" } });
      const res = mockRes();
      await handleMeituanWebhook(req as any, res as any, vi.fn());
      expect(instantRetailService.handleWebhook).toHaveBeenCalledWith("MEITUAN", expect.any(Object), "sig", "123");
    });

    it("handleElemeWebhook - 应处理饿了么webhook", async () => {
      (instantRetailService.handleWebhook as any).mockResolvedValue({ status: 200, response: { code: 0 } });
      const req = mockReq({ body: { test: true }, headers: { "x-signature": "sig", "x-timestamp": "123" } });
      const res = mockRes();
      await handleElemeWebhook(req as any, res as any, vi.fn());
      expect(instantRetailService.handleWebhook).toHaveBeenCalledWith("ELEME", expect.any(Object), "sig", "123");
    });
  });

  describe("管理后台端点", () => {
    it("getPlatforms - 应返回平台列表", async () => {
      (instantRetailService.getPlatforms as any).mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await getPlatforms(req as any, res as any, vi.fn());
      expect(instantRetailService.getPlatforms).toHaveBeenCalledWith("t1");
      expect(ok).toHaveBeenCalled();
    });

    it("getConfigs - 应返回配置列表", async () => {
      (instantRetailService.getConfigs as any).mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await getConfigs(req as any, res as any, vi.fn());
      expect(instantRetailService.getConfigs).toHaveBeenCalledWith("t1");
      expect(ok).toHaveBeenCalled();
    });

    it("getConfigByPlatform - 应返回指定平台配置", async () => {
      (instantRetailService.getConfigByPlatform as any).mockResolvedValue({ platform: "JD" });
      const req = mockReq({ params: { platform: "JD" } });
      const res = mockRes();
      await getConfigByPlatform(req as any, res as any, vi.fn());
      expect(instantRetailService.getConfigByPlatform).toHaveBeenCalledWith("JD", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("getConfigByPlatform - 配置不存在应返回404", async () => {
      (instantRetailService.getConfigByPlatform as any).mockResolvedValue(null);
      const req = mockReq({ params: { platform: "JD" } });
      const res = mockRes();
      await getConfigByPlatform(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("upsertConfig - 应创建/更新配置", async () => {
      (instantRetailService.upsertConfig as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ body: { platform: "JD", appKey: "key", appSecret: "secret" } });
      const res = mockRes();
      await upsertConfig(req as any, res as any, vi.fn());
      expect(instantRetailService.upsertConfig).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("testConnection - 连接成功应返回ok", async () => {
      (instantRetailService.testConnection as any).mockResolvedValue({ found: true, connected: true, platform: "JD", tokenUpdated: true });
      const req = mockReq({ params: { platform: "JD" } });
      const res = mockRes();
      await testConnection(req as any, res as any, vi.fn());
      expect(instantRetailService.testConnection).toHaveBeenCalledWith("JD", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("testConnection - 配置不存在应返回404", async () => {
      (instantRetailService.testConnection as any).mockResolvedValue({ found: false });
      const req = mockReq({ params: { platform: "JD" } });
      const res = mockRes();
      await testConnection(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("testConnection - 连接失败应返回502", async () => {
      (instantRetailService.testConnection as any).mockResolvedValue({ found: true, connected: false, error: "timeout" });
      const req = mockReq({ params: { platform: "JD" } });
      const res = mockRes();
      await testConnection(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(502);
    });

    it("syncOrders - 应同步订单", async () => {
      (instantRetailService.syncOrders as any).mockResolvedValue({ found: true, platform: "JD", synced: 10, hasMore: false });
      const req = mockReq({ params: { platform: "JD" }, body: {} });
      const res = mockRes();
      await syncOrders(req as any, res as any, vi.fn());
      expect(instantRetailService.syncOrders).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("syncOrders - 配置不存在应返回404", async () => {
      (instantRetailService.syncOrders as any).mockResolvedValue({ found: false });
      const req = mockReq({ params: { platform: "JD" }, body: {} });
      const res = mockRes();
      await syncOrders(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("syncProducts - 应同步商品", async () => {
      (instantRetailService.syncProducts as any).mockResolvedValue({ found: true, platform: "JD", synced: 10, hasMore: false });
      const req = mockReq({ params: { platform: "JD" }, body: {} });
      const res = mockRes();
      await syncProducts(req as any, res as any, vi.fn());
      expect(instantRetailService.syncProducts).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("syncProducts - 配置不存在应返回404", async () => {
      (instantRetailService.syncProducts as any).mockResolvedValue({ found: false });
      const req = mockReq({ params: { platform: "JD" }, body: {} });
      const res = mockRes();
      await syncProducts(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("deleteConfig - 应删除配置", async () => {
      (instantRetailService.deleteConfig as any).mockResolvedValue({ deleted: true });
      const req = mockReq({ params: { platform: "JD" } });
      const res = mockRes();
      await deleteConfig(req as any, res as any, vi.fn());
      expect(instantRetailService.deleteConfig).toHaveBeenCalledWith("JD", "t1");
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("门店端订单查询", () => {
    it("listOrders - 应返回订单列表", async () => {
      (instantRetailService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await listOrders(req as any, res as any, vi.fn());
      expect(instantRetailService.listOrders).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getOrderDetail - 应返回订单详情", async () => {
      (instantRetailService.getOrderDetail as any).mockResolvedValue({ platformOrderId: "123" });
      const req = mockReq({ params: { platformOrderId: "123" } });
      const res = mockRes();
      await getOrderDetail(req as any, res as any, vi.fn());
      expect(instantRetailService.getOrderDetail).toHaveBeenCalledWith("123", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("getOrderDetail - 订单不存在应返回404", async () => {
      (instantRetailService.getOrderDetail as any).mockResolvedValue(null);
      const req = mockReq({ params: { platformOrderId: "123" } });
      const res = mockRes();
      await getOrderDetail(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("门店端订单操作", () => {
    it("confirmOrder - 应确认订单", async () => {
      (instantRetailService.confirmOrder as any).mockResolvedValue({ found: true, configFound: true, platformOrderId: "123", success: true, status: "CONFIRMED" });
      const req = mockReq({ params: { platformOrderId: "123" } });
      const res = mockRes();
      await confirmOrder(req as any, res as any, vi.fn());
      expect(instantRetailService.confirmOrder).toHaveBeenCalledWith("123", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("confirmOrder - 订单不存在应返回404", async () => {
      (instantRetailService.confirmOrder as any).mockResolvedValue({ found: false });
      const req = mockReq({ params: { platformOrderId: "123" } });
      const res = mockRes();
      await confirmOrder(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("confirmOrder - 配置不存在应返回404", async () => {
      (instantRetailService.confirmOrder as any).mockResolvedValue({ found: true, configFound: false });
      const req = mockReq({ params: { platformOrderId: "123" } });
      const res = mockRes();
      await confirmOrder(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("startDelivery - 应开始配送", async () => {
      (instantRetailService.startDelivery as any).mockResolvedValue({ found: true, configFound: true, platformOrderId: "123", success: true, status: "DELIVERING" });
      const req = mockReq({ params: { platformOrderId: "123" }, body: {} });
      const res = mockRes();
      await startDelivery(req as any, res as any, vi.fn());
      expect(instantRetailService.startDelivery).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("startDelivery - 订单不存在应返回404", async () => {
      (instantRetailService.startDelivery as any).mockResolvedValue({ found: false });
      const req = mockReq({ params: { platformOrderId: "123" }, body: {} });
      const res = mockRes();
      await startDelivery(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("completeDelivery - 应完成配送", async () => {
      (instantRetailService.completeDelivery as any).mockResolvedValue({ found: true, configFound: true, platformOrderId: "123", success: true, status: "COMPLETED" });
      const req = mockReq({ params: { platformOrderId: "123" } });
      const res = mockRes();
      await completeDelivery(req as any, res as any, vi.fn());
      expect(instantRetailService.completeDelivery).toHaveBeenCalledWith("123", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("completeDelivery - 订单不存在应返回404", async () => {
      (instantRetailService.completeDelivery as any).mockResolvedValue({ found: false });
      const req = mockReq({ params: { platformOrderId: "123" } });
      const res = mockRes();
      await completeDelivery(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("cancelOrder - 应取消订单", async () => {
      (instantRetailService.cancelOrder as any).mockResolvedValue({ found: true, configFound: true, platformOrderId: "123", success: true, status: "CANCELLED" });
      const req = mockReq({ params: { platformOrderId: "123" }, body: { reason: "用户取消" } });
      const res = mockRes();
      await cancelOrder(req as any, res as any, vi.fn());
      expect(instantRetailService.cancelOrder).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("cancelOrder - 订单不存在应返回404", async () => {
      (instantRetailService.cancelOrder as any).mockResolvedValue({ found: false });
      const req = mockReq({ params: { platformOrderId: "123" }, body: { reason: "用户取消" } });
      const res = mockRes();
      await cancelOrder(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("零售门店管理端点", () => {
    it("getShopConfig - 应返回门店配置", async () => {
      (retailShopSvc.getShopConfig as any).mockResolvedValue({});
      const req = mockReq({ query: { storeId: "1" } });
      const res = mockRes();
      await getShopConfig(req as any, res as any, vi.fn());
      expect(retailShopSvc.getShopConfig).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("saveShopConfig - 应保存门店配置", async () => {
      (retailShopSvc.saveShopConfig as any).mockResolvedValue({});
      const req = mockReq({ query: { storeId: "1" }, body: { shopName: "测试店" } });
      const res = mockRes();
      await saveShopConfig(req as any, res as any, vi.fn());
      expect(retailShopSvc.saveShopConfig).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("listCategories - 应返回分类列表", async () => {
      (retailShopSvc.listCategories as any).mockResolvedValue([]);
      const req = mockReq({ query: { storeId: "1" } });
      const res = mockRes();
      await listCategories(req as any, res as any, vi.fn());
      expect(retailShopSvc.listCategories).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("createCategory - 应创建分类", async () => {
      (retailShopSvc.createCategory as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ query: { storeId: "1" }, body: { name: "分类1" } });
      const res = mockRes();
      await createCategory(req as any, res as any, vi.fn());
      expect(retailShopSvc.createCategory).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("updateCategory - 应更新分类", async () => {
      (retailShopSvc.updateCategory as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body: { name: "新名称" } });
      const res = mockRes();
      await updateCategory(req as any, res as any, vi.fn());
      expect(retailShopSvc.updateCategory).toHaveBeenCalledWith(1, expect.any(Object), "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("deleteCategory - 应删除分类", async () => {
      (retailShopSvc.deleteCategory as any).mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteCategory(req as any, res as any, vi.fn());
      expect(retailShopSvc.deleteCategory).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("listRetailProducts - 应返回零售商品列表", async () => {
      (retailShopSvc.listRetailProducts as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20, storeId: "1" } });
      const res = mockRes();
      await listRetailProducts(req as any, res as any, vi.fn());
      expect(retailShopSvc.listRetailProducts).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("addRetailProduct - 应添加零售商品", async () => {
      (retailShopSvc.addRetailProduct as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ query: { storeId: "1" }, body: { skuId: 1, retailPrice: 100, stock: 10 } });
      const res = mockRes();
      await addRetailProduct(req as any, res as any, vi.fn());
      expect(retailShopSvc.addRetailProduct).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("updateRetailProduct - 应更新零售商品", async () => {
      (retailShopSvc.updateRetailProduct as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body: { retailPrice: 200 } });
      const res = mockRes();
      await updateRetailProduct(req as any, res as any, vi.fn());
      expect(retailShopSvc.updateRetailProduct).toHaveBeenCalledWith(1, expect.any(Object), "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("deleteRetailProduct - 应删除零售商品", async () => {
      (retailShopSvc.deleteRetailProduct as any).mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteRetailProduct(req as any, res as any, vi.fn());
      expect(retailShopSvc.deleteRetailProduct).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("listRetailOrders - 应返回零售订单列表", async () => {
      (retailShopSvc.listRetailOrders as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20, storeId: "1" } });
      const res = mockRes();
      await listRetailOrders(req as any, res as any, vi.fn());
      expect(retailShopSvc.listRetailOrders).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getRetailOrderDetail - 应返回零售订单详情", async () => {
      (retailShopSvc.getRetailOrderDetail as any).mockResolvedValue({ orderNo: "123" });
      const req = mockReq({ params: { orderNo: "123" } });
      const res = mockRes();
      await getRetailOrderDetail(req as any, res as any, vi.fn());
      expect(retailShopSvc.getRetailOrderDetail).toHaveBeenCalledWith("123", "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("getRetailOrderDetail - 订单不存在应返回404", async () => {
      (retailShopSvc.getRetailOrderDetail as any).mockResolvedValue(null);
      const req = mockReq({ params: { orderNo: "123" } });
      const res = mockRes();
      await getRetailOrderDetail(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("updateRetailOrderStatus - 应更新零售订单状态", async () => {
      (retailShopSvc.updateRetailOrderStatus as any).mockResolvedValue({ orderNo: "123" });
      const req = mockReq({ params: { orderNo: "123" }, body: { status: "COMPLETED" } });
      const res = mockRes();
      await updateRetailOrderStatus(req as any, res as any, vi.fn());
      expect(retailShopSvc.updateRetailOrderStatus).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("listBanners - 应返回轮播图列表", async () => {
      (retailShopSvc.listBanners as any).mockResolvedValue([]);
      const req = mockReq({ query: { storeId: "1" } });
      const res = mockRes();
      await listBanners(req as any, res as any, vi.fn());
      expect(retailShopSvc.listBanners).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("createBanner - 应创建轮播图", async () => {
      (retailShopSvc.createBanner as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ query: { storeId: "1" }, body: { title: "banner1", imageUrl: "https://example.com/img.jpg" } });
      const res = mockRes();
      await createBanner(req as any, res as any, vi.fn());
      expect(retailShopSvc.createBanner).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("updateBanner - 应更新轮播图", async () => {
      (retailShopSvc.updateBanner as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body: { title: "新标题" } });
      const res = mockRes();
      await updateBanner(req as any, res as any, vi.fn());
      expect(retailShopSvc.updateBanner).toHaveBeenCalledWith(1, expect.any(Object), "t1");
      expect(ok).toHaveBeenCalled();
    });

    it("deleteBanner - 应删除轮播图", async () => {
      (retailShopSvc.deleteBanner as any).mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteBanner(req as any, res as any, vi.fn());
      expect(retailShopSvc.deleteBanner).toHaveBeenCalledWith(1, "t1");
      expect(ok).toHaveBeenCalled();
    });
  });

  // ==================== 分支覆盖率补充测试 ====================
  describe("分支覆盖率补充", () => {
    it("handleJdWebhook - 不传body时使用空对象, 使用signature header", async () => {
      (instantRetailService.handleWebhook as any).mockResolvedValue({ status: 200, response: {} });
      const req = mockReq({ headers: { "signature": "sig2" }, query: { timestamp: "999" } });
      delete (req as any).body;
      const res = mockRes();
      await handleJdWebhook(req as any, res as any, vi.fn());
      expect(instantRetailService.handleWebhook).toHaveBeenCalledWith("JD", {}, "sig2", "999");
    });

    it("handleMeituanWebhook - 使用query.sign和query.timestamp兜底", async () => {
      (instantRetailService.handleWebhook as any).mockResolvedValue({ status: 200, response: {} });
      const req = mockReq({ query: { sign: "qsign", timestamp: "111" } });
      const res = mockRes();
      await handleMeituanWebhook(req as any, res as any, vi.fn());
      expect(instantRetailService.handleWebhook).toHaveBeenCalledWith("MEITUAN", expect.any(Object), "qsign", "111");
    });

    it("handleElemeWebhook - 全不传签名和timestamp时使用空串", async () => {
      (instantRetailService.handleWebhook as any).mockResolvedValue({ status: 200, response: {} });
      const req = mockReq({});
      const res = mockRes();
      await handleElemeWebhook(req as any, res as any, vi.fn());
      expect(instantRetailService.handleWebhook).toHaveBeenCalledWith("ELEME", expect.any(Object), "", "");
    });

    it("listOrders - user无storeId且传platform时正确处理", async () => {
      (instantRetailService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ user: { id: 1, username: "admin" }, query: { platform: "MEITUAN" } });
      const res = mockRes();
      await listOrders(req as any, res as any, vi.fn());
      expect(instantRetailService.listOrders).toHaveBeenCalledWith(1, 20, null, "MEITUAN", "t1");
    });

    it("listOrders - 不传page/pageSize时使用默认值", async () => {
      (instantRetailService.listOrders as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listOrders(req as any, res as any, vi.fn());
      expect(instantRetailService.listOrders).toHaveBeenCalledWith(1, 20, "1", null, "t1");
    });

    it("startDelivery - 配置不存在应返回404", async () => {
      (instantRetailService.startDelivery as any).mockResolvedValue({ found: true, configFound: false });
      const req = mockReq({ params: { platformOrderId: "123" }, body: {} });
      const res = mockRes();
      await startDelivery(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("completeDelivery - 配置不存在应返回404", async () => {
      (instantRetailService.completeDelivery as any).mockResolvedValue({ found: true, configFound: false });
      const req = mockReq({ params: { platformOrderId: "123" } });
      const res = mockRes();
      await completeDelivery(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("cancelOrder - 配置不存在应返回404", async () => {
      (instantRetailService.cancelOrder as any).mockResolvedValue({ found: true, configFound: false });
      const req = mockReq({ params: { platformOrderId: "123" }, body: { reason: "用户取消" } });
      const res = mockRes();
      await cancelOrder(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("getShopConfig - 不传storeId时使用undefined", async () => {
      (retailShopSvc.getShopConfig as any).mockResolvedValue({});
      const req = mockReq({ query: {} });
      const res = mockRes();
      await getShopConfig(req as any, res as any, vi.fn());
      expect(retailShopSvc.getShopConfig).toHaveBeenCalledWith(undefined, "t1");
    });

    it("listCategories - 不传storeId时使用undefined", async () => {
      (retailShopSvc.listCategories as any).mockResolvedValue([]);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listCategories(req as any, res as any, vi.fn());
      expect(retailShopSvc.listCategories).toHaveBeenCalledWith(undefined, "t1");
    });

    it("listRetailProducts - 不传page/pageSize和storeId时使用默认值", async () => {
      (retailShopSvc.listRetailProducts as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listRetailProducts(req as any, res as any, vi.fn());
      expect(retailShopSvc.listRetailProducts).toHaveBeenCalledWith({ storeId: undefined, tenantId: "t1", page: 1, pageSize: 20 });
    });

    it("listRetailOrders - 不传page/pageSize和storeId时使用默认值", async () => {
      (retailShopSvc.listRetailOrders as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listRetailOrders(req as any, res as any, vi.fn());
      expect(retailShopSvc.listRetailOrders).toHaveBeenCalledWith({ storeId: undefined, tenantId: "t1", page: 1, pageSize: 20 });
    });

    it("addRetailProduct - 不传storeId时使用undefined", async () => {
      (retailShopSvc.addRetailProduct as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ query: {}, body: { skuId: 1, retailPrice: 100, stock: 10 } });
      const res = mockRes();
      await addRetailProduct(req as any, res as any, vi.fn());
      expect(retailShopSvc.addRetailProduct).toHaveBeenCalledWith(undefined, expect.any(Object), "t1");
    });

    it("createBanner - 不传storeId时使用undefined", async () => {
      (retailShopSvc.createBanner as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ query: {}, body: { title: "banner1", imageUrl: "https://example.com/img.jpg" } });
      const res = mockRes();
      await createBanner(req as any, res as any, vi.fn());
      expect(retailShopSvc.createBanner).toHaveBeenCalledWith(undefined, expect.any(Object), "t1");
    });

    it("listBanners - 不传storeId时使用undefined", async () => {
      (retailShopSvc.listBanners as any).mockResolvedValue([]);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listBanners(req as any, res as any, vi.fn());
      expect(retailShopSvc.listBanners).toHaveBeenCalledWith(undefined, "t1");
    });

    it("saveShopConfig - 不传storeId时使用undefined", async () => {
      (retailShopSvc.saveShopConfig as any).mockResolvedValue({});
      const req = mockReq({ query: {}, body: { shopName: "测试店" } });
      const res = mockRes();
      await saveShopConfig(req as any, res as any, vi.fn());
      expect(retailShopSvc.saveShopConfig).toHaveBeenCalledWith(undefined, expect.any(Object), "t1");
    });

    it("createCategory - 不传storeId时使用undefined", async () => {
      (retailShopSvc.createCategory as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ query: {}, body: { name: "分类1" } });
      const res = mockRes();
      await createCategory(req as any, res as any, vi.fn());
      expect(retailShopSvc.createCategory).toHaveBeenCalledWith(undefined, expect.any(Object), "t1");
    });
  });
});
