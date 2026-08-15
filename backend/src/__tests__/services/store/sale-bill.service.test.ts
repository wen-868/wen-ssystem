import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: vi.fn(),
  pool: {},
}));

vi.mock("../../../shared/fulfillment", () => ({
  computeSellingPrice: vi.fn(),
  getPriceType: vi.fn(),
}));

vi.mock("../../../shared/trace-code", () => ({
  updateTraceCodesBySkuList: vi.fn(),
  verifyTraceCode: vi.fn(),
}));

vi.mock("../../../shared/id", () => ({
  makeBizNo: vi.fn(() => "XS20260815001"),
  makeToken: vi.fn(() => "token"),
}));

vi.mock("../../notification.service", () => ({
  sendNotification: vi.fn(),
}));

import { listSaleBills, getSaleBillDetail } from "../../../services/store/sale-bill.service";

describe("store/sale-bill.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("listSaleBills：分页销售单列表", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([{ billNo: "XS001", receivableAmount: 100 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 1 });
    const result = await listSaleBills({ page: 1, pageSize: 20, storeId: 1, keyword: "", collectionStatus: null, tenantId: "t1" });
    expect(result.total).toBe(1);
    expect(result.records[0].billNo).toBe("XS001");
  });

  it("getSaleBillDetail：返回销售单详情含明细", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ billNo: "XS001", receivableAmount: 100 });
    mocks.queryWithTenant.mockResolvedValueOnce([{ skuId: 1, skuName: "酒", totalBottleQty: 2 }]);
    const detail = await getSaleBillDetail("XS001", "t1");
    expect(detail?.billNo).toBe("XS001");
    expect(detail?.items).toHaveLength(1);
  });

  it("getSaleBillDetail：单不存在返回 null", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    expect(await getSaleBillDetail("NOPE", "t1")).toBeNull();
  });
});
