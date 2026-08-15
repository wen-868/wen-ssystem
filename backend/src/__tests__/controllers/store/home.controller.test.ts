import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

vi.mock("../../../services/instant-retail/retail-shop.service", () => ({
  listBanners: vi.fn(),
  listCategories: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ code: "0", msg: "成功", data })),
  fail: vi.fn((msg, code = "500") => ({ code, msg })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import { ok } from "../../../shared/response";
import { listBanners, listCategories } from "../../../services/instant-retail/retail-shop.service";
import { getHomeBanners, getHomeCategories, getHomeActivities, getHotSearches } from "../../../controllers/store/home.controller";

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "t1",
    headers: {},
    ...overrides,
  };
}

function mockRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() };
}

describe("store home.controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getHomeBanners：返回 banner 列表（映射字段）", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 }); // resolveStoreId
    (listBanners as any).mockResolvedValueOnce([
      { id: 1, banner_title: "首图", banner_image: "a.jpg", link_type: "PRODUCT", link_value: "1" },
    ]);
    const req = mockReq();
    const res = mockRes();
    await getHomeBanners(req as any, res as any, vi.fn());
    const data = (ok as any).mock.calls[0][0];
    expect(data[0].title).toBe("首图");
    expect(data[0].linkType).toBe("PRODUCT");
  });

  it("getHomeCategories：返回分类树", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1 });
    (listCategories as any).mockResolvedValueOnce([{ id: 1, name: "白酒", icon: null, parentId: null, sortOrder: 0, status: "ON", children: [] }]);
    const req = mockReq();
    const res = mockRes();
    await getHomeCategories(req as any, res as any, vi.fn());
    const data = (ok as any).mock.calls[0][0];
    expect(data[0].name).toBe("白酒");
  });

  it("getHomeActivities：返回有效活动", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 1, activity_code: "ACT001", activity_name: "满减", activity_type: "FULL_REDUCTION", activity_desc: "满100减10", start_time: "2026-08-01", end_time: "2026-08-31" },
    ]);
    const req = mockReq();
    const res = mockRes();
    await getHomeActivities(req as any, res as any, vi.fn());
    const data = (ok as any).mock.calls[0][0];
    expect(data[0].name).toBe("满减");
    expect(data[0].type).toBe("FULL_REDUCTION");
  });

  it("getHotSearches：返回热搜词数组", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ keyword: "茅台" }, { keyword: "五粮液" }]);
    const req = mockReq();
    const res = mockRes();
    await getHotSearches(req as any, res as any, vi.fn());
    const data = (ok as any).mock.calls[0][0];
    expect(data).toEqual(["茅台", "五粮液"]);
  });
});
