/**
 * 管理端提成管理 controller 单元测试
 * 被测文件：src/controllers/admin/commission.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  listCommissionRules: vi.fn(),
  createCommissionRule: vi.fn(),
  updateCommissionRule: vi.fn(),
  deleteCommissionRule: vi.fn(),
  calculateCommissions: vi.fn(),
  settleCommissions: vi.fn(),
  listCommissionRecords: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/commission.service", () => ({
  listCommissionRules: mocks.listCommissionRules,
  createCommissionRule: mocks.createCommissionRule,
  updateCommissionRule: mocks.updateCommissionRule,
  deleteCommissionRule: mocks.deleteCommissionRule,
  calculateCommissions: mocks.calculateCommissions,
  settleCommissions: mocks.settleCommissions,
  listCommissionRecords: mocks.listCommissionRecords,
}));

import {
  listCommissionRules,
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
  calculateCommissions,
  settleCommissions,
  listCommissionRecords,
} from "../../../controllers/admin/commission.controller";

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

describe("admin commission.controller", () => {
  it("listCommissionRules 调用 service 并返回结果", async () => {
    mocks.listCommissionRules.mockResolvedValue([{ id: 1, ruleName: "规则A" }]);
    const req = mockReq();
    const res = mockRes();
    await listCommissionRules(req, res, vi.fn());
    expect(mocks.listCommissionRules).toHaveBeenCalledWith("t1");
    expect(mocks.ok).toHaveBeenCalledWith([{ id: 1, ruleName: "规则A" }]);
  });

  it("createCommissionRule 成功创建规则", async () => {
    mocks.createCommissionRule.mockResolvedValue({ id: 10 });
    const req = mockReq({
      body: { ruleName: "提成规则", ruleType: "FIXED", config: { amount: 100 }, remark: "备注" },
    });
    const res = mockRes();
    await createCommissionRule(req, res, vi.fn());
    expect(mocks.createCommissionRule).toHaveBeenCalledWith(expect.objectContaining({
      ruleName: "提成规则", ruleType: "FIXED", tenantId: "t1",
    }));
    expect(mocks.ok).toHaveBeenCalledWith({ id: 10 });
  });

  it("createCommissionRule 支持 RATIO 类型", async () => {
    mocks.createCommissionRule.mockResolvedValue({ id: 11 });
    const req = mockReq({
      body: { ruleName: "比率规则", ruleType: "RATIO", config: { rate: 0.1 } },
    });
    const res = mockRes();
    await createCommissionRule(req, res, vi.fn());
    expect(mocks.createCommissionRule).toHaveBeenCalledWith(expect.objectContaining({
      ruleType: "RATIO",
    }));
  });

  it("updateCommissionRule 传入 id 转换为数字", async () => {
    mocks.updateCommissionRule.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "5" }, body: { ruleName: "新名称", status: "INACTIVE" } });
    const res = mockRes();
    await updateCommissionRule(req, res, vi.fn());
    expect(mocks.updateCommissionRule).toHaveBeenCalledWith(5, expect.objectContaining({
      ruleName: "新名称", status: "INACTIVE", tenantId: "t1",
    }));
  });

  it("deleteCommissionRule 传入 id 转换为数字", async () => {
    mocks.deleteCommissionRule.mockResolvedValue({ success: true });
    const req = mockReq({ params: { id: "8" } });
    const res = mockRes();
    await deleteCommissionRule(req, res, vi.fn());
    expect(mocks.deleteCommissionRule).toHaveBeenCalledWith(8, "t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { success: true } });
  });

  it("calculateCommissions 传入日期范围", async () => {
    mocks.calculateCommissions.mockResolvedValue({ total: 5000 });
    const req = mockReq({ body: { startDate: "2026-01-01", endDate: "2026-01-31" } });
    const res = mockRes();
    await calculateCommissions(req, res, vi.fn());
    expect(mocks.calculateCommissions).toHaveBeenCalledWith({
      startDate: "2026-01-01", endDate: "2026-01-31", tenantId: "t1",
    });
    expect(mocks.ok).toHaveBeenCalledWith({ total: 5000 });
  });

  it("settleCommissions 传入 recordNos 数组", async () => {
    mocks.settleCommissions.mockResolvedValue({ settled: 3 });
    const req = mockReq({ body: { recordNos: ["R001", "R002", "R003"] } });
    const res = mockRes();
    await settleCommissions(req, res, vi.fn());
    expect(mocks.settleCommissions).toHaveBeenCalledWith({
      recordNos: ["R001", "R002", "R003"], tenantId: "t1",
    });
    expect(mocks.ok).toHaveBeenCalledWith({ settled: 3 });
  });

  it("listCommissionRecords 默认分页参数", async () => {
    mocks.listCommissionRecords.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await listCommissionRecords(req, res, vi.fn());
    expect(mocks.listCommissionRecords).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 20, staffId: undefined, status: undefined, tenantId: "t1",
    }));
  });

  it("listCommissionRecords 传入 staffId 转换为数字", async () => {
    mocks.listCommissionRecords.mockResolvedValue({ list: [], total: 0 });
    const req = mockReq({ query: { staffId: "5", status: "SETTLED", page: "2", pageSize: "10" } });
    const res = mockRes();
    await listCommissionRecords(req, res, vi.fn());
    expect(mocks.listCommissionRecords).toHaveBeenCalledWith(expect.objectContaining({
      staffId: 5, status: "SETTLED", page: 2, pageSize: 10,
    }));
  });
});
