import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listCustomerPrices: vi.fn(),
  createCustomerPrice: vi.fn(),
  updateCustomerPrice: vi.fn(),
  deleteCustomerPrice: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/customer-price.service", () => ({
  listCustomerPrices: mocks.listCustomerPrices,
  createCustomerPrice: mocks.createCustomerPrice,
  updateCustomerPrice: mocks.updateCustomerPrice,
  deleteCustomerPrice: mocks.deleteCustomerPrice,
}));

import {
  listCustomerPrices,
  createCustomerPrice,
  updateCustomerPrice,
  deleteCustomerPrice,
} from "../../../controllers/admin/customer-price.controller";

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

describe("admin customer-price.controller", () => {
  it("listCustomerPrices - 应返回客户价格列表", async () => {
    mocks.listCustomerPrices.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { customerId: "1", skuId: "10", page: "1", pageSize: "10" } });
    const res = mockRes();
    await listCustomerPrices(req, res, vi.fn());
    expect(mocks.listCustomerPrices).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 1, skuId: 10, page: 1, pageSize: 10, tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("listCustomerPrices - 使用默认分页参数，customerId 和 skuId 可选", async () => {
    mocks.listCustomerPrices.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listCustomerPrices(req, res, vi.fn());
    expect(mocks.listCustomerPrices).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createCustomerPrice - 应创建客户价格", async () => {
    const body = { customerId: 1, skuId: 10, customPrice: 99.9, effectiveStart: "2026-07-01", effectiveEnd: "2026-12-31" };
    mocks.createCustomerPrice.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createCustomerPrice(req, res, vi.fn());
    expect(mocks.createCustomerPrice).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 1, skuId: 10, customPrice: 99.9, tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createCustomerPrice - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createCustomerPrice(req, res, vi.fn())).rejects.toThrow();
    expect(mocks.createCustomerPrice).not.toHaveBeenCalled();
  });

  it("updateCustomerPrice - 应更新客户价格", async () => {
    const body = { customPrice: 88.8, status: 1 };
    mocks.updateCustomerPrice.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateCustomerPrice(req, res, vi.fn());
    expect(mocks.updateCustomerPrice).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ customPrice: 88.8, status: 1, tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("updateCustomerPrice - 空 body 时（所有字段可选）", async () => {
    mocks.updateCustomerPrice.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await updateCustomerPrice(req, res, vi.fn());
    expect(mocks.updateCustomerPrice).toHaveBeenCalled();
  });

  it("deleteCustomerPrice - 应删除客户价格", async () => {
    mocks.deleteCustomerPrice.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteCustomerPrice(req, res, vi.fn());
    expect(mocks.deleteCustomerPrice).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });
});
