import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db.js", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: mocks.queryWithTenant,
  queryOneWithTenant: mocks.queryOneWithTenant,
  transaction: mocks.transaction,
}));

vi.mock("../../../shared/id.js", () => ({
  makeBizNo: vi.fn(() => "PROMO001"),
}));

import {
  listPromotions,
  createPromotion,
  updatePromotion,
  calculateDiscount,
} from "../../../services/admin/marketing-new-promotion.service.js";

const tenantId = "t1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin marketing-new-promotion.service - listPromotions", () => {
  it("分页查询", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      { id: 1, activityCode: "PROMO001", activityName: "促销活动", activityType: "FULL_REDUCTION", status: "ACTIVE" },
    ]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 10 });
    const res = await listPromotions(1, 20, tenantId);
    expect(res.total).toBe(10);
    expect(res.records).toHaveLength(1);
  });

  it("带类型筛选", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });
    const res = await listPromotions(1, 20, tenantId, "FULL_REDUCTION");
    expect(res.total).toBe(0);
  });

  it("带状态筛选", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce({ total: 0 });
    const res = await listPromotions(1, 20, tenantId, undefined, "ACTIVE");
    expect(res.total).toBe(0);
  });

  it("total 为 null", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    const res = await listPromotions(1, 20, tenantId);
    expect(res.total).toBe(0);
  });
});

describe("admin marketing-new-promotion.service - createPromotion", () => {
  it("创建促销活动", async () => {
    mocks.transaction.mockResolvedValueOnce({});
    const res = await createPromotion({
      activityName: "测试促销",
      activityType: "FULL_REDUCTION",
      startTime: "2026-01-01 00:00:00",
      endTime: "2026-01-31 23:59:59",
      applicableScope: "ALL",
      rules: [{ threshold_amount: 100, reduction_amount: 10 }],
      maxParticipants: 1000,
      priority: 1,
      stackable: 1,
    }, tenantId, 1, "admin");
    expect(res.activityCode).toBe("PROMO001");
  });
});

describe("admin marketing-new-promotion.service - updatePromotion", () => {
  it("更新促销活动", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT" });
    mocks.queryWithTenant.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const res = await updatePromotion(1, { activityName: "更新后" }, tenantId, 1, "admin");
    expect(res.activityId).toBe(1);
  });

  it("促销活动不存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(updatePromotion(999, { activityName: "更新" }, tenantId, 1, "admin")).rejects.toThrow("促销活动不存在");
  });

  it("无更新字段", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({ id: 1, status: "DRAFT" });
    const res = await updatePromotion(1, {}, tenantId, 1, "admin");
    expect(res.activityId).toBe(1);
  });
});

