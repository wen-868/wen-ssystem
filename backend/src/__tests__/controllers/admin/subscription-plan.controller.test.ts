/**
 * 订阅套餐 controller 单元测试
 * 被测文件：src/controllers/admin/subscription-plan.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/admin/subscription-plan.service", () => ({
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  updatePlanFeatures: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as subscriptionPlanService from "../../../services/admin/subscription-plan.service";
import { ok, fail } from "../../../shared/response";
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  updatePlanFeatures,
} from "../../../controllers/admin/subscription-plan.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
  headers: {},
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

describe("admin/subscription-plan.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("listPlans", () => {
    it("返回套餐列表", async () => {
      (subscriptionPlanService.listPlans as any).mockResolvedValue([
        { id: 1, planName: "基础版", planCode: "basic" },
      ]);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await listPlans(req as any, res as any);
      expect(subscriptionPlanService.listPlans).toHaveBeenCalledWith(undefined);
      expect(ok).toHaveBeenCalled();
    });

    it("带 status 参数筛选", async () => {
      (subscriptionPlanService.listPlans as any).mockResolvedValue([]);
      const req = mockReq({ query: { status: "ACTIVE" } });
      const res = mockRes();
      await listPlans(req as any, res as any);
      expect(subscriptionPlanService.listPlans).toHaveBeenCalledWith("ACTIVE");
    });
  });

  describe("getPlan", () => {
    it("返回套餐详情", async () => {
      (subscriptionPlanService.getPlan as any).mockResolvedValue({
        id: 1, planName: "基础版", price: 99,
      });
      const req = mockReq({ params: { planId: "1" } });
      const res = mockRes();
      await getPlan(req as any, res as any);
      expect(ok).toHaveBeenCalled();
    });

    it("套餐不存在返回 404", async () => {
      (subscriptionPlanService.getPlan as any).mockResolvedValue(null);
      const req = mockReq({ params: { planId: "999" } });
      const res = mockRes();
      await getPlan(req as any, res as any);
      expect(fail).toHaveBeenCalledWith("套餐不存在", "404");
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("createPlan", () => {
    it("创建套餐成功", async () => {
      (subscriptionPlanService.createPlan as any).mockResolvedValue({ id: 1 });
      const req = mockReq({
        body: {
          planCode: "pro",
          planName: "专业版",
          planType: "MONTHLY",
          price: 199,
          durationDays: 30,
        },
      });
      const res = mockRes();
      await createPlan(req as any, res as any);
      expect(subscriptionPlanService.createPlan).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("使用默认值创建套餐", async () => {
      (subscriptionPlanService.createPlan as any).mockResolvedValue({ id: 2 });
      const req = mockReq({
        body: {
          planCode: "basic",
          planName: "基础版",
          planType: "YEARLY",
          price: 999,
          durationDays: 365,
        },
      });
      const res = mockRes();
      await createPlan(req as any, res as any);
      const callArg = (subscriptionPlanService.createPlan as any).mock.calls[0][0];
      expect(callArg.maxUsers).toBe(5);
      expect(callArg.maxStores).toBe(1);
      expect(callArg.status).toBe("ACTIVE");
    });
  });

  describe("updatePlan", () => {
    it("更新套餐成功", async () => {
      (subscriptionPlanService.updatePlan as any).mockResolvedValue({ id: 1, planName: "新名称" });
      const req = mockReq({
        params: { planId: "1" },
        body: { planName: "新名称", price: 299 },
      });
      const res = mockRes();
      await updatePlan(req as any, res as any);
      expect(subscriptionPlanService.updatePlan).toHaveBeenCalledWith(1, { planName: "新名称", price: 299 });
      expect(ok).toHaveBeenCalled();
    });

    it("套餐不存在返回 404", async () => {
      (subscriptionPlanService.updatePlan as any).mockResolvedValue(null);
      const req = mockReq({
        params: { planId: "999" },
        body: { planName: "不存在" },
      });
      const res = mockRes();
      await updatePlan(req as any, res as any);
      expect(fail).toHaveBeenCalledWith("套餐不存在", "404");
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("deletePlan", () => {
    it("删除套餐成功", async () => {
      (subscriptionPlanService.deletePlan as any).mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deletePlan(req as any, res as any);
      expect(ok).toHaveBeenCalled();
    });

    it("套餐不存在返回 404", async () => {
      (subscriptionPlanService.deletePlan as any).mockResolvedValue(null);
      const req = mockReq({ params: { id: "999" } });
      const res = mockRes();
      await deletePlan(req as any, res as any);
      expect(fail).toHaveBeenCalledWith("套餐不存在", "404");
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("updatePlanFeatures", () => {
    it("更新套餐功能成功", async () => {
      (subscriptionPlanService.updatePlanFeatures as any).mockResolvedValue({ id: 1 });
      const req = mockReq({
        params: { id: "1" },
        body: { features: ["feature1"], moduleAccess: { inventory: true } },
      });
      const res = mockRes();
      await updatePlanFeatures(req as any, res as any);
      expect(subscriptionPlanService.updatePlanFeatures).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("套餐不存在返回 404", async () => {
      (subscriptionPlanService.updatePlanFeatures as any).mockResolvedValue(null);
      const req = mockReq({
        params: { id: "999" },
        body: { features: [] },
      });
      const res = mockRes();
      await updatePlanFeatures(req as any, res as any);
      expect(fail).toHaveBeenCalledWith("套餐不存在", "404");
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
