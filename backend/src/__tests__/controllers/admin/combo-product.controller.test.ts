/**
 * 管理端组合品 controller 单元测试
 * 被测文件：src/controllers/admin/combo-product.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listComboProducts: vi.fn(),
  getComboProductDetail: vi.fn(),
  createComboProduct: vi.fn(),
  updateComboProduct: vi.fn(),
  deleteComboProduct: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/combo-product.service", () => ({
  listComboProducts: mocks.listComboProducts,
  getComboProductDetail: mocks.getComboProductDetail,
  createComboProduct: mocks.createComboProduct,
  updateComboProduct: mocks.updateComboProduct,
  deleteComboProduct: mocks.deleteComboProduct,
}));

import {
  listComboProducts,
  getComboProductDetail,
  createComboProduct,
  updateComboProduct,
  deleteComboProduct,
} from "../../../controllers/admin/combo-product.controller";

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

describe("admin combo-product.controller", () => {
  describe("listComboProducts", () => {
    it("默认分页参数", async () => {
      mocks.listComboProducts.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listComboProducts(req, res, vi.fn());
      expect(mocks.listComboProducts).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        keyword: undefined,
        status: undefined,
        comboType: undefined,
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ list: [], total: 0 });
    });

    it("自定义分页参数", async () => {
      mocks.listComboProducts.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { page: "3", pageSize: "30" } });
      const res = mockRes();
      await listComboProducts(req, res, vi.fn());
      expect(mocks.listComboProducts).toHaveBeenCalledWith(expect.objectContaining({
        page: 3,
        pageSize: 30,
      }));
    });

    it("传入 keyword", async () => {
      mocks.listComboProducts.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { keyword: "套餐" } });
      const res = mockRes();
      await listComboProducts(req, res, vi.fn());
      expect(mocks.listComboProducts).toHaveBeenCalledWith(expect.objectContaining({
        keyword: "套餐",
      }));
    });

    it("传入 status 时转换为数字", async () => {
      mocks.listComboProducts.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { status: "1" } });
      const res = mockRes();
      await listComboProducts(req, res, vi.fn());
      expect(mocks.listComboProducts).toHaveBeenCalledWith(expect.objectContaining({
        status: 1,
      }));
    });

    it("不传 status 时为 undefined", async () => {
      mocks.listComboProducts.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listComboProducts(req, res, vi.fn());
      expect(mocks.listComboProducts).toHaveBeenCalledWith(expect.objectContaining({
        status: undefined,
      }));
    });

    it("传入 comboType", async () => {
      mocks.listComboProducts.mockResolvedValue({ list: [], total: 0 });
      const req = mockReq({ query: { comboType: "OPTIONAL" } });
      const res = mockRes();
      await listComboProducts(req, res, vi.fn());
      expect(mocks.listComboProducts).toHaveBeenCalledWith(expect.objectContaining({
        comboType: "OPTIONAL",
      }));
    });
  });

  describe("getComboProductDetail", () => {
    it("获取组合品详情", async () => {
      mocks.getComboProductDetail.mockResolvedValue({ id: 1, comboName: "双人套餐" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getComboProductDetail(req, res, vi.fn());
      expect(mocks.getComboProductDetail).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1, comboName: "双人套餐" });
    });
  });

  describe("createComboProduct", () => {
    it("创建组合品成功", async () => {
      mocks.createComboProduct.mockResolvedValue({ id: 1 });
      const req = mockReq({
        body: {
          comboName: "双人套餐",
          comboType: "FIXED",
          categoryId: 3,
          coverImage: "img.jpg",
          description: "精选组合",
          basePrice: "199",
          status: 1,
          sortOrder: 5,
          options: [{ productId: 1, quantity: 1 }],
        },
      });
      const res = mockRes();
      await createComboProduct(req, res, vi.fn());
      expect(mocks.createComboProduct).toHaveBeenCalledWith({
        comboName: "双人套餐",
        comboType: "FIXED",
        categoryId: 3,
        coverImage: "img.jpg",
        description: "精选组合",
        basePrice: 199,
        status: 1,
        sortOrder: 5,
        options: [{ productId: 1, quantity: 1 }],
        tenantId: "t1",
      });
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1 });
    });

    it("不传 comboType 时默认为 FIXED", async () => {
      mocks.createComboProduct.mockResolvedValue({ id: 2 });
      const req = mockReq({
        body: { comboName: "测试套餐", basePrice: "100" },
      });
      const res = mockRes();
      await createComboProduct(req, res, vi.fn());
      expect(mocks.createComboProduct).toHaveBeenCalledWith(expect.objectContaining({
        comboType: "FIXED",
      }));
    });

    it("不传 options 时默认为空数组", async () => {
      mocks.createComboProduct.mockResolvedValue({ id: 3 });
      const req = mockReq({
        body: { comboName: "测试套餐", basePrice: "100" },
      });
      const res = mockRes();
      await createComboProduct(req, res, vi.fn());
      expect(mocks.createComboProduct).toHaveBeenCalledWith(expect.objectContaining({
        options: [],
      }));
    });

    it("不传 basePrice 时默认为 0", async () => {
      mocks.createComboProduct.mockResolvedValue({ id: 4 });
      const req = mockReq({
        body: { comboName: "测试套餐" },
      });
      const res = mockRes();
      await createComboProduct(req, res, vi.fn());
      expect(mocks.createComboProduct).toHaveBeenCalledWith(expect.objectContaining({
        basePrice: 0,
      }));
    });
  });

  describe("updateComboProduct", () => {
    it("更新组合品成功", async () => {
      mocks.updateComboProduct.mockResolvedValue({ id: 1, comboName: "新名称" });
      const req = mockReq({
        params: { id: "1" },
        body: {
          comboName: "新名称",
          comboType: "OPTIONAL",
          categoryId: 4,
          basePrice: "299",
          status: 0,
          options: [{ productId: 2, quantity: 2 }],
        },
      });
      const res = mockRes();
      await updateComboProduct(req, res, vi.fn());
      expect(mocks.updateComboProduct).toHaveBeenCalledWith(1, expect.objectContaining({
        comboName: "新名称",
        basePrice: 299,
        tenantId: "t1",
      }));
    });

    it("不传 basePrice 时为 undefined", async () => {
      mocks.updateComboProduct.mockResolvedValue({ id: 1 });
      const req = mockReq({
        params: { id: "1" },
        body: { comboName: "测试" },
      });
      const res = mockRes();
      await updateComboProduct(req, res, vi.fn());
      expect(mocks.updateComboProduct).toHaveBeenCalledWith(1, expect.objectContaining({
        basePrice: undefined,
      }));
    });
  });

  describe("deleteComboProduct", () => {
    it("删除组合品成功", async () => {
      mocks.deleteComboProduct.mockResolvedValue({ success: true });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteComboProduct(req, res, vi.fn());
      expect(mocks.deleteComboProduct).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ success: true });
    });
  });
});
