import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
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

// S3-78：通知入口已收敛到「落库 + 推送」版（原 ../notification.service 重复写入器已删除）
vi.mock("../../../services/admin/notification-sender.service", () => ({
  sendNotificationWithPush: vi.fn().mockResolvedValue({ notificationId: 1, pushResults: [] }),
  sendNotification: vi.fn().mockResolvedValue(1),
}));

import { listSaleBills, getSaleBillDetail, createSaleBill } from "../../../services/store/sale-bill.service";

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

  it("createSaleBill：明细 INSERT 显式带 tenant_id（B-2b 修复点 1）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce({ id: 5, name: "张三", mobile: "13800000001", customer_type: "RETAIL" })
      .mockResolvedValueOnce({
        sku_name: "示例白酒", volume: "500ml", packaging: "瓶装",
        base_unit: "瓶", barcode: "6900000000001",
        retail_price: 100, wholesale_price: 80, store_price: 90,
      });
    const mockConn = { execute: vi.fn().mockResolvedValue([{}]) };
    mocks.transaction.mockImplementation(async (cb: any) => cb(mockConn));

    await createSaleBill({
      storeId: 1,
      customerId: 5,
      discountAmount: 0,
      roundingAmount: 0,
      saleType: "CASH",
      items: [{ skuId: 1, boxQty: 1, bottleQty: 6, totalBottleQty: 6 }],
      userId: 1,
      tenantId: "t1",
    });

    const itemInsert = mockConn.execute.mock.calls.find((call: any[]) => String(call[0]).includes("t_sale_bill_item"));
    expect(itemInsert).toBeDefined();
    expect(String(itemInsert![0])).toMatch(/tenant_id/);
    expect(itemInsert![1][itemInsert![1].length - 1]).toBe("t1");
  });
});
