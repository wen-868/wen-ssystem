/**
 * 管理端库存共享 controller 单元测试
 * 被测文件：src/controllers/admin/inventory-share.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  getShareSetting: vi.fn(),
  updateShareSetting: vi.fn(),
  listShareProducts: vi.fn(),
  addShareProduct: vi.fn(),
  batchAddShareProducts: vi.fn(),
  updateShareProduct: vi.fn(),
  removeShareProduct: vi.fn(),
  batchRemoveShareProducts: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/inventory-share.service", () => ({
  getShareSetting: mocks.getShareSetting,
  updateShareSetting: mocks.updateShareSetting,
  listShareProducts: mocks.listShareProducts,
  addShareProduct: mocks.addShareProduct,
  batchAddShareProducts: mocks.batchAddShareProducts,
  updateShareProduct: mocks.updateShareProduct,
  removeShareProduct: mocks.removeShareProduct,
  batchRemoveShareProducts: mocks.batchRemoveShareProducts,
}));

import {
  getShareSetting,
  updateShareSetting,
  listShareProducts,
  addShareProduct,
  batchAddShareProducts,
  updateShareProduct,
  removeShareProduct,
  batchRemoveShareProducts,
} from "../../../controllers/admin/inventory-share.controller";

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
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getShareSetting.mockResolvedValue({ shareEnabled: false });
  mocks.updateShareSetting.mockResolvedValue({ id: 1 });
  mocks.listShareProducts.mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 20 });
  mocks.addShareProduct.mockResolvedValue({ id: 1 });
  mocks.batchAddShareProducts.mockResolvedValue({ addedCount: 1, totalCount: 2 });
  mocks.updateShareProduct.mockResolvedValue({ id: 1 });
  mocks.removeShareProduct.mockResolvedValue({ success: true });
  mocks.batchRemoveShareProducts.mockResolvedValue({ deletedCount: 3 });
});

describe("admin inventory-share.controller", () => {
  describe("getShareSetting", () => {
    it("正确调用 service", async () => {
      const req = mockReq();
      const res = mockRes();
      await getShareSetting(req, res, vi.fn());
      expect(mocks.getShareSetting).toHaveBeenCalledWith("t1");
      expect(mocks.ok).toHaveBeenCalled();
    });
  });

  describe("updateShareSetting", () => {
    it("正确调用 service（全字段）", async () => {
      const req = mockReq({
        body: {
          shareEnabled: true,
          autoTransfer: true,
          autoTransferThreshold: 10,
          shareScope: "ALL",
          specifiedStoreIds: [1, 2, 3],
        },
      });
      const res = mockRes();
      await updateShareSetting(req, res, vi.fn());
      expect(mocks.updateShareSetting).toHaveBeenCalledWith("t1", {
        shareEnabled: true,
        autoTransfer: true,
        autoTransferThreshold: 10,
        shareScope: "ALL",
        specifiedStoreIds: [1, 2, 3],
      });
    });

    it("不传字段时为 undefined", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await updateShareSetting(req, res, vi.fn());
      const arg = mocks.updateShareSetting.mock.calls[0][1];
      expect(arg.shareEnabled).toBeUndefined();
      expect(arg.autoTransfer).toBeUndefined();
    });
  });

  describe("listShareProducts", () => {
    it("默认分页参数", async () => {
      const req = mockReq();
      const res = mockRes();
      await listShareProducts(req, res, vi.fn());
      expect(mocks.listShareProducts).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        status: undefined,
        categoryId: undefined,
        keyword: undefined,
        tenantId: "t1",
      });
    });

    it("带查询参数", async () => {
      const req = mockReq({
        query: { page: "2", pageSize: "10", status: "1", categoryId: "5", keyword: "测试" },
      });
      const res = mockRes();
      await listShareProducts(req, res, vi.fn());
      const arg = mocks.listShareProducts.mock.calls[0][0];
      expect(arg.page).toBe(2);
      expect(arg.pageSize).toBe(10);
      expect(arg.status).toBe(1);
      expect(arg.categoryId).toBe(5);
      expect(arg.keyword).toBe("测试");
    });
  });

  describe("addShareProduct", () => {
    it("正确调用 service", async () => {
      const req = mockReq({
        body: {
          spuId: 1,
          spuName: "商品A",
          skuId: 2,
          skuName: "规格B",
          barcode: "B001",
          shareQty: 100,
          minKeepQty: 10,
        },
      });
      const res = mockRes();
      await addShareProduct(req, res, vi.fn());
      expect(mocks.addShareProduct).toHaveBeenCalledWith("t1", {
        spuId: 1,
        spuName: "商品A",
        skuId: 2,
        skuName: "规格B",
        barcode: "B001",
        shareQty: 100,
        minKeepQty: 10,
      });
    });
  });

  describe("batchAddShareProducts", () => {
    it("正确调用 service", async () => {
      const products = [{ spuId: 1, spuName: "商品A" }, { spuId: 2, spuName: "商品B" }];
      const req = mockReq({ body: { products } });
      const res = mockRes();
      await batchAddShareProducts(req, res, vi.fn());
      expect(mocks.batchAddShareProducts).toHaveBeenCalledWith("t1", products);
    });

    it("products 为 undefined 时传空数组", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await batchAddShareProducts(req, res, vi.fn());
      expect(mocks.batchAddShareProducts).toHaveBeenCalledWith("t1", []);
    });
  });

  describe("updateShareProduct", () => {
    it("正确调用 service", async () => {
      const req = mockReq({
        params: { id: "1" },
        body: { shareQty: 50, minKeepQty: 5, status: 0 },
      });
      const res = mockRes();
      await updateShareProduct(req, res, vi.fn());
      expect(mocks.updateShareProduct).toHaveBeenCalledWith(1, "t1", {
        shareQty: 50,
        minKeepQty: 5,
        status: 0,
      });
    });
  });

  describe("removeShareProduct", () => {
    it("正确调用 service", async () => {
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await removeShareProduct(req, res, vi.fn());
      expect(mocks.removeShareProduct).toHaveBeenCalledWith(1, "t1");
    });
  });

  describe("batchRemoveShareProducts", () => {
    it("正确调用 service", async () => {
      const ids = [1, 2, 3];
      const req = mockReq({ body: { ids } });
      const res = mockRes();
      await batchRemoveShareProducts(req, res, vi.fn());
      expect(mocks.batchRemoveShareProducts).toHaveBeenCalledWith(ids, "t1");
    });

    it("ids 为 undefined 时传空数组", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await batchRemoveShareProducts(req, res, vi.fn());
      expect(mocks.batchRemoveShareProducts).toHaveBeenCalledWith([], "t1");
    });
  });
});
