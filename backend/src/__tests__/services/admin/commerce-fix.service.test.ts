import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  queryWithTenant: mocks.queryWithTenant,
}));

import { listCouponVerifyRecords } from "../../../services/admin/commerce-fix.service";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("commerce-fix.service - 优惠券核销记录", () => {
  it("listCouponVerifyRecords 分页返回并映射状态", async () => {
    mocks.queryOne.mockResolvedValue({ total: 1 });
    mocks.query.mockResolvedValue([
      { id: 1, coupon_no: "C1", coupon_name: "满100减20", coupon_type: "AMOUNT", discount_amount: 20, status: "USED", used_at: "2026-08-15", used_order_no: "XS1", user_name: "张三", user_mobile: "138" },
    ]);
    const res = await listCouponVerifyRecords(tenantId, { page: 1, pageSize: 20, status: "USED" });
    expect(res.total).toBe(1);
    expect(res.records[0].couponCode).toBe("C1");
    expect(res.records[0].verifyStatus).toBe("VERIFIED"); // USED → VERIFIED
    expect(res.records[0].userName).toBe("张三");
    expect(String(mocks.query.mock.calls[0][0])).toContain("uc.status = ?");
  });

  it("listCouponVerifyRecords 无操作人时兜底为门店收银", async () => {
    mocks.queryOne.mockResolvedValue({ total: 1 });
    mocks.query.mockResolvedValue([
      { id: 2, coupon_no: "C2", coupon_name: "券B", coupon_type: "AMOUNT", discount_amount: 10, status: "UNUSED", used_at: null, used_order_no: null, user_name: null, user_mobile: null },
    ]);
    const res = await listCouponVerifyRecords(tenantId, {});
    expect(res.records[0].verifyStatus).toBe("UNUSED");
    expect(res.records[0].operatorName).toBe("门店收银");
  });

  it("listCouponVerifyRecords 分页参数边界约束", async () => {
    mocks.queryOne.mockResolvedValue({ total: 0 });
    mocks.query.mockResolvedValue([]);
    await listCouponVerifyRecords(tenantId, { page: 0, pageSize: 999 });
    const params = mocks.query.mock.calls[0][1];
    expect(params).toEqual([tenantId, 100, 0]); // pageSize 上限 100
  });
});
