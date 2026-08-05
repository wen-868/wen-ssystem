/**
 * 营销优惠计算 service 单元测试（R76-02 services 层覆盖率补齐）
 * 被测文件：src/services/admin/marketing-calculation.service.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
}));

import { calculatePromotion } from "../../../services/admin/marketing-calculation.service";

const baseItems = [
  { skuId: 1, productId: 1, quantity: 2, unitPrice: 100 },
  { skuId: 2, productId: 2, quantity: 1, unitPrice: 50 },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("marketing-calculation.service - calculatePromotion", () => {
  it("无任何促销时原价等于折后价，breakdown 为空", async () => {
    const res = await calculatePromotion({ items: baseItems }, "t1");
    expect(res).toEqual({
      originalTotal: 250,
      discountedTotal: 250,
      totalSaved: 0,
      breakdown: [],
    });
    expect(mocks.queryOneWithTenant).not.toHaveBeenCalled();
  });

  it("秒杀命中时减免差价", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1,
      sku_id: 1,
      flash_price: 80,
      status: "ACTIVE",
      start_time: "2026-01-01",
      end_time: "2026-12-31",
    });
    const res = await calculatePromotion({ items: baseItems, flashSaleId: 1 }, "t1");
    expect(res.discountedTotal).toBe(210);
    expect(res.breakdown).toContainEqual({ type: "FLASH_SALE", id: 1, discount: 40, description: "秒杀优惠" });
  });

  it("秒杀未命中或无匹配 SKU 时无折扣", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    const res1 = await calculatePromotion({ items: baseItems, flashSaleId: 1 }, "t1");
    expect(res1.discountedTotal).toBe(250);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 2, sku_id: 99, flash_price: 1, status: "ACTIVE", start_time: "2026-01-01", end_time: "2026-12-31" });
    const res2 = await calculatePromotion({ items: baseItems, flashSaleId: 2 }, "t1");
    expect(res2.discountedTotal).toBe(250);
  });

  it("拼团命中时减免差价", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1,
      activity_id: 1,
      status: "PENDING",
      target_size: 3,
      current_size: 1,
      group_price: 10,
      sku_id: 2,
      activityStatus: "ACTIVE",
    });
    const res = await calculatePromotion({ items: baseItems, groupBuyTeamId: 1 }, "t1");
    expect(res.discountedTotal).toBe(210);
    expect(res.breakdown).toContainEqual({ type: "GROUP_BUY", id: 1, discount: 40, description: "拼团优惠" });
  });

  it("满减按最高档规则减免，多活动叠加", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 1, rules: JSON.stringify([{ minAmount: 100, reduceAmount: 10 }, { minAmount: 200, reduceAmount: 30 }]), applicable_scope: "ALL", applicable_ids: null, stackable: 1 },
      { id: 2, rules: JSON.stringify([{ minAmount: 50, reduceAmount: 5 }]), applicable_scope: "ALL", applicable_ids: null, stackable: 1 },
    ]);
    const res = await calculatePromotion({ items: baseItems, fullReductionIds: [1, 2] }, "t1");
    expect(res.discountedTotal).toBe(215);
    expect(res.breakdown.filter((b) => b.type === "FULL_REDUCTION")).toHaveLength(2);
  });

  it("优惠券 FIXED 直接抵扣", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1,
      type: "FIXED",
      value: 20,
      min_amount: 100,
      max_discount: null,
      applicable_scope: "ALL",
      applicable_ids: null,
    });
    const res = await calculatePromotion({ items: baseItems, couponTemplateId: 1 }, "t1");
    expect(res.discountedTotal).toBe(230);
    expect(res.breakdown).toContainEqual({ type: "COUPON", id: 1, discount: 20, description: "优惠券抵扣20元" });
  });

  it("优惠券 PERCENT 按比例抵扣，max_discount 封顶", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 2,
      type: "PERCENT",
      value: 10,
      min_amount: 0,
      max_discount: 15,
      applicable_scope: "ALL",
      applicable_ids: null,
    });
    const res = await calculatePromotion({ items: baseItems, couponTemplateId: 2 }, "t1");
    expect(res.discountedTotal).toBe(235);
    expect(res.breakdown[0].discount).toBe(15);
    expect(res.breakdown[0].description).toBe("优惠券10%折扣");
  });

  it("优惠券金额不足门槛时不抵扣", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 3,
      type: "FIXED",
      value: 20,
      min_amount: 1000,
      max_discount: null,
      applicable_scope: "ALL",
      applicable_ids: null,
    });
    const res = await calculatePromotion({ items: baseItems, couponTemplateId: 3 }, "t1");
    expect(res.discountedTotal).toBe(250);
    expect(res.breakdown).toEqual([]);
  });

  it("叠加优惠后折后价不为负（兜底 0）", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1,
      type: "FIXED",
      value: 999,
      min_amount: 0,
      max_discount: null,
      applicable_scope: "ALL",
      applicable_ids: null,
    });
    const res = await calculatePromotion({ items: baseItems, couponTemplateId: 1 }, "t1");
    expect(res.discountedTotal).toBe(0);
  });
});
