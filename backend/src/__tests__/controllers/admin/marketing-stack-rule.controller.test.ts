import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/marketing-stack-rule.service", () => ({
  createStackRule: vi.fn(),
  listStackRules: vi.fn(),
  updateStackRule: vi.fn(),
  deleteStackRule: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as stackRuleService from "../../../services/admin/marketing-stack-rule.service";
import { ok } from "../../../shared/response";
import {
  createStackRule,
  listStackRules,
  updateStackRule,
  deleteStackRule,
} from "../../../controllers/admin/marketing-stack-rule.controller";

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

describe("marketing-stack-rule.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createStackRule - 应创建叠加规则", async () => {
    (stackRuleService.createStackRule as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        name: "优惠券+满减",
        typeCombination: [["COUPON", "FULL_REDUCTION"]],
      },
    });
    const res = mockRes();
    await createStackRule(req as any, res as any);
    expect(stackRuleService.createStackRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalledWith({ id: 1 });
  });

  it("createStackRule - 缺少必填字段应抛出错误", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(createStackRule(req as any, res as any)).rejects.toThrow();
  });

  it("createStackRule - typeCombination为空应抛出错误", async () => {
    const req = mockReq({
      body: {
        name: "叠加规则",
        typeCombination: [],
      },
    });
    const res = mockRes();
    await expect(createStackRule(req as any, res as any)).rejects.toThrow();
  });

  it("listStackRules - 应返回叠加规则列表", async () => {
    (stackRuleService.listStackRules as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listStackRules(req as any, res as any);
    expect(stackRuleService.listStackRules).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateStackRule - 应更新叠加规则", async () => {
    (stackRuleService.updateStackRule as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      params: { id: 1 },
      body: { name: "更新名称" },
    });
    const res = mockRes();
    await updateStackRule(req as any, res as any);
    expect(stackRuleService.updateStackRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteStackRule - 应删除叠加规则", async () => {
    (stackRuleService.deleteStackRule as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteStackRule(req as any, res as any);
    expect(stackRuleService.deleteStackRule).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});