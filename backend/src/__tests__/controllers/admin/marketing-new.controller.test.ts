import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listCouponTemplates: vi.fn(),
  getCouponTemplate: vi.fn(),
  createCouponTemplate: vi.fn(),
  updateCouponTemplate: vi.fn(),
  issueCoupons: vi.fn(),
  listUserCoupons: vi.fn(),
  listPromotions: vi.fn(),
  createPromotion: vi.fn(),
  updatePromotion: vi.fn(),
  calculateDiscount: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-new-coupon.service.js", () => ({
  listCouponTemplates: mocks.listCouponTemplates,
  getCouponTemplate: mocks.getCouponTemplate,
  createCouponTemplate: mocks.createCouponTemplate,
  updateCouponTemplate: mocks.updateCouponTemplate,
  issueCoupons: mocks.issueCoupons,
  listUserCoupons: mocks.listUserCoupons,
}));

vi.mock("../../../services/admin/marketing-new-promotion.service.js", () => ({
  listPromotions: mocks.listPromotions,
  createPromotion: mocks.createPromotion,
  updatePromotion: mocks.updatePromotion,
  calculateDiscount: mocks.calculateDiscount,
}));

import {
  listCouponTemplates,
  getCouponTemplate,
  createCouponTemplate,
  updateCouponTemplate,
  issueCoupons,
  listUserCoupons,
  listPromotions,
  createPromotion,
  updatePromotion,
  calculateDiscount,
} from "../../../controllers/admin/marketing-new.controller.js";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin marketing-new.controller", () => {
  describe("优惠券模板", () => {
    it("listCouponTemplates - 应返回优惠券模板列表", async () => {
      mocks.listCouponTemplates.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { page: "1", pageSize: "10", status: "ACTIVE", type: "AMOUNT" } });
      const res = mockRes();
      await listCouponTemplates(req, res);
      expect(mocks.listCouponTemplates).toHaveBeenCalledWith(1, 10, "t1", "ACTIVE", "AMOUNT");
      expect(res.json).toHaveBeenCalled();
    });

    it("listCouponTemplates - 使用默认分页参数", async () => {
      mocks.listCouponTemplates.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listCouponTemplates(req, res);
      expect(mocks.listCouponTemplates).toHaveBeenCalledWith(1, 20, "t1", undefined, undefined);
    });

    it("getCouponTemplate - 应返回优惠券模板详情", async () => {
      mocks.getCouponTemplate.mockResolvedValue({ id: 1, templateName: "满减券" });
      const req = mockReq({ params: { templateId: "1" } });
      const res = mockRes();
      await getCouponTemplate(req, res);
      expect(mocks.getCouponTemplate).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("createCouponTemplate - 应创建优惠券模板", async () => {
      const body = {
        templateName: "满100减20",
        couponType: "AMOUNT",
        couponValue: 20,
        validType: "FIXED",
        validStart: "2026-07-01",
        validEnd: "2026-12-31",
      };
      mocks.createCouponTemplate.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createCouponTemplate(req, res);
      expect(mocks.createCouponTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ templateName: "满100减20" }),
        "t1",
        1,
        "admin"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createCouponTemplate - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: { couponType: "AMOUNT" } });
      const res = mockRes();
      await expect(createCouponTemplate(req, res)).rejects.toThrow();
      expect(mocks.createCouponTemplate).not.toHaveBeenCalled();
    });

    it("updateCouponTemplate - 应更新优惠券模板", async () => {
      const body = { templateName: "新名称", status: "ACTIVE" };
      mocks.updateCouponTemplate.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { templateId: "1" }, body });
      const res = mockRes();
      await updateCouponTemplate(req, res);
      expect(mocks.updateCouponTemplate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ templateName: "新名称" }),
        "t1",
        1,
        "admin"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("issueCoupons - 应发放优惠券", async () => {
      const body = { userIds: [1, 2, 3] };
      mocks.issueCoupons.mockResolvedValue({ success: 3 });
      const req = mockReq({ params: { templateId: "1" }, body });
      const res = mockRes();
      await issueCoupons(req, res);
      expect(mocks.issueCoupons).toHaveBeenCalledWith(1, [1, 2, 3], "t1", 1, "admin");
      expect(res.json).toHaveBeenCalled();
    });

    it("issueCoupons - 空 userIds 时 zod 校验抛错", async () => {
      const req = mockReq({ params: { templateId: "1" }, body: { userIds: [] } });
      const res = mockRes();
      await expect(issueCoupons(req, res)).rejects.toThrow();
    });

    it("listUserCoupons - 应返回用户优惠券列表", async () => {
      mocks.listUserCoupons.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { userId: "1", status: "UNUSED", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listUserCoupons(req, res);
      expect(mocks.listUserCoupons).toHaveBeenCalledWith(1, 10, "t1", 1, "UNUSED");
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("促销活动", () => {
    it("listPromotions - 应返回促销活动列表", async () => {
      mocks.listPromotions.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { type: "FULL_REDUCTION", status: "ACTIVE", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listPromotions(req, res);
      expect(mocks.listPromotions).toHaveBeenCalledWith(1, 10, "t1", "FULL_REDUCTION", "ACTIVE");
      expect(res.json).toHaveBeenCalled();
    });

    it("createPromotion - 应创建促销活动", async () => {
      const body = {
        activityName: "夏日特惠",
        activityType: "FULL_REDUCTION",
        startTime: "2026-07-01",
        endTime: "2026-07-31",
        rules: [{ minAmount: 100, reduceAmount: 20 }],
      };
      mocks.createPromotion.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createPromotion(req, res);
      expect(mocks.createPromotion).toHaveBeenCalledWith(
        expect.objectContaining({ activityName: "夏日特惠" }),
        "t1",
        1,
        "admin"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createPromotion - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: { activityName: "测试" } });
      const res = mockRes();
      await expect(createPromotion(req, res)).rejects.toThrow();
      expect(mocks.createPromotion).not.toHaveBeenCalled();
    });

    it("updatePromotion - 应更新促销活动", async () => {
      const body = { activityName: "新名称", status: "ACTIVE" };
      mocks.updatePromotion.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { activityId: "1" }, body });
      const res = mockRes();
      await updatePromotion(req, res);
      expect(mocks.updatePromotion).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ activityName: "新名称" }),
        "t1",
        1,
        "admin"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("calculateDiscount - 应计算折扣", async () => {
      const body = {
        userId: 1,
        orderAmount: 200,
        productIds: [1, 2],
        couponNo: "COUPON001",
      };
      mocks.calculateDiscount.mockResolvedValue({ finalAmount: 180 });
      const req = mockReq({ body });
      const res = mockRes();
      await calculateDiscount(req, res);
      expect(mocks.calculateDiscount).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, orderAmount: 200 }),
        "t1"
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("calculateDiscount - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: { userId: 1 } });
      const res = mockRes();
      await expect(calculateDiscount(req, res)).rejects.toThrow();
    });
  });
});
