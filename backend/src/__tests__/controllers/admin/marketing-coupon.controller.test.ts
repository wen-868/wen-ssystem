/**
 * 管理端优惠券 controller 单元测试
 * 被测文件：src/controllers/admin/marketing-coupon.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
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

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-coupon.service.js", () => ({
  createCouponTemplate: mocks.createCouponTemplate,
  listCouponTemplates: mocks.listCouponTemplates,
  getCouponTemplate: mocks.getCouponTemplate,
  updateCouponTemplate: mocks.updateCouponTemplate,
  deleteCouponTemplate: mocks.deleteCouponTemplate,
  activateCouponTemplate: mocks.activateCouponTemplate,
  pauseCouponTemplate: mocks.pauseCouponTemplate,
  listUserCoupons: mocks.listUserCoupons,
  getCouponStatistics: mocks.getCouponStatistics,
  listAvailableCoupons: mocks.listAvailableCoupons,
  claimCoupon: mocks.claimCoupon,
  listMyCoupons: mocks.listMyCoupons,
}));

import {
  createCouponTemplate,
  listCouponTemplates,
  getCouponTemplate,
  deleteCouponTemplate,
  activateCouponTemplate,
  claimCoupon,
  listMyCoupons,
  getCouponStatistics,
} from "../../../controllers/admin/marketing-coupon.controller.js";

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

describe("admin marketing-coupon.controller", () => {
  it("createCouponTemplate 成功创建优惠券模板", async () => {
    const body = {
      name: "满100减20",
      type: "FIXED",
      value: 20,
      startTime: "2026-07-01",
      endTime: "2026-12-31",
    };
    mocks.createCouponTemplate.mockResolvedValue({ id: 1, name: "满100减20" });
    const req = mockReq({ body });
    const res = mockRes();
    await createCouponTemplate(req, res);
    expect(mocks.createCouponTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: "满100减20" }), "t1");
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1, name: "满100减20" });
    expect(res.json).toHaveBeenCalledWith({ code: "0", data: { id: 1, name: "满100减20" } });
  });

  it("createCouponTemplate 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: { type: "FIXED", value: 20 } });
    const res = mockRes();
    await expect(createCouponTemplate(req, res)).rejects.toThrow();
    expect(mocks.createCouponTemplate).not.toHaveBeenCalled();
  });

  it("listCouponTemplates 正确传递分页与过滤参数", async () => {
    mocks.listCouponTemplates.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { page: "2", pageSize: "10", status: "ACTIVE", type: "FIXED", keyword: "满" } });
    const res = mockRes();
    await listCouponTemplates(req, res);
    expect(mocks.listCouponTemplates).toHaveBeenCalledWith(2, 10, "t1", "ACTIVE", "FIXED", "满");
    expect(res.json).toHaveBeenCalled();
  });

  it("getCouponTemplate 根据 params.id 调用 service", async () => {
    mocks.getCouponTemplate.mockResolvedValue({ id: 5 });
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();
    await getCouponTemplate(req, res);
    expect(mocks.getCouponTemplate).toHaveBeenCalledWith(5, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("deleteCouponTemplate 成功删除", async () => {
    mocks.deleteCouponTemplate.mockResolvedValue({ id: 3 });
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();
    await deleteCouponTemplate(req, res);
    expect(mocks.deleteCouponTemplate).toHaveBeenCalledWith(3, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("activateCouponTemplate 激活模板", async () => {
    mocks.activateCouponTemplate.mockResolvedValue({ id: 7, status: "ACTIVE" });
    const req = mockReq({ params: { id: "7" } });
    const res = mockRes();
    await activateCouponTemplate(req, res);
    expect(mocks.activateCouponTemplate).toHaveBeenCalledWith(7, "t1");
  });

  it("claimCoupon 成功领取（userId 来自 req.user.id）", async () => {
    mocks.claimCoupon.mockResolvedValue({ id: 99 });
    const req = mockReq({ params: { templateId: "12" } });
    const res = mockRes();
    await claimCoupon(req, res);
    expect(mocks.claimCoupon).toHaveBeenCalledWith(12, 1, "t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("claimCoupon 缺少 userId 时返回 400", async () => {
    const req = mockReq({ params: { templateId: "12" }, user: {} });
    const res = mockRes();
    await claimCoupon(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.fail).toHaveBeenCalledWith("缺少用户ID", "400");
    expect(mocks.claimCoupon).not.toHaveBeenCalled();
  });

  it("listMyCoupons 缺少 userId 时返回 400", async () => {
    const req = mockReq({ user: {} });
    const res = mockRes();
    await listMyCoupons(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.fail).toHaveBeenCalledWith("缺少用户ID", "400");
  });

  it("getCouponStatistics 返回统计数据", async () => {
    mocks.getCouponStatistics.mockResolvedValue({ total: 10, claimed: 5 });
    const req = mockReq();
    const res = mockRes();
    await getCouponStatistics(req, res);
    expect(mocks.getCouponStatistics).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalled();
  });
});