describe("admin marketing-new-promotion.service - calculateDiscount", () => {
  it("仅促销活动折扣", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      {
        id: 1,
        activityType: "FULL_REDUCTION",
        rules: JSON.stringify([{ threshold_amount: 100, reduction_amount: 10, is_continuous: false }]),
        applicableScope: "ALL",
        applicableIds: null,
        priority: 1,
        stackable: 0,
      },
    ]);
    const res = await calculateDiscount({ userId: 1, orderAmount: 200, productIds: [1, 2, 3] }, tenantId);
    expect(res.promotionDiscount).toBe(10);
    expect(res.couponDiscount).toBe(0);
    expect(res.totalDiscount).toBe(10);
    expect(res.finalAmount).toBe(190);
  });

  it("促销活动 + 优惠券", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1,
      couponType: "AMOUNT",
      couponValue: 20,
      minPurchase: 50,
      maxDiscount: null,
      applicableScope: "ALL",
      applicableIds: null,
      validStart: "2026-01-01 00:00:00",
      validEnd: "2026-12-31 23:59:59",
    });
    mocks.queryWithTenant.mockResolvedValueOnce([
      {
        id: 1,
        activityType: "FULL_REDUCTION",
        rules: JSON.stringify([{ threshold_amount: 100, reduction_amount: 10 }]),
        applicableScope: "ALL",
        applicableIds: null,
        priority: 1,
        stackable: 1,
      },
    ]);
    const res = await calculateDiscount({ userId: 1, orderAmount: 200, productIds: [1, 2, 3], couponNo: "UC001" }, tenantId);
    expect(res.promotionDiscount).toBe(10);
    expect(res.couponDiscount).toBe(20);
    expect(res.totalDiscount).toBe(30);
  });

  it("优惠券不存在", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce(null);
    await expect(calculateDiscount({ userId: 1, orderAmount: 200, productIds: [1], couponNo: "UC999" }, tenantId)).rejects.toThrow("优惠券不存在或已使用");
  });

  it("优惠券已过期", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1,
      couponType: "AMOUNT",
      couponValue: 20,
      minPurchase: 50,
      maxDiscount: null,
      applicableScope: "ALL",
      applicableIds: null,
      validStart: "2020-01-01 00:00:00",
      validEnd: "2020-12-31 23:59:59",
    });
    await expect(calculateDiscount({ userId: 1, orderAmount: 200, productIds: [1], couponNo: "UC001" }, tenantId)).rejects.toThrow("优惠券已过期");
  });

  it("订单金额未达门槛", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1,
      couponType: "AMOUNT",
      couponValue: 20,
      minPurchase: 500,
      maxDiscount: null,
      applicableScope: "ALL",
      applicableIds: null,
      validStart: "2026-01-01 00:00:00",
      validEnd: "2026-12-31 23:59:59",
    });
    await expect(calculateDiscount({ userId: 1, orderAmount: 200, productIds: [1], couponNo: "UC001" }, tenantId)).rejects.toThrow("订单金额需满500元");
  });

  it("折扣类型优惠券", async () => {
    mocks.queryOneWithTenant.mockResolvedValueOnce({
      id: 1,
      couponType: "DISCOUNT",
      couponValue: 0.8,
      minPurchase: 100,
      maxDiscount: 50,
      applicableScope: "ALL",
      applicableIds: null,
      validStart: "2026-01-01 00:00:00",
      validEnd: "2026-12-31 23:59:59",
    });
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const res = await calculateDiscount({ userId: 1, orderAmount: 300, productIds: [1], couponNo: "UC001" }, tenantId);
    expect(res.couponDiscount).toBe(50);
  });

  it("连续满减", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      {
        id: 1,
        activityType: "FULL_REDUCTION",
        rules: JSON.stringify([{ threshold_amount: 100, reduction_amount: 10, is_continuous: true }]),
        applicableScope: "ALL",
        applicableIds: null,
        priority: 1,
        stackable: 0,
      },
    ]);
    const res = await calculateDiscount({ userId: 1, orderAmount: 250, productIds: [1] }, tenantId);
    expect(res.promotionDiscount).toBe(20);
  });

  it("商品范围不匹配", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      {
        id: 1,
        activityType: "FULL_REDUCTION",
        rules: JSON.stringify([{ threshold_amount: 100, reduction_amount: 10 }]),
        applicableScope: "SPECIFIC",
        applicableIds: JSON.stringify([999]),
        priority: 1,
        stackable: 0,
      },
    ]);
    const res = await calculateDiscount({ userId: 1, orderAmount: 200, productIds: [1, 2] }, tenantId);
    expect(res.promotionDiscount).toBe(0);
  });

  it("无促销活动", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([]);
    const res = await calculateDiscount({ userId: 1, orderAmount: 100, productIds: [1] }, tenantId);
    expect(res.promotionDiscount).toBe(0);
    expect(res.finalAmount).toBe(100);
  });

  it("不可叠加", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      {
        id: 1,
        activityType: "FULL_REDUCTION",
        rules: JSON.stringify([{ threshold_amount: 100, reduction_amount: 10 }]),
        applicableScope: "ALL",
        applicableIds: null,
        priority: 2,
        stackable: 0,
      },
      {
        id: 2,
        activityType: "FULL_REDUCTION",
        rules: JSON.stringify([{ threshold_amount: 50, reduction_amount: 5 }]),
        applicableScope: "ALL",
        applicableIds: null,
        priority: 1,
        stackable: 0,
      },
    ]);
    const res = await calculateDiscount({ userId: 1, orderAmount: 200, productIds: [1] }, tenantId);
    expect(res.appliedPromotions).toHaveLength(1);
  });

  it("JSON解析异常时使用默认值", async () => {
    mocks.queryWithTenant.mockResolvedValueOnce([
      {
        id: 1,
        activityType: "FULL_REDUCTION",
        rules: "invalid json",
        applicableScope: "SPECIFIC",
        applicableIds: "also invalid",
        priority: 1,
        stackable: 0,
      },
    ]);
    const res = await calculateDiscount({ userId: 1, orderAmount: 200, productIds: [1] }, tenantId);
    expect(res.promotionDiscount).toBe(0);
  });
});