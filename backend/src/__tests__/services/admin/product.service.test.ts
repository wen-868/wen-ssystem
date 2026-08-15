import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
  cacheGet: vi.fn(),
  syncProductStatus: vi.fn(),
  syncChangedFields: vi.fn(),
  detectChangedFields: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/redis-cache", () => ({
  cacheGet: mocks.cacheGet,
  CacheKeys: { PRODUCT_DETAIL: "product:detail" },
}));

vi.mock("../../../shared/product-sync", () => ({
  syncProductFullChain: vi.fn(),
  syncProductStatus: mocks.syncProductStatus,
  syncProductPrice: vi.fn(),
}));

vi.mock("../../../shared/field-sync", () => ({
  detectChangedFields: mocks.detectChangedFields,
  syncChangedFields: mocks.syncChangedFields,
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(() => "SPU20260815001"),
}));

vi.mock("../../../shared/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { listProducts, getProductDetail, updateProductStatus } from "../../../services/admin/product.service";

describe("admin/product.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listProducts：带关键词直查商品列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ spuId: 1, name: "飞天茅台" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listProducts("茅台", 1, 20, "t1");
    expect(result.total).toBe(1);
    expect(result.records[0].name).toBe("飞天茅台");
  });

  it("getProductDetail：返回商品详情含 SKU", async () => {
    mocks.cacheGet.mockImplementationOnce(async (_k: string, fn: () => unknown) => fn());
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, name: "飞天茅台", status: "ON_SALE" });
    mocks.queryWithTenant
      .mockResolvedValueOnce([{ id: 1, skuName: "500ml" }]) // skus
      .mockResolvedValueOnce([]); // 多单位
    const detail = await getProductDetail(1, "t1");
    expect(detail?.name).toBe("飞天茅台");
    expect(detail?.skus).toHaveLength(1);
  });

  it("updateProductStatus：更新商品状态并触发同步", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce({ affectedRows: 1 });
    mocks.syncProductStatus.mockResolvedValueOnce(undefined);
    const result = await updateProductStatus(1, "OFF_SALE", "t1");
    expect(result?.status).toBe("OFF_SALE");
    expect(mocks.syncProductStatus).toHaveBeenCalled();
  });
});
