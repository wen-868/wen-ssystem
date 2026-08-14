/**
 * 管理端价格管理 controller 单元测试
 * 被测文件：src/controllers/admin/price-management.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  listSkuPrices: vi.fn(),
  setSkuPrices: vi.fn(),
  updateSkuPrice: vi.fn(),
  deleteSkuPrice: vi.fn(),
  getBestPrice: vi.fn(),
  listCustomerBindings: vi.fn(),
  createCustomerBinding: vi.fn(),
  approveCustomerBinding: vi.fn(),
  rejectCustomerBinding: vi.fn(),
  cancelCustomerBinding: vi.fn(),
  listChangeLogs: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/price-management.service", () => ({
  listSkuPrices: mocks.listSkuPrices,
  setSkuPrices: mocks.setSkuPrices,
  updateSkuPrice: mocks.updateSkuPrice,
  deleteSkuPrice: mocks.deleteSkuPrice,
  getBestPrice: mocks.getBestPrice,
  listCustomerBindings: mocks.listCustomerBindings,
  createCustomerBinding: mocks.createCustomerBinding,
  approveCustomerBinding: mocks.approveCustomerBinding,
  rejectCustomerBinding: mocks.rejectCustomerBinding,
  cancelCustomerBinding: mocks.cancelCustomerBinding,
  listChangeLogs: mocks.listChangeLogs,
}));

import {
  listSkuPrices,
  setSkuPrices,
  updateSkuPrice,
  deleteSkuPrice,
  getBestPrice,
  listCustomerBindings,
  createCustomerBinding,
  approveCustomerBinding,
  rejectCustomerBinding,
  cancelCustomerBinding,
  listChangeLogs,
} from "../../../controllers/admin/price-management.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", roles: ["OPERATION_ADMIN"] },
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
  mocks.ok.mockImplementation((data?: any) => ({ code: "0", data }));
});

describe("admin price-management.controller", () => {
  describe("listSkuPrices", () => {
    it("应传递 skuId 和 tenantId", async () => {
      mocks.listSkuPrices.mockResolvedValue([{ priceId: 1, price: 10 }]);
      const req = mockReq({ params: { skuId: "10" } });
      const res = mockRes();
      await listSkuPrices(req as any, res as any, vi.fn());
      expect(mocks.listSkuPrices).toHaveBeenCalledWith(10, "t1");
      expect(mocks.ok).toHaveBeenCalledWith([{ priceId: 1, price: 10 }]);
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.listSkuPrices.mockRejectedValue(new Error("db error"));
      const req = mockReq({ params: { skuId: "10" } });
      const res = mockRes();
      await expect(listSkuPrices(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("setSkuPrices", () => {
    it("成功时返回 ok(data)", async () => {
      mocks.setSkuPrices.mockResolvedValue({ data: { updated: 2 }, error: undefined });
      const req = mockReq({
        params: { skuId: "10" },
        body: { prices: [{ priceLevelId: 1, price: 9.9 }] },
      });
      const res = mockRes();
      await setSkuPrices(req as any, res as any, vi.fn());
      expect(mocks.setSkuPrices).toHaveBeenCalledWith(10, expect.any(Array), 1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ updated: 2 });
    });

    it("service 返回 error 时回对应状态码", async () => {
      mocks.setSkuPrices.mockResolvedValue({ data: null, error: { code: 400, message: "价格级别不存在" } });
      const req = mockReq({
        params: { skuId: "10" },
        body: { prices: [{ priceLevelId: 999, price: 1 }] },
      });
      const res = mockRes();
      await setSkuPrices(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ code: 400, message: "价格级别不存在" });
    });

    it("zod 校验失败时抛出异常", async () => {
      const req = mockReq({
        params: { skuId: "10" },
        body: { prices: [] },
      });
      const res = mockRes();
      await expect(setSkuPrices(req as any, res as any, vi.fn())).rejects.toThrow();
      expect(mocks.setSkuPrices).not.toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.setSkuPrices.mockRejectedValue(new Error("db error"));
      const req = mockReq({
        params: { skuId: "10" },
        body: { prices: [{ priceLevelId: 1, price: 9.9 }] },
      });
      const res = mockRes();
      await expect(setSkuPrices(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("updateSkuPrice", () => {
    it("成功时返回 ok(data)", async () => {
      mocks.updateSkuPrice.mockResolvedValue({ data: { id: 5 }, error: undefined });
      const req = mockReq({ params: { id: "5" }, body: { price: 19.9 } });
      const res = mockRes();
      await updateSkuPrice(req as any, res as any, vi.fn());
      expect(mocks.updateSkuPrice).toHaveBeenCalledWith(5, expect.objectContaining({ price: 19.9 }), 1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 5 });
    });

    it("service 返回 error 时回状态码", async () => {
      mocks.updateSkuPrice.mockResolvedValue({ data: null, error: { code: 404, message: "价格不存在" } });
      const req = mockReq({ params: { id: "5" }, body: { price: 19.9 } });
      const res = mockRes();
      await updateSkuPrice(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ code: 404, message: "价格不存在" });
    });

    it("zod 校验失败时抛出异常", async () => {
      const req = mockReq({
        params: { id: "5" },
        body: { price: -1 },
      });
      const res = mockRes();
      await expect(updateSkuPrice(req as any, res as any, vi.fn())).rejects.toThrow();
      expect(mocks.updateSkuPrice).not.toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.updateSkuPrice.mockRejectedValue(new Error("db error"));
      const req = mockReq({ params: { id: "5" }, body: { price: 19.9 } });
      const res = mockRes();
      await expect(updateSkuPrice(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("deleteSkuPrice", () => {
    it("成功时返回 ok(data)", async () => {
      mocks.deleteSkuPrice.mockResolvedValue({ data: { id: 3 }, error: undefined });
      const req = mockReq({ params: { id: "3" } });
      const res = mockRes();
      await deleteSkuPrice(req as any, res as any, vi.fn());
      expect(mocks.deleteSkuPrice).toHaveBeenCalledWith(3, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 3 });
    });

    it("service 返回 error 时回状态码", async () => {
      mocks.deleteSkuPrice.mockResolvedValue({ data: null, error: { code: 404, message: "价格不存在" } });
      const req = mockReq({ params: { id: "999" } });
      const res = mockRes();
      await deleteSkuPrice(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ code: 404, message: "价格不存在" });
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.deleteSkuPrice.mockRejectedValue(new Error("db error"));
      const req = mockReq({ params: { id: "3" } });
      const res = mockRes();
      await expect(deleteSkuPrice(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("getBestPrice", () => {
    it("OPERATION_ADMIN 角色时 isAdmin 为 true", async () => {
      mocks.getBestPrice.mockResolvedValue({ data: { price: 8.8 }, error: undefined });
      const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 5 } });
      const res = mockRes();
      await getBestPrice(req as any, res as any, vi.fn());
      expect(mocks.getBestPrice).toHaveBeenCalledWith(1, 10, 5, true, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ price: 8.8 });
    });

    it("SUPER_ADMIN 角色时 isAdmin 为 true", async () => {
      mocks.getBestPrice.mockResolvedValue({ data: { price: 8.8 }, error: undefined });
      const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 5 }, user: { id: 1, roles: ["SUPER_ADMIN"] } });
      const res = mockRes();
      await getBestPrice(req as any, res as any, vi.fn());
      expect(mocks.getBestPrice).toHaveBeenCalledWith(1, 10, 5, true, "t1");
    });

    it("非管理员角色时 isAdmin 为 false", async () => {
      mocks.getBestPrice.mockResolvedValue({ data: { price: 9.9 }, error: undefined });
      const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 5 }, user: { id: 2, roles: [] } });
      const res = mockRes();
      await getBestPrice(req as any, res as any, vi.fn());
      expect(mocks.getBestPrice).toHaveBeenCalledWith(1, 10, 5, false, "t1");
    });

    it("user 为 undefined 时 isAdmin 为 false", async () => {
      mocks.getBestPrice.mockResolvedValue({ data: { price: 9.9 }, error: undefined });
      const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 5 }, user: undefined });
      const res = mockRes();
      await getBestPrice(req as any, res as any, vi.fn());
      expect(mocks.getBestPrice).toHaveBeenCalledWith(1, 10, 5, false, "t1");
    });

    it("service 返回 error 时回状态码", async () => {
      mocks.getBestPrice.mockResolvedValue({ data: null, error: { code: 400, message: "客户不存在" } });
      const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 5 } });
      const res = mockRes();
      await getBestPrice(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ code: 400, message: "客户不存在" });
    });

    it("zod 校验失败时抛出异常", async () => {
      const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 0 } });
      const res = mockRes();
      await expect(getBestPrice(req as any, res as any, vi.fn())).rejects.toThrow();
      expect(mocks.getBestPrice).not.toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.getBestPrice.mockRejectedValue(new Error("db error"));
      const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 5 } });
      const res = mockRes();
      await expect(getBestPrice(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("listCustomerBindings", () => {
    it("应传递分页与过滤参数", async () => {
      mocks.listCustomerBindings.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { page: "2", pageSize: "15", status: "APPROVED", customerId: "3" } });
      const res = mockRes();
      await listCustomerBindings(req as any, res as any, vi.fn());
      expect(mocks.listCustomerBindings).toHaveBeenCalledWith(2, 15, "APPROVED", 3, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ records: [], total: 0 });
    });

    it("默认分页参数", async () => {
      mocks.listCustomerBindings.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listCustomerBindings(req as any, res as any, vi.fn());
      expect(mocks.listCustomerBindings).toHaveBeenCalledWith(1, 20, undefined, undefined, "t1");
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.listCustomerBindings.mockRejectedValue(new Error("db error"));
      const req = mockReq({ query: {} });
      const res = mockRes();
      await expect(listCustomerBindings(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("createCustomerBinding", () => {
    it("成功时返回 ok(data)", async () => {
      mocks.createCustomerBinding.mockResolvedValue({ data: { id: 1 }, error: undefined });
      const req = mockReq({ body: { customerId: 1, priceLevelId: 2 } });
      const res = mockRes();
      await createCustomerBinding(req as any, res as any, vi.fn());
      expect(mocks.createCustomerBinding).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 1, priceLevelId: 2 }),
        "t1"
      );
      expect(mocks.ok).toHaveBeenCalledWith({ id: 1 });
    });

    it("service 返回 error 时回状态码", async () => {
      mocks.createCustomerBinding.mockResolvedValue({ data: null, error: { code: 400, message: "客户已绑定" } });
      const req = mockReq({ body: { customerId: 1, priceLevelId: 2 } });
      const res = mockRes();
      await createCustomerBinding(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ code: 400, message: "客户已绑定" });
    });

    it("zod 校验失败时抛出异常", async () => {
      const req = mockReq({ body: { customerId: 1 } });
      const res = mockRes();
      await expect(createCustomerBinding(req as any, res as any, vi.fn())).rejects.toThrow();
      expect(mocks.createCustomerBinding).not.toHaveBeenCalled();
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.createCustomerBinding.mockRejectedValue(new Error("db error"));
      const req = mockReq({ body: { customerId: 1, priceLevelId: 2 } });
      const res = mockRes();
      await expect(createCustomerBinding(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("approveCustomerBinding", () => {
    it("成功时返回 ok(data)", async () => {
      mocks.approveCustomerBinding.mockResolvedValue({ data: { id: 7 }, error: undefined });
      const req = mockReq({ params: { id: "7" } });
      const res = mockRes();
      await approveCustomerBinding(req as any, res as any, vi.fn());
      expect(mocks.approveCustomerBinding).toHaveBeenCalledWith(7, 1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 7 });
    });

    it("service 返回 error 时回状态码", async () => {
      mocks.approveCustomerBinding.mockResolvedValue({ data: null, error: { code: 400, message: "绑定不存在" } });
      const req = mockReq({ params: { id: "7" } });
      const res = mockRes();
      await approveCustomerBinding(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ code: 400, message: "绑定不存在" });
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.approveCustomerBinding.mockRejectedValue(new Error("db error"));
      const req = mockReq({ params: { id: "7" } });
      const res = mockRes();
      await expect(approveCustomerBinding(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("rejectCustomerBinding", () => {
    it("成功时返回 ok(data)", async () => {
      mocks.rejectCustomerBinding.mockResolvedValue({ data: { id: 8 }, error: undefined });
      const req = mockReq({ params: { id: "8" } });
      const res = mockRes();
      await rejectCustomerBinding(req as any, res as any, vi.fn());
      expect(mocks.rejectCustomerBinding).toHaveBeenCalledWith(8, 1, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 8 });
    });

    it("service 返回 error 时回状态码", async () => {
      mocks.rejectCustomerBinding.mockResolvedValue({ data: null, error: { code: 400, message: "绑定不存在" } });
      const req = mockReq({ params: { id: "8" } });
      const res = mockRes();
      await rejectCustomerBinding(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ code: 400, message: "绑定不存在" });
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.rejectCustomerBinding.mockRejectedValue(new Error("db error"));
      const req = mockReq({ params: { id: "8" } });
      const res = mockRes();
      await expect(rejectCustomerBinding(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("cancelCustomerBinding", () => {
    it("成功时返回 ok(data)", async () => {
      mocks.cancelCustomerBinding.mockResolvedValue({ data: { id: 9 }, error: undefined });
      const req = mockReq({ params: { id: "9" } });
      const res = mockRes();
      await cancelCustomerBinding(req as any, res as any, vi.fn());
      expect(mocks.cancelCustomerBinding).toHaveBeenCalledWith(9, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ id: 9 });
    });

    it("service 返回 error 时回状态码", async () => {
      mocks.cancelCustomerBinding.mockResolvedValue({ data: null, error: { code: 400, message: "绑定不存在" } });
      const req = mockReq({ params: { id: "9" } });
      const res = mockRes();
      await cancelCustomerBinding(req as any, res as any, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ code: 400, message: "绑定不存在" });
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.cancelCustomerBinding.mockRejectedValue(new Error("db error"));
      const req = mockReq({ params: { id: "9" } });
      const res = mockRes();
      await expect(cancelCustomerBinding(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });

  describe("listChangeLogs", () => {
    it("应传递分页与过滤参数", async () => {
      mocks.listChangeLogs.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { page: "2", pageSize: "15", skuId: "10", priceLevelId: "3" } });
      const res = mockRes();
      await listChangeLogs(req as any, res as any, vi.fn());
      expect(mocks.listChangeLogs).toHaveBeenCalledWith(2, 15, 10, 3, "t1");
    });

    it("默认分页参数", async () => {
      mocks.listChangeLogs.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listChangeLogs(req as any, res as any, vi.fn());
      expect(mocks.listChangeLogs).toHaveBeenCalledWith(1, 20, undefined, undefined, "t1");
      expect(mocks.ok).toHaveBeenCalledWith({ records: [], total: 0 });
    });

    it("service 抛错时应抛出异常", async () => {
      mocks.listChangeLogs.mockRejectedValue(new Error("db error"));
      const req = mockReq({ query: {} });
      const res = mockRes();
      await expect(listChangeLogs(req as any, res as any, vi.fn())).rejects.toThrow("db error");
    });
  });
});
