import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/marketing-coupon.service", () => ({
  createCouponTemplate: vi.fn(),
  listCouponTemplates: vi.fn(),
  getCouponTemplate: vi.fn(),
  updateCouponTemplate: vi.fn(),
  deleteCouponTemplate: vi.fn(),
  activateCouponTemplate: vi.fn(),
  pauseCouponTemplate: vi.fn(),
  listUserCoupons: vi.fn(),
  getCouponStatistics: vi.fn(),
  listAvailableCoupons: vi.fn(),
  claimCoupon: vi.fn(),
  listMyCoupons: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as couponService from "../../../services/admin/marketing-coupon.service";
import { ok, fail } from "../../../shared/response";
import {
  createCouponTemplate,
  listCouponTemplates,
  getCouponTemplate,
  updateCouponTemplate,
  deleteCouponTemplate,
  activateCouponTemplate,
  pauseCouponTemplate,
  listUserCoupons,
  getCouponStatistics,
  listAvailableCoupons,
  claimCoupon,
  listMyCoupons,
} from "../../../controllers/admin/marketing-coupon.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin" },
  query: {},
  params: {},
  body: {},
  headers: {},
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

describe("marketing-coupon.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createCouponTemplate - 应创建优惠券模板", async () => {
    (couponService.createCouponTemplate as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        name: "满100减20",
        type: "FIXED",
        value: 20,
        minAmount: 100,
        startTime: "2024-01-01",
        endTime: "2024-12-31",
      },
    });
    const res = mockRes();
    await createCouponTemplate(req as any, res as any, vi.fn());
    expect(couponService.createCouponTemplate).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ id: 1 });
  });

  it("createCouponTemplate - 缺少必填字段应抛出错误", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createCouponTemplate(req as any, res as any, vi.fn())).rejects.toThrow();
  });

  it("listCouponTemplates - 应返回优惠券模板列表", async () => {
    (couponService.listCouponTemplates as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listCouponTemplates(req as any, res as any, vi.fn());
    expect(couponService.listCouponTemplates).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getCouponTemplate - 应返回单个优惠券模板", async () => {
    (couponService.getCouponTemplate as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await getCouponTemplate(req as any, res as any, vi.fn());
    expect(couponService.getCouponTemplate).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateCouponTemplate - 应更新优惠券模板", async () => {
    (couponService.updateCouponTemplate as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { name: "更新名称" },
    });
    const res = mockRes();
    await updateCouponTemplate(req as any, res as any, vi.fn());
    expect(couponService.updateCouponTemplate).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteCouponTemplate - 应删除优惠券模板", async () => {
    (couponService.deleteCouponTemplate as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteCouponTemplate(req as any, res as any, vi.fn());
    expect(couponService.deleteCouponTemplate).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("activateCouponTemplate - 应激活优惠券模板", async () => {
    (couponService.activateCouponTemplate as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await activateCouponTemplate(req as any, res as any, vi.fn());
    expect(couponService.activateCouponTemplate).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("pauseCouponTemplate - 应暂停优惠券模板", async () => {
    (couponService.pauseCouponTemplate as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await pauseCouponTemplate(req as any, res as any, vi.fn());
    expect(couponService.pauseCouponTemplate).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listUserCoupons - 应返回用户优惠券列表", async () => {
    (couponService.listUserCoupons as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listUserCoupons(req as any, res as any, vi.fn());
    expect(couponService.listUserCoupons).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getCouponStatistics - 应返回优惠券统计", async () => {
    (couponService.getCouponStatistics as any).mockResolvedValue({ total: 0 });
    const req = mockReq();
    const res = mockRes();
    await getCouponStatistics(req as any, res as any, vi.fn());
    expect(couponService.getCouponStatistics).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listAvailableCoupons - 应返回可用优惠券", async () => {
    (couponService.listAvailableCoupons as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listAvailableCoupons(req as any, res as any, vi.fn());
    expect(couponService.listAvailableCoupons).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("claimCoupon - 应领取优惠券", async () => {
    (couponService.claimCoupon as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { templateId: 1 },
      user: { id: 1 },
    });
    const res = mockRes();
    await claimCoupon(req as any, res as any, vi.fn());
    expect(couponService.claimCoupon).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("claimCoupon - 缺少用户ID应返回错误", async () => {
    const req = mockReq({
      params: { templateId: 1 },
      user: undefined,
    });
    const res = mockRes();
    await claimCoupon(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("缺少用户ID", "400");
  });

  it("listMyCoupons - 应返回我的优惠券", async () => {
    (couponService.listMyCoupons as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      user: { id: 1 },
      query: { page: 1, pageSize: 20 },
    });
    const res = mockRes();
    await listMyCoupons(req as any, res as any, vi.fn());
    expect(couponService.listMyCoupons).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listMyCoupons - 缺少用户ID应返回错误", async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    await listMyCoupons(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("缺少用户ID", "400");
  });
});