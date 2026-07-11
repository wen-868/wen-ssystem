import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/store/product.service.js", () => ({
  listProducts: vi.fn(),
  listMembers: vi.fn(),
  getCategories: vi.fn(),
  getProductDetail: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as productService from "../../../services/store/product.service.js";
import { ok } from "../../../shared/response.js";
import { listProducts, listMembers, getCategories, getProductDetail } from "../../../controllers/store/product.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "storeuser", storeId: 1 },
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

describe("store/product.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listProducts - 应返回商品列表", async () => {
    (productService.listProducts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { keyword: "测试", barcode: "123", categoryId: "1", tagIds: "1,2,3" } });
    const res = mockRes();
    await listProducts(req as any, res as any);
    expect(productService.listProducts).toHaveBeenCalledWith({
      keyword: "测试",
      barcode: "123",
      categoryId: 1,
      tagIds: [1, 2, 3],
      storeId: 1,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listProducts - 无可选参数时使用默认值", async () => {
    (productService.listProducts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq();
    const res = mockRes();
    await listProducts(req as any, res as any);
    expect(productService.listProducts).toHaveBeenCalledWith(expect.objectContaining({
      keyword: "",
      barcode: "",
      categoryId: undefined,
      tagIds: undefined,
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("listMembers - 应返回会员列表", async () => {
    (productService.listMembers as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { keyword: "会员" } });
    const res = mockRes();
    await listMembers(req as any, res as any);
    expect(productService.listMembers).toHaveBeenCalledWith({
      keyword: "会员",
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("getCategories - 应返回分类列表", async () => {
    (productService.getCategories as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getCategories(req as any, res as any);
    expect(productService.getCategories).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getProductDetail - 应返回商品详情", async () => {
    (productService.getProductDetail as any).mockResolvedValue({ id: 1, name: "商品A" });
    const req = mockReq({ params: { spuId: "1" } });
    const res = mockRes();
    await getProductDetail(req as any, res as any);
    expect(productService.getProductDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });
});
