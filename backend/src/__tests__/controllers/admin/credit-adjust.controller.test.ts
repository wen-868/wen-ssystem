import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  adjustLimit: vi.fn(),
  adjustTerm: vi.fn(),
  getOperationLogs: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/credit-adjust.service", () => ({
  creditAdjustService: {
    adjustLimit: mocks.adjustLimit,
    adjustTerm: mocks.adjustTerm,
    getOperationLogs: mocks.getOperationLogs,
  },
}));

import {
  adjustLimit,
  adjustTerm,
  getOperationLogs,
} from "../../../controllers/admin/credit-adjust.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", storeId: 1 },
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

describe("admin credit-adjust.controller", () => {
  it("adjustLimit - 应调整授信额度", async () => {
    const body = { creditLimit: 20000, reason: "资质提升" };
    mocks.adjustLimit.mockResolvedValue({ success: true });
    const req = mockReq({ params: { customerId: "1" }, body });
    const res = mockRes();
    await adjustLimit(req, res);
    expect(mocks.adjustLimit).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ creditLimit: 20000, reason: "资质提升" }),
      expect.objectContaining({ tenantId: "t1", userId: 1, username: "admin", storeId: 1 })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("adjustLimit - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ params: { customerId: "1" }, body: {} });
    const res = mockRes();
    await expect(adjustLimit(req, res)).rejects.toThrow();
    expect(mocks.adjustLimit).not.toHaveBeenCalled();
  });

  it("adjustTerm - 应调整账期", async () => {
    const body = { paymentTerm: "NET_60", reason: "账期调整" };
    mocks.adjustTerm.mockResolvedValue({ success: true });
    const req = mockReq({ params: { customerId: "1" }, body });
    const res = mockRes();
    await adjustTerm(req, res);
    expect(mocks.adjustTerm).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ paymentTerm: "NET_60", reason: "账期调整" }),
      expect.any(Object)
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("adjustTerm - 缺少必填字段时 zod 校验抛错", async () => {
    const req = mockReq({ params: { customerId: "1" }, body: {} });
    const res = mockRes();
    await expect(adjustTerm(req, res)).rejects.toThrow();
    expect(mocks.adjustTerm).not.toHaveBeenCalled();
  });

  it("getOperationLogs - 应返回操作日志列表", async () => {
    mocks.getOperationLogs.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ params: { customerId: "1" }, query: { page: "1", pageSize: "10" } });
    const res = mockRes();
    await getOperationLogs(req, res);
    expect(mocks.getOperationLogs).toHaveBeenCalledWith(1, 1, 10, expect.any(Object));
    expect(res.json).toHaveBeenCalled();
  });

  it("getOperationLogs - 使用默认分页参数", async () => {
    mocks.getOperationLogs.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ params: { customerId: "1" } });
    const res = mockRes();
    await getOperationLogs(req, res);
    expect(mocks.getOperationLogs).toHaveBeenCalledWith(1, 1, 20, expect.any(Object));
  });
});
