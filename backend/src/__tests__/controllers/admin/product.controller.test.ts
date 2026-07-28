import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/product.service", () => ({
  listProducts: vi.fn(),
  getProductDetail: vi.fn(),
  createProduct: vi.fn(),
  updateProductStatus: vi.fn(),
  updateProduct: vi.fn(),
  disableProduct: vi.fn(),
  getProductPriceHistory: vi.fn(),
  updateProductPrice: vi.fn(),
  importProducts: vi.fn(),
  setMarketingTags: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as productService from "../../../services/admin/product.service";
import { ok, fail } from "../../../shared/response";
import {
  listProducts, getProductDetail, createProduct, updateProductStatus,
  updateProduct, disableProduct, getProductPriceHistory, updateProductPrice,
  importProducts, setMarketingTags
} from "../../../controllers/admin/product.controller";

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

describe("product.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listProducts - 应返回商品列表", async () => {
    (productService.listProducts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 10 } });
    const res = mockRes();
    await listProducts(req as any, res as any, vi.fn());
    expect(productService.listProducts).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getProductDetail - 应返回商品详情", async () => {
    (productService.getProductDetail as any).mockResolvedValue({ id: 1, name: "商品A" });
    const req = mockReq({ params: { spuId: "1" } });
    const res = mockRes();
    await getProductDetail(req as any, res as any, vi.fn());
    expect(productService.getProductDetail).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createProduct - 应创建商品", async () => {
    (productService.createProduct as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { name: "新商品", categoryId: 1, skus: [{ skuName: "SKU1", retailPrice: 100 }] } });
    const res = mockRes();
    await createProduct(req as any, res as any, vi.fn());
    expect(productService.createProduct).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateProductStatus - 商品不存在应返回404", async () => {
    (productService.updateProductStatus as any).mockResolvedValue(null);
    const req = mockReq({ params: { spuId: "999" }, body: { status: "ON_SALE" } });
    const res = mockRes();
    await updateProductStatus(req as any, res as any, vi.fn());
    expect(fail).toHaveBeenCalledWith("商品不存在", "404");
  });

  it("updateProductStatus - 应更新商品状态", async () => {
    (productService.updateProductStatus as any).mockResolvedValue({ id: 1, status: "ON_SALE" });
    const req = mockReq({ params: { spuId: "1" }, body: { status: "ON_SALE" } });
    const res = mockRes();
    await updateProductStatus(req as any, res as any, vi.fn());
    expect(ok).toHaveBeenCalled();
  });

  it("disableProduct - 应禁用商品", async () => {
    (productService.disableProduct as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { spuId: "1" } });
    const res = mockRes();
    await disableProduct(req as any, res as any, vi.fn());
    expect(productService.disableProduct).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("importProducts - 应批量导入商品", async () => {
    (productService.importProducts as any).mockResolvedValue({ success: 10 });
    const req = mockReq({ body: { rows: [{ name: "商品1" }] } });
    const res = mockRes();
    await importProducts(req as any, res as any, vi.fn());
    expect(productService.importProducts).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("importProducts - 空数据应返回400", async () => {
    const req = mockReq({ body: { rows: [] } });
    const res = mockRes();
    await importProducts(req as any, res as any, vi.fn());
    expect(fail).toHaveBeenCalledWith("请提供有效的导入数据", "400");
  });

  it("getProductPriceHistory - 应返回价格历史", async () => {
    (productService.getProductPriceHistory as any).mockResolvedValue([]);
    const req = mockReq({ params: { skuId: "1" } });
    const res = mockRes();
    await getProductPriceHistory(req as any, res as any, vi.fn());
    expect(ok).toHaveBeenCalled();
  });

  it("setMarketingTags - 应设置营销标签", async () => {
    (productService.setMarketingTags as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { spuId: "1" }, body: { tags: ["热销"] } });
    const res = mockRes();
    await setMarketingTags(req as any, res as any, vi.fn());
    expect(ok).toHaveBeenCalled();
  });

  // ==================== 分支覆盖率补充测试 ====================
  it("listProducts - 不传page/pageSize/keyword时使用默认值", async () => {
    (productService.listProducts as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listProducts(req as any, res as any, vi.fn());
    expect(productService.listProducts).toHaveBeenCalledWith("", 1, 20, "t1");
  });

  it("updateProduct - 商品不存在应返回404", async () => {
    (productService.updateProduct as any).mockResolvedValue(null);
    const req = mockReq({ params: { spuId: "999" }, body: { name: "新名称" } });
    const res = mockRes();
    await updateProduct(req as any, res as any, vi.fn());
    expect(fail).toHaveBeenCalledWith("商品不存在", "404");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updateProduct - 应更新商品", async () => {
    (productService.updateProduct as any).mockResolvedValue({ id: 1, name: "新名称" });
    const req = mockReq({ params: { spuId: "1" }, body: { name: "新名称" } });
    const res = mockRes();
    await updateProduct(req as any, res as any, vi.fn());
    expect(ok).toHaveBeenCalled();
  });

  it("updateProductPrice - user无id时使用默认值0", async () => {
    (productService.updateProductPrice as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { skuId: "1" }, body: { retailPrice: 200 }, user: {} });
    const res = mockRes();
    await updateProductPrice(req as any, res as any, vi.fn());
    expect(productService.updateProductPrice).toHaveBeenCalledWith(1, expect.any(Object), "t1", 0);
  });

  it("importProducts - rows非数组时应返回400", async () => {
    const req = mockReq({ body: { rows: "not-an-array" } });
    const res = mockRes();
    await importProducts(req as any, res as any, vi.fn());
    expect(fail).toHaveBeenCalledWith("请提供有效的导入数据", "400");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("importProducts - rows缺失时应返回400", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await importProducts(req as any, res as any, vi.fn());
    expect(fail).toHaveBeenCalledWith("请提供有效的导入数据", "400");
  });

  it("createProduct - 不传skus时使用默认SKU", async () => {
    (productService.createProduct as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { name: "新商品", categoryId: 1, skuName: "默认SKU", retailPrice: 100 } });
    const res = mockRes();
    await createProduct(req as any, res as any, vi.fn());
    expect(productService.createProduct).toHaveBeenCalled();
    const calledArgs = (productService.createProduct as any).mock.calls[0];
    expect(calledArgs[0].skus).toHaveLength(1);
    expect(calledArgs[0].skus[0].skuName).toBe("默认SKU");
  });
});
