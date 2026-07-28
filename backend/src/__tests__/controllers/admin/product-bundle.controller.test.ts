/**
 * 管理端商品套装 controller 单元测试
 * 被测文件：src/controllers/admin/product-bundle.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listProductBundles: vi.fn(),
  getProductBundleDetail: vi.fn(),
  createProductBundle: vi.fn(),
  updateProductBundle: vi.fn(),
  deleteProductBundle: vi.fn(),
  publishProductBundle: vi.fn(),
  unpublishProductBundle: vi.fn(),
  getProductBundleStats: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/product-bundle.service", () => ({
  listProductBundles: mocks.listProductBundles,
  getProductBundleDetail: mocks.getProductBundleDetail,
  createProductBundle: mocks.createProductBundle,
  updateProductBundle: mocks.updateProductBundle,
  deleteProductBundle: mocks.deleteProductBundle,
  publishProductBundle: mocks.publishProductBundle,
  unpublishProductBundle: mocks.unpublishProductBundle,
  getProductBundleStats: mocks.getProductBundleStats,
}));

import {
  listProductBundles,
  getProductBundleDetail,
  createProductBundle,
  updateProductBundle,
  deleteProductBundle,
  publishProductBundle,
  unpublishProductBundle,
  getProductBundleStats,
} from "../../../controllers/admin/product-bundle.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin product-bundle.controller", () => {
  describe("listProductBundles", () => {
    it("默认分页参数", async () => {
      mocks.listProductBundles.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listProductBundles(req, res, vi.fn());
      expect(mocks.listProductBundles).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        keyword: undefined,
        status: undefined,
        categoryId: undefined,
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ list: [], total: 0 });
    });

    it("自定义分页参数", async () => {
      mocks.listProductBundles.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { page: "2", pageSize: "50" } });
      const res = mockRes();
      await listProductBundles(req, res, vi.fn());
      expect(mocks.listProductBundles).toHaveBeenCalledWith(expect.objectContaining({
        page: 2,
        pageSize: 50,
      }));
    });

    it("传入 keyword", async () => {
      mocks.listProductBundles.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { keyword: "礼盒" } });
      const res = mockRes();
      await listProductBundles(req, res, vi.fn());
      expect(mocks.listProductBundles).toHaveBeenCalledWith(expect.objectContaining({
        keyword: "礼盒",
      }));
    });

    it("传入 status 时转换为数字", async () => {
      mocks.listProductBundles.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { status: "1" } });
      const res = mockRes();
      await listProductBundles(req, res, vi.fn());
      expect(mocks.listProductBundles).toHaveBeenCalledWith(expect.objectContaining({
        status: 1,
      }));
    });

    it("不传 status 时为 undefined", async () => {
      mocks.listProductBundles.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listProductBundles(req, res, vi.fn());
      expect(mocks.listProductBundles).toHaveBeenCalledWith(expect.objectContaining({
        status: undefined,
      }));
    });

    it("传入 categoryId 时转换为数字", async () => {
      mocks.listProductBundles.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { categoryId: "10" } });
      const res = mockRes();
      await listProductBundles(req, res, vi.fn());
      expect(mocks.listProductBundles).toHaveBeenCalledWith(expect.objectContaining({
        categoryId: 10,
      }));
    });

    it("不传 categoryId 时为 undefined", async () => {
      mocks.listProductBundles.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listProductBundles(req, res, vi.fn());
      expect(mocks.listProductBundles).toHaveBeenCalledWith(expect.objectContaining({
        categoryId: undefined,
      }));
    });
  });

  describe("getProductBundleDetail", () => {
    it("获取套装详情", async () => {
      mocks.getProductBundleDetail.mockResolvedValue({ id: 1, bundleName: "中秋礼盒" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getProductBundleDetail(req, res, vi.fn());
      expect(mocks.getProductBundleDetail).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1, bundleName: "中秋礼盒" });
    });
  });

  describe("createProductBundle", () => {
    it("创建套装成功", async () => {
      mocks.createProductBundle.mockResolvedValue({ id: 1 });
      const req = mockReq({
        body: {
          bundleName: "中秋礼盒",
          categoryId: 5,
          coverImage: "img.jpg",
          description: "精选好酒",
          bundlePrice: "299",
          status: 1,
          sortOrder: 10,
          items: [{ productId: 1, quantity: 2 }],
        },
      });
      const res = mockRes();
      await createProductBundle(req, res, vi.fn());
      expect(mocks.createProductBundle).toHaveBeenCalledWith({
        bundleName: "中秋礼盒",
        categoryId: 5,
        coverImage: "img.jpg",
        description: "精选好酒",
        bundlePrice: 299,
        status: 1,
        sortOrder: 10,
        items: [{ productId: 1, quantity: 2 }],
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1 });
    });

    it("不传 items 时默认为空数组", async () => {
      mocks.createProductBundle.mockResolvedValue({ id: 2 });
      const req = mockReq({
        body: { bundleName: "测试套装", bundlePrice: "100" },
      });
      const res = mockRes();
      await createProductBundle(req, res, vi.fn());
      expect(mocks.createProductBundle).toHaveBeenCalledWith(expect.objectContaining({
        items: [],
      }));
    });
  });

  describe("updateProductBundle", () => {
    it("更新套装成功", async () => {
      mocks.updateProductBundle.mockResolvedValue({ id: 1, bundleName: "新名称" });
      const req = mockReq({
        params: { id: "1" },
        body: {
          bundleName: "新名称",
          categoryId: 6,
          bundlePrice: "399",
          status: 0,
          items: [{ productId: 2, quantity: 1 }],
        },
      });
      const res = mockRes();
      await updateProductBundle(req, res, vi.fn());
      expect(mocks.updateProductBundle).toHaveBeenCalledWith(1, expect.objectContaining({
        bundleName: "新名称",
        bundlePrice: 399,
        tenantId: "t1",
      }));
    });

    it("不传 bundlePrice 时为 undefined", async () => {
      mocks.updateProductBundle.mockResolvedValue({ id: 1 });
      const req = mockReq({
        params: { id: "1" },
        body: { bundleName: "测试" },
      });
      const res = mockRes();
      await updateProductBundle(req, res, vi.fn());
      expect(mocks.updateProductBundle).toHaveBeenCalledWith(1, expect.objectContaining({
        bundlePrice: undefined,
      }));
    });
  });

  describe("deleteProductBundle", () => {
    it("删除套装成功", async () => {
      mocks.deleteProductBundle.mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteProductBundle(req, res, vi.fn());
      expect(mocks.deleteProductBundle).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("publishProductBundle", () => {
    it("上架套装成功", async () => {
      mocks.publishProductBundle.mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await publishProductBundle(req, res, vi.fn());
      expect(mocks.publishProductBundle).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("unpublishProductBundle", () => {
    it("下架套装成功", async () => {
      mocks.unpublishProductBundle.mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await unpublishProductBundle(req, res, vi.fn());
      expect(mocks.unpublishProductBundle).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("getProductBundleStats", () => {
    it("获取套装销售统计（无日期范围）", async () => {
      mocks.getProductBundleStats.mockResolvedValue({ totalSales: 1000 });
      const req = mockReq();
      const res = mockRes();
      await getProductBundleStats(req, res, vi.fn());
      expect(mocks.getProductBundleStats).toHaveBeenCalledWith({
        tenantId: "t1",
        dateStart: undefined,
        dateEnd: undefined,
      });
      expect(mocks.ok).toHaveBeenCalledWith({ totalSales: 1000 });
    });

    it("获取套装销售统计（带日期范围）", async () => {
      mocks.getProductBundleStats.mockResolvedValue({ totalSales: 500 });
      const req = mockReq({ query: { dateStart: "2026-01-01", dateEnd: "2026-01-31" } });
      const res = mockRes();
      await getProductBundleStats(req, res, vi.fn());
      expect(mocks.getProductBundleStats).toHaveBeenCalledWith(expect.objectContaining({
        dateStart: "2026-01-01",
        dateEnd: "2026-01-31",
      }));
    });
  });
});
