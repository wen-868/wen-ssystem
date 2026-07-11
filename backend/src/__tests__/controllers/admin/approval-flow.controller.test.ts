import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/approval-flow.service.js", () => ({
  listRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as approvalFlowService from "../../../services/admin/approval-flow.service.js";
import { ok, fail } from "../../../shared/response.js";
import {
  listRules,
  createRule,
  updateRule,
} from "../../../controllers/admin/approval-flow.controller.js";

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

describe("approval-flow.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listRules - 应返回审批规则列表", async () => {
    (approvalFlowService.listRules as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listRules(req as any, res as any);
    expect(approvalFlowService.listRules).toHaveBeenCalledWith(1, 20, null, null, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listRules - 应传递筛选参数", async () => {
    (approvalFlowService.listRules as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({
      query: { page: "2", pageSize: "10", businessType: "PURCHASE_ORDER", status: "1" },
    });
    const res = mockRes();
    await listRules(req as any, res as any);
    expect(approvalFlowService.listRules).toHaveBeenCalledWith(2, 10, "PURCHASE_ORDER", 1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createRule - 应创建审批规则", async () => {
    (approvalFlowService.createRule as any).mockResolvedValue({ id: 1, ruleName: "采购审批" });
    const req = mockReq({
      body: {
        ruleName: "采购审批",
        businessType: "PURCHASE_ORDER",
        triggerCondition: { amount: 10000 },
        approvalChain: [
          { level: 1, approverType: "ROLE", approverValue: "manager" },
          { level: 2, approverType: "USER", approverValue: "boss" },
        ],
        slaHours: 24,
        escalationLevel: 1,
      },
    });
    const res = mockRes();
    await createRule(req as any, res as any);
    expect(approvalFlowService.createRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createRule - 参数校验失败应抛错", async () => {
    const req = mockReq({ body: { ruleName: "", businessType: "INVALID" } });
    const res = mockRes();
    await expect(createRule(req as any, res as any)).rejects.toThrow();
    expect(approvalFlowService.createRule).not.toHaveBeenCalled();
  });

  it("updateRule - 应更新审批规则", async () => {
    (approvalFlowService.updateRule as any).mockResolvedValue({ id: 1, ruleName: "更新后的规则" });
    const req = mockReq({
      params: { id: "1" },
      body: {
        ruleName: "更新后的规则",
        slaHours: 48,
        status: 0,
      },
    });
    const res = mockRes();
    await updateRule(req as any, res as any);
    expect(approvalFlowService.updateRule).toHaveBeenCalledWith(1, expect.any(Object), "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateRule - 规则不存在应返回404", async () => {
    (approvalFlowService.updateRule as any).mockResolvedValue(null);
    const req = mockReq({
      params: { id: "999" },
      body: { ruleName: "测试" },
    });
    const res = mockRes();
    await updateRule(req as any, res as any);
    expect(fail).toHaveBeenCalledWith("规则不存在", "404");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updateRule - 参数校验失败应抛错", async () => {
    const req = mockReq({ params: { id: "1" }, body: { slaHours: 0 } });
    const res = mockRes();
    await expect(updateRule(req as any, res as any)).rejects.toThrow();
    expect(approvalFlowService.updateRule).not.toHaveBeenCalled();
  });
});
