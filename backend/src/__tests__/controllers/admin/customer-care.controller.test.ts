import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  listCareRules: vi.fn(),
  createCareRule: vi.fn(),
  updateCareRule: vi.fn(),
  deleteCareRule: vi.fn(),
  listCareLogs: vi.fn(),
  executeCareRule: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/customer-care.service", () => ({
  listCareRules: mocks.listCareRules,
  createCareRule: mocks.createCareRule,
  updateCareRule: mocks.updateCareRule,
  deleteCareRule: mocks.deleteCareRule,
  listCareLogs: mocks.listCareLogs,
  executeCareRule: mocks.executeCareRule,
}));

import {
  listCareRules,
  createCareRule,
  updateCareRule,
  deleteCareRule,
  listCareLogs,
  executeCareRule,
} from "../../../controllers/admin/customer-care.controller";

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

describe("admin customer-care.controller", () => {
  describe("关怀规则", () => {
    it("listCareRules - 应返回关怀规则列表", async () => {
      mocks.listCareRules.mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await listCareRules(req, res, vi.fn());
      expect(mocks.listCareRules).toHaveBeenCalledWith("t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("createCareRule - 应创建关怀规则", async () => {
      const body = { ruleName: "生日关怀", triggerType: "BIRTHDAY", templateContent: "生日快乐！", rewardPoints: 100, rewardCouponId: 1 };
      mocks.createCareRule.mockResolvedValue({ id: 1 });
      const req = mockReq({ body });
      const res = mockRes();
      await createCareRule(req, res, vi.fn());
      expect(mocks.createCareRule).toHaveBeenCalledWith(
        expect.objectContaining({ ruleName: "生日关怀", triggerType: "BIRTHDAY", tenantId: "t1" })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("createCareRule - 缺少必填字段时 zod 校验抛错", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await expect(createCareRule(req, res, vi.fn())).rejects.toThrow();
      expect(mocks.createCareRule).not.toHaveBeenCalled();
    });

    it("updateCareRule - 应更新关怀规则", async () => {
      const body = { ruleName: "新名称", enabled: 1 };
      mocks.updateCareRule.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body });
      const res = mockRes();
      await updateCareRule(req, res, vi.fn());
      expect(mocks.updateCareRule).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ ruleName: "新名称", enabled: 1, tenantId: "t1" })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("updateCareRule - 空 body 也可以（所有字段可选）", async () => {
      mocks.updateCareRule.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" }, body: {} });
      const res = mockRes();
      await updateCareRule(req, res, vi.fn());
      expect(mocks.updateCareRule).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it("deleteCareRule - 应删除关怀规则", async () => {
      mocks.deleteCareRule.mockResolvedValue({ id: 1 });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await deleteCareRule(req, res, vi.fn());
      expect(mocks.deleteCareRule).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });

    it("executeCareRule - 应执行关怀规则", async () => {
      mocks.executeCareRule.mockResolvedValue({ affected: 10 });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await executeCareRule(req, res, vi.fn());
      expect(mocks.executeCareRule).toHaveBeenCalledWith(1, "t1");
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("关怀日志", () => {
    it("listCareLogs - 应返回关怀日志列表", async () => {
      mocks.listCareLogs.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq({ query: { customerId: "1", page: "1", pageSize: "10" } });
      const res = mockRes();
      await listCareLogs(req, res, vi.fn());
      expect(mocks.listCareLogs).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 1, page: 1, pageSize: 10, tenantId: "t1" })
      );
      expect(res.json).toHaveBeenCalled();
    });

    it("listCareLogs - 使用默认分页参数，customerId 可选", async () => {
      mocks.listCareLogs.mockResolvedValue({ records: [], total: 0 });
      const req = mockReq();
      const res = mockRes();
      await listCareLogs(req, res, vi.fn());
      expect(mocks.listCareLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
    });
  });
});
