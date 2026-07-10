/**
 * 管理端订阅套餐 controller 单元测试
 * 被测文件：src/controllers/admin/subscription-plan.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/subscription-plan.service.js", () => ({
  listPlans: mocks.listPlans,
  getPlan: mocks.getPlan,
  createPlan: mocks.createPlan,
  updatePlan: mocks.updatePlan,
}));

import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
} from "../../../controllers/admin/subscription-plan.controller.js";

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

describe("admin subscription-plan.controller", () => {
  it("listPlans 传递 status 查询参数", async () => {
    mocks.listPlans.mockResolvedValue([{ id: 1, planName: "基础版" }]);
    const req = mockReq({ query: { status: "ACTIVE" } });
    const res = mockRes();
    await listPlans(req, res);
    expect(mocks.listPlans).toHaveBeenCalledWith("ACTIVE");
    expect(res.json).toHaveBeenCalled();
  });

  it("listPlans status 缺失时传 undefined", async () => {
    mocks.listPlans.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listPlans(req, res);
    expect(mocks.listPlans).toHaveBeenCalledWith(undefined);
  });

  it("getPlan 套餐存在时返回 ok", async () => {
    mocks.getPlan.mockResolvedValue({ id: 1, planName: "标准版", price: 99 });
    const req = mockReq({ params: { planId: "1" } });
    const res = mockRes();
    await getPlan(req, res);
    expect(mocks.getPlan).toHaveBeenCalledWith(1);
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1, planName: "标准版", price: 99 });
  });

  it("getPlan 套餐不存在时回 404", async () => {
    mocks.getPlan.mockResolvedValue(null);
    const req = mockReq({ params: { planId: "999" } });
    const res = mockRes();
    await getPlan(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.fail).toHaveBeenCalledWith("套餐不存在", "404");
  });

  it("createPlan 成功创建套餐", async () => {
    mocks.createPlan.mockResolvedValue({ id: 1, planCode: "BASIC" });
    const req = mockReq({
      body: {
        planCode: "BASIC",
        planName: "基础版",
        planType: "MONTHLY",
        price: 99,
        durationDays: 30,
      },
    });
    const res = mockRes();
    await createPlan(req, res);
    expect(mocks.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      planCode: "BASIC",
      planName: "基础版",
      planType: "MONTHLY",
      price: 99,
    }));
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1, planCode: "BASIC" });
  });

  it("createPlan 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: { planName: "无编码" } });
    const res = mockRes();
    await expect(createPlan(req, res)).rejects.toThrow();
    expect(mocks.createPlan).not.toHaveBeenCalled();
  });

  it("updatePlan 成功时返回 ok", async () => {
    mocks.updatePlan.mockResolvedValue({ id: 1, planName: "升级版" });
    const req = mockReq({ params: { planId: "1" }, body: { planName: "升级版", price: 199 } });
    const res = mockRes();
    await updatePlan(req, res);
    expect(mocks.updatePlan).toHaveBeenCalledWith(1, expect.objectContaining({ planName: "升级版", price: 199 }));
    expect(mocks.ok).toHaveBeenCalledWith({ id: 1, planName: "升级版" });
  });

  it("updatePlan 套餐不存在时回 404", async () => {
    mocks.updatePlan.mockResolvedValue(null);
    const req = mockReq({ params: { planId: "999" }, body: { planName: "不存在" } });
    const res = mockRes();
    await updatePlan(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.fail).toHaveBeenCalledWith("套餐不存在", "404");
  });
});
