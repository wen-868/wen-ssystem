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

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
}));

vi.mock("../../../services/admin/price-management.service.js", () => ({
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
  approveCustomerBinding,
  listChangeLogs,
} from "../../../controllers/admin/price-management.controller.js";

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
});

describe("admin price-management.controller", () => {
  it("listSkuPrices 传递 skuId 和 tenantId", async () => {
    mocks.listSkuPrices.mockResolvedValue([{ priceId: 1, price: 10 }]);
    const req = mockReq({ params: { skuId: "10" } });
    const res = mockRes();
    await listSkuPrices(req, res);
    expect(mocks.listSkuPrices).toHaveBeenCalledWith(10, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("setSkuPrices 成功时返回 ok(data)", async () => {
    mocks.setSkuPrices.mockResolvedValue({ data: { updated: 2 }, error: undefined });
    const req = mockReq({
      params: { skuId: "10" },
      body: { prices: [{ priceLevelId: 1, price: 9.9 }] },
    });
    const res = mockRes();
    await setSkuPrices(req, res);
    expect(mocks.setSkuPrices).toHaveBeenCalledWith(10, expect.any(Array), 1, "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ updated: 2 });
  });

  it("setSkuPrices service 返回 error 时回对应状态码", async () => {
    mocks.setSkuPrices.mockResolvedValue({ data: null, error: { code: 400, message: "价格级别不存在" } });
    const req = mockReq({
      params: { skuId: "10" },
      body: { prices: [{ priceLevelId: 999, price: 1 }] },
    });
    const res = mockRes();
    await setSkuPrices(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ code: 400, message: "价格级别不存在" });
  });

  it("updateSkuPrice 成功时返回 ok(data)", async () => {
    mocks.updateSkuPrice.mockResolvedValue({ data: { id: 5 }, error: undefined });
    const req = mockReq({ params: { id: "5" }, body: { price: 19.9 } });
    const res = mockRes();
    await updateSkuPrice(req, res);
    expect(mocks.updateSkuPrice).toHaveBeenCalledWith(5, expect.objectContaining({ price: 19.9 }), 1, "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ id: 5 });
  });

  it("updateSkuPrice service 返回 error 时回状态码", async () => {
    mocks.updateSkuPrice.mockResolvedValue({ data: null, error: { code: 404, message: "价格不存在" } });
    const req = mockReq({ params: { id: "5" }, body: { price: 19.9 } });
    const res = mockRes();
    await updateSkuPrice(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ code: 404, message: "价格不存在" });
  });

  it("deleteSkuPrice 成功时返回 ok(data)", async () => {
    mocks.deleteSkuPrice.mockResolvedValue({ data: { id: 3 }, error: undefined });
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();
    await deleteSkuPrice(req, res);
    expect(mocks.deleteSkuPrice).toHaveBeenCalledWith(3, "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ id: 3 });
  });

  it("getBestPrice 管理员角色时 isAdmin 为 true", async () => {
    mocks.getBestPrice.mockResolvedValue({ data: { price: 8.8 }, error: undefined });
    const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 5 } });
    const res = mockRes();
    await getBestPrice(req, res);
    expect(mocks.getBestPrice).toHaveBeenCalledWith(1, 10, 5, true, "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ price: 8.8 });
  });

  it("getBestPrice 非管理员角色时 isAdmin 为 false", async () => {
    mocks.getBestPrice.mockResolvedValue({ data: { price: 9.9 }, error: undefined });
    const req = mockReq({ body: { customerId: 1, skuId: 10, quantity: 5 }, user: { id: 2, roles: [] } });
    const res = mockRes();
    await getBestPrice(req, res);
    expect(mocks.getBestPrice).toHaveBeenCalledWith(1, 10, 5, false, "t1");
  });

  it("approveCustomerBinding service 返回 error 时回状态码", async () => {
    mocks.approveCustomerBinding.mockResolvedValue({ data: null, error: { code: 400, message: "绑定不存在" } });
    const req = mockReq({ params: { id: "7" } });
    const res = mockRes();
    await approveCustomerBinding(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ code: 400, message: "绑定不存在" });
  });

  it("listChangeLogs 传递分页与过滤参数", async () => {
    mocks.listChangeLogs.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { page: "2", pageSize: "15", skuId: "10", priceLevelId: "3" } });
    const res = mockRes();
    await listChangeLogs(req, res);
    expect(mocks.listChangeLogs).toHaveBeenCalledWith(2, 15, 10, 3, "t1");
  });
});
