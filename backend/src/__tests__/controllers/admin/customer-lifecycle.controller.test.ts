import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ code: "0", data })),
  fail: vi.fn((msg: string, code = "400") => ({ code, msg })),
  getLifecycleStages: vi.fn(),
  getLifecycleTrend: vi.fn(),
  getLifecycleDetail: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/customer-lifecycle.service", () => ({
  getLifecycleStages: mocks.getLifecycleStages,
  getLifecycleTrend: mocks.getLifecycleTrend,
  getLifecycleDetail: mocks.getLifecycleDetail,
}));

import {
  getLifecycleStages,
  getLifecycleTrend,
  getLifecycleDetail,
} from "../../../controllers/admin/customer-lifecycle.controller";

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

describe("admin customer-lifecycle.controller", () => {
  it("getLifecycleStages - 应返回生命周期阶段列表", async () => {
    mocks.getLifecycleStages.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getLifecycleStages(req, res, vi.fn());
    expect(mocks.getLifecycleStages).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalled();
  });

  it("getLifecycleTrend - 应返回生命周期趋势", async () => {
    mocks.getLifecycleTrend.mockResolvedValue([]);
    const req = mockReq({ query: { months: "12" } });
    const res = mockRes();
    await getLifecycleTrend(req, res, vi.fn());
    expect(mocks.getLifecycleTrend).toHaveBeenCalledWith("t1", 12);
    expect(res.json).toHaveBeenCalled();
  });

  it("getLifecycleTrend - 使用默认 months=6", async () => {
    mocks.getLifecycleTrend.mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getLifecycleTrend(req, res, vi.fn());
    expect(mocks.getLifecycleTrend).toHaveBeenCalledWith("t1", 6);
  });

  it("getLifecycleDetail - 应返回生命周期详情（分页）", async () => {
    mocks.getLifecycleDetail.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq({ query: { stage: "ACTIVE", page: "1", pageSize: "10" } });
    const res = mockRes();
    await getLifecycleDetail(req, res, vi.fn());
    expect(mocks.getLifecycleDetail).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "ACTIVE", page: 1, pageSize: 10, tenantId: "t1" })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("getLifecycleDetail - 使用默认分页参数，stage 可选", async () => {
    mocks.getLifecycleDetail.mockResolvedValue({ records: [], total: 0 });
    const req = mockReq();
    const res = mockRes();
    await getLifecycleDetail(req, res, vi.fn());
    expect(mocks.getLifecycleDetail).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 })
    );
  });
});
