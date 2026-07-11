import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  createPointsProduct: vi.fn(),
  listPointsProducts: vi.fn(),
  getPointsProductDetail: vi.fn(),
  updatePointsProduct: vi.fn(),
  deletePointsProduct: vi.fn(),
  togglePointsProduct: vi.fn(),
  listExchangeRecords: vi.fn(),
  getExchangeRecordDetail: vi.fn(),
  exchangeProduct: vi.fn(),
  cancelExchange: vi.fn(),
  confirmExchange: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-points-mall.service.js", () => ({
  createPointsProduct: mocks.createPointsProduct,
  listPointsProducts: mocks.listPointsProducts,
  getPointsProductDetail: mocks.getPointsProductDetail,
  updatePointsProduct: mocks.updatePointsProduct,
  deletePointsProduct: mocks.deletePointsProduct,
  togglePointsProduct: mocks.togglePointsProduct,
  listExchangeRecords: mocks.listExchangeRecords,
  getExchangeRecordDetail: mocks.getExchangeRecordDetail,
  exchangeProduct: mocks.exchangeProduct,
  cancelExchange: mocks.cancelExchange,
  confirmExchange: mocks.confirmExchange,
}));

import {
  createPointsProduct,
  listPointsProducts,
  getPointsProductDetail,
  updatePointsProduct,
  deletePointsProduct,
  togglePointsProduct,
  listExchangeRecords,
  getExchangeRecordDetail,
  exchangeProduct,
  cancelExchange,
  confirmExchange,
} from "../../../controllers/admin/marketing-points-mall.controller.js";

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

describe("admin marketing-points-mall.controller", () => {
  describe("积分商品", () => {
    it("createPointsProduct - 应创建积分商品", async () => {
      const body = { name: "精美礼品", pointsRequired: 1000, stock: 100 };
      mocks.createPointsProduct.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createPointsProduct(req, res);
      expect(mocks.createPointsProduct).toHaveBeenCalledWith(
        expect.objectContaining({ name: "精美礼品", pointsRequired: 1000 }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createPointsProduct - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: { name: "测试" } });
      const res = mockRes();
      await expect(createPointsProduct(req, res)).rejects.toThrow();
      expect(mocks.createPointsProduct).not.toHaveBeenCalled();
    });

    it("listPointsProducts - 应返回积分商品列表", async () => {
      mocks.listPointsProducts.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { status: "ON", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listPointsProducts(req, res);
      expect(mocks.listPointsProducts).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "t1", status: "ON", page: 1, pageSize: 10 })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("listPointsProducts - 使用默认分页参数", async () => {
      mocks.listPointsProducts.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listPointsProducts(req, res);
      expect(mocks.listPointsProducts).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });

    it("getPointsProductDetail - 应返回积分商品详情", async () => {
      mocks.getPointsProductDetail.mockResolvedValue({ id: 1, name: "礼品1" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getPointsProductDetail(req, res);
      expect(mocks.getPointsProductDetail).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("updatePointsProduct - 应更新积分商品", async () => {
      const body = { name: "新名称", stock: 200 };
      mocks.updatePointsProduct.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await updatePointsProduct(req, res);
      expect(mocks.updatePointsProduct).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "新名称", stock: 200 }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("deletePointsProduct - 应删除积分商品", async () => {
      mocks.deletePointsProduct.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deletePointsProduct(req, res);
      expect(mocks.deletePointsProduct).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("togglePointsProduct - 应切换积分商品状态", async () => {
      mocks.togglePointsProduct.mockResolvedValue({ id: 1, status: "OFF" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await togglePointsProduct(req, res);
      expect(mocks.togglePointsProduct).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("兑换记录", () => {
    it("listExchangeRecords - 应返回兑换记录列表", async () => {
      mocks.listExchangeRecords.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { userId: "1", status: "PENDING", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listExchangeRecords(req, res);
      expect(mocks.listExchangeRecords).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "t1", userId: 1, status: "PENDING", page: 1, pageSize: 10 })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("getExchangeRecordDetail - 应返回兑换记录详情", async () => {
      mocks.getExchangeRecordDetail.mockResolvedValue({ id: 1, status: "PENDING" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await getExchangeRecordDetail(req, res);
      expect(mocks.getExchangeRecordDetail).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("exchangeProduct - 应兑换商品", async () => {
      const body = { pointsProductId: 1, quantity: 2 };
      mocks.exchangeProduct.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await exchangeProduct(req, res);
      expect(mocks.exchangeProduct).toHaveBeenCalledWith(
        expect.objectContaining({ pointsProductId: 1, quantity: 2 }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("exchangeProduct - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await expect(exchangeProduct(req, res)).rejects.toThrow();
      expect(mocks.exchangeProduct).not.toHaveBeenCalled();
    });

    it("cancelExchange - 应取消兑换", async () => {
      mocks.cancelExchange.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cancelExchange(req, res);
      expect(mocks.cancelExchange).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });

    it("confirmExchange - 应确认兑换", async () => {
      mocks.confirmExchange.mockResolvedValue(undefined);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await confirmExchange(req, res);
      expect(mocks.confirmExchange).toHaveBeenCalledWith(1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith(null);
    });
  });
});
