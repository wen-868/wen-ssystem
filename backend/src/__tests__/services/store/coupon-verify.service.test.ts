import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryOneWithTenant: vi.fn(),
  queryWithTenant: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import { verifyCouponByCode, manualVerifyCoupon } from "../../../services/store/coupon-verify.service";

const tenantId = "t1";
const mockConn = { execute: vi.fn() };

function mockCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    coupon_no: "C0001",
    template_id: 10,
    user_id: 9,
    coupon_type: "AMOUNT",
    coupon_name: "满100减20",
    coupon_value: 20,
    min_purchase: 100,
    max_discount: null,
    status: "UNUSED",
    valid_start: "2026-01-01 00:00:00",
    valid_end: "2026-12-31 23:59:59",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (c: typeof mockConn) => Promise<unknown>) => cb(mockConn));
  mocks.connExecute.mockImplementation(async (conn: typeof mockConn, sql: string, params: unknown[]) => conn.execute(sql, params));
  mockConn.execute.mockResolvedValue([{ affectedRows: 1 }]);
});

describe("coupon-verify.service - 按券码核销", () => {
  it("核销成功：状态置 USED、模板 used_quantity +1、返回券信息", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await verifyCouponByCode({ tenantId, code: "C0001", orderNo: "XS2026081500001", orderAmount: 150 });
    expect(res.status).toBe("USED");
    expect(res.discountAmount).toBe(20);
    expect(res.userName).toBe("张三");
    const updateCall = mockConn.execute.mock.calls.find((call: any) => call[0].includes("UPDATE t_user_coupon"));
    expect(updateCall).toBeTruthy();
    const templateCall = mockConn.execute.mock.calls.find((call: any) => call[0].includes("UPDATE t_coupon_template"));
    expect(templateCall).toBeTruthy();
  });

  it("券不存在抛 404", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(verifyCouponByCode({ tenantId, code: "NOPE" }))
      .rejects.toMatchObject({ statusCode: 404, message: "优惠券不存在" });
  });

  it("已核销券抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(mockCoupon({ status: "USED" }));
    await expect(verifyCouponByCode({ tenantId, code: "C0001" }))
      .rejects.toMatchObject({ statusCode: 400, message: "优惠券已核销" });
  });

  it("已过期券抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(mockCoupon({
      valid_start: "2020-01-01 00:00:00",
      valid_end: "2020-12-31 23:59:59",
    }));
    await expect(verifyCouponByCode({ tenantId, code: "C0001" }))
      .rejects.toMatchObject({ statusCode: 400, message: "优惠券不在有效期内" });
  });

  it("未满足最低消费抛错", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(mockCoupon());
    await expect(verifyCouponByCode({ tenantId, code: "C0001", orderAmount: 50 }))
      .rejects.toMatchObject({ statusCode: 400, message: "未满足最低消费¥100" });
  });

  it("并发下条件更新 0 行时抛重复核销错", async () => {
    mockConn.execute.mockResolvedValue([{ affectedRows: 0 }]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(mockCoupon());
    await expect(verifyCouponByCode({ tenantId, code: "C0001" }))
      .rejects.toMatchObject({ statusCode: 400, message: "优惠券已被核销，请勿重复操作" });
  });
});

describe("coupon-verify.service - 手动核销", () => {
  it("手机号匹配时核销成功", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce({ id: 9, name: "张三", mobile: "13800000000" })
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await manualVerifyCoupon({ tenantId, couponCode: "C0001", mobile: "13800000000", saleBillNo: "XS2026081500001" });
    expect(res.status).toBe("USED");
  });

  it("手机号与券归属不匹配抛错", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce({ id: 9, name: "张三", mobile: "13800000000" });
    await expect(manualVerifyCoupon({ tenantId, couponCode: "C0001", mobile: "13911112222" }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("coupon-verify.service - 状态/模板分支", () => {
  it("已锁定券抛 400", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(mockCoupon({ status: "LOCKED" }));
    await expect(verifyCouponByCode({ tenantId, code: "C0001" }))
      .rejects.toMatchObject({ statusCode: 400, message: "优惠券已锁定" });
  });

  it("模板不存在时仍核销成功（不更新 used_quantity）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await verifyCouponByCode({ tenantId, code: "C0001", orderNo: "X1", orderAmount: 150 });
    expect(res.status).toBe("USED");
    expect(mockConn.execute).toHaveBeenCalledTimes(1); // 仅更新用户券，无模板更新
  });
});

describe("coupon-verify.service - calcDiscount 分支", () => {
  it("DISCOUNT 券：9 折上限 10 → 优惠 10", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon({ coupon_type: "DISCOUNT", coupon_value: 0.9, max_discount: 10 }))
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await verifyCouponByCode({ tenantId, code: "C0001", orderNo: "X1", orderAmount: 100 });
    expect(res.discountAmount).toBe(10);
  });

  it("DISCOUNT 券：折扣率 >1 截断为 1 → 优惠 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon({ coupon_type: "DISCOUNT", coupon_value: 1.5, max_discount: null }))
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await verifyCouponByCode({ tenantId, code: "C0001", orderNo: "X1", orderAmount: 100 });
    expect(res.discountAmount).toBe(0);
  });

  it("DISCOUNT 券：折扣率 <0 截断为 0 → 优惠订单全额", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon({ coupon_type: "DISCOUNT", coupon_value: -0.5, max_discount: null }))
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await verifyCouponByCode({ tenantId, code: "C0001", orderNo: "X1", orderAmount: 100 });
    expect(res.discountAmount).toBe(100);
  });

  it("DISCOUNT 券：优惠超 max_discount 时截断", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon({ coupon_type: "DISCOUNT", coupon_value: 0.8, max_discount: 5 }))
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await verifyCouponByCode({ tenantId, code: "C0001", orderNo: "X1", orderAmount: 100 });
    expect(res.discountAmount).toBe(5);
  });

  it("GIFT 券无现金优惠 → 0", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon({ coupon_type: "GIFT" }))
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await verifyCouponByCode({ tenantId, code: "C0001", orderNo: "X1", orderAmount: 100 });
    expect(res.discountAmount).toBe(0);
  });

  it("无订单金额时按券面值核销（AMOUNT 分支）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await verifyCouponByCode({ tenantId, code: "C0001" });
    expect(res.discountAmount).toBe(20);
  });
});

describe("coupon-verify.service - 手动核销分支", () => {
  it("无手机号时直接核销成功（跳过归属校验）", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ name: "张三", mobile: "13800000000" });
    const res = await manualVerifyCoupon({ tenantId, couponCode: "C0001", saleBillNo: "X1" });
    expect(res.status).toBe("USED");
  });

  it("有手机号但会员不存在 → 400", async () => {
    mocks.queryOneWithTenant
      .mockResolvedValueOnce(mockCoupon())
      .mockResolvedValueOnce(null);
    await expect(manualVerifyCoupon({ tenantId, couponCode: "C0001", mobile: "13800000000" }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
