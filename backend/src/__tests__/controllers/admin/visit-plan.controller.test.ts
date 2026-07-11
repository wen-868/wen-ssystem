import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/visit-plan.service.js", () => ({
  createVisitPlanSchema: { parse: (v: any) => v },
  updateVisitPlanSchema: { parse: (v: any) => v },
  createVisitPlan: vi.fn(),
  updateVisitPlan: vi.fn(),
  cancelVisitPlan: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as visitPlanService from "../../../services/admin/visit-plan.service.js";
import { ok } from "../../../shared/response.js";
import {
  createVisitPlan,
  updateVisitPlan,
  cancelVisitPlan,
} from "../../../controllers/admin/visit-plan.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", realName: "管理员" },
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

describe("visit-plan.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createVisitPlan - 应创建拜访计划", async () => {
    (visitPlanService.createVisitPlan as any).mockResolvedValue({ visitNo: "VP123" });
    const req = mockReq({ body: { customerId: 1, planDate: "2026-01-01" } });
    const res = mockRes();
    await createVisitPlan(req as any, res as any);
    expect(visitPlanService.createVisitPlan).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateVisitPlan - 应更新拜访计划", async () => {
    (visitPlanService.updateVisitPlan as any).mockResolvedValue({ visitNo: "VP123" });
    const req = mockReq({ params: { visitNo: "VP123" }, body: { planDate: "2026-01-02" } });
    const res = mockRes();
    await updateVisitPlan(req as any, res as any);
    expect(visitPlanService.updateVisitPlan).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("cancelVisitPlan - 应取消拜访计划", async () => {
    (visitPlanService.cancelVisitPlan as any).mockResolvedValue({ visitNo: "VP123" });
    const req = mockReq({ params: { visitNo: "VP123" } });
    const res = mockRes();
    await cancelVisitPlan(req as any, res as any);
    expect(visitPlanService.cancelVisitPlan).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
