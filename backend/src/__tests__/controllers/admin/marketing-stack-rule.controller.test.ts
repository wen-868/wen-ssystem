import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  createStackRule: vi.fn(),
  listStackRules: vi.fn(),
  updateStackRule: vi.fn(),
  deleteStackRule: vi.fn(),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response.js", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/marketing-stack-rule.service.js", () => ({
  createStackRule: mocks.createStackRule,
  listStackRules: mocks.listStackRules,
  updateStackRule: mocks.updateStackRule,
  deleteStackRule: mocks.deleteStackRule,
}));

import {
  createStackRule,
  listStackRules,
  updateStackRule,
  deleteStackRule,
} from "../../../controllers/admin/marketing-stack-rule.controller.js";

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

describe("admin marketing-stack-rule.controller", () => {
  it("createStackRule - 应创建叠加规则", async () => {
    const body = {
      name: "满减+折扣叠加",
      typeCombination: [["FULL_REDUCTION", "DISCOUNT"]],
      maxTotalDiscountRate: 0.8,
    };
    mocks.createStackRule.mockResolvedValue({ id: 1 });
    const req = mockReq({ body });
    const res = mockRes();
    await createStackRule(req, res);
    expect(mocks.createStackRule).toHaveBeenCalledWith(
      expect.objectContaining({ name: "满减+折扣叠加" }),
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("createStackRule - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ body: { name: "测试" } });
    const res = mockRes();
    await expect(createStackRule(req, res)).rejects.toThrow();
    expect(mocks.createStackRule).not.toHaveBeenCalled();
  });

  it("createStackRule - typeCombination 为空数组时 zod 校验抛错", async () => {
    const req = mockReq({ body: { name: "测试", typeCombination: [] } });
    const res = mockRes();
    await expect(createStackRule(req, res)).rejects.toThrow();
  });

  it("listStackRules - 应返回叠加规则列表", async () => {
    mocks.listStackRules.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listStackRules(req, res);
    expect(mocks.listStackRules).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("updateStackRule - 应更新叠加规则", async () => {
    const body = { name: "新规则名", enabled: false };
    mocks.updateStackRule.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body });
    const res = mockRes();
    await updateStackRule(req, res);
    expect(mocks.updateStackRule).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "新规则名", enabled: false }),
      "t1"
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("updateStackRule - 空 body 时（所有字段可选）", async () => {
    mocks.updateStackRule.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await updateStackRule(req, res);
    expect(mocks.updateStackRule).toHaveBeenCalled();
  });

  it("deleteStackRule - 应删除叠加规则", async () => {
    mocks.deleteStackRule.mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteStackRule(req, res);
    expect(mocks.deleteStackRule).toHaveBeenCalledWith(1, "t1");
    expect(res.json).toHaveBeenCalled();
  });
});
