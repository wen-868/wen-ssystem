import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { getCategories, getProductDetail, listProducts, listMembers } from "../../../services/store/product.service";

describe("store/product.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getCategories：返回分类列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 1, name: "白酒", parentId: null, sortNo: 0 },
    ]);
    const result = await getCategories("t1");
    expect(result.records[0].name).toBe("白酒");
  });

  it("getProductDetail：返回商品详情", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1, name: "飞天茅台", categoryName: "白酒", status: "ON_SALE",
    });
    const detail = await getProductDetail(1, "t1");
    expect(detail?.name).toBe("飞天茅台");
  });

  it("listProducts：分页商品列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, name: "酒" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listProducts({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.records[0].name).toBe("酒");
  });

  it("listMembers：分页会员列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ id: 1, name: "张三" }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listMembers({ page: 1, pageSize: 20, tenantId: "t1" });
    expect(result.records[0].name).toBe("张三");
  });
});
