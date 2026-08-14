/**
 * 管理端系统监控 controller 单元测试
 * 被测文件：src/controllers/admin/monitor.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ok: vi.fn((data?: any) => ({ success: true, data })),
  fail: vi.fn((msg: string, code?: any) => ({ success: false, message: msg, code })),
  getDbStatus: vi.fn(),
  getApiStats: vi.fn(),
  getExpiringTenants: vi.fn(),
  notifyExpiringTenants: vi.fn(),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

vi.mock("../../../shared/response", () => ({
  ok: mocks.ok,
  fail: mocks.fail,
}));

vi.mock("../../../services/admin/monitor.service", () => ({
  getDbStatus: mocks.getDbStatus,
  getApiStats: mocks.getApiStats,
  getExpiringTenants: mocks.getExpiringTenants,
  notifyExpiringTenants: mocks.notifyExpiringTenants,
}));

import {
  getDbStatusCtrl,
  getApiStatsCtrl,
  getExpiringTenantsCtrl,
  notifyExpiringTenantsCtrl,
} from "../../../controllers/admin/monitor.controller";

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

describe("admin monitor.controller", () => {
  it("getDbStatusCtrl 调用 service 并返回状态", async () => {
    mocks.getDbStatus.mockResolvedValue({ connected: true });
    const req = mockReq();
    const res = mockRes();
    await getDbStatusCtrl(req, res, vi.fn());
    expect(mocks.getDbStatus).toHaveBeenCalledTimes(1);
    expect(mocks.ok).toHaveBeenCalledWith({ connected: true });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { connected: true } });
  });

  it("getDbStatusCtrl 不依赖 req 参数", async () => {
    mocks.getDbStatus.mockResolvedValue({ connected: false });
    const req = mockReq();
    const res = mockRes();
    await getDbStatusCtrl(req, res, vi.fn());
    expect(mocks.getDbStatus).toHaveBeenCalledWith();
  });

  it("getApiStatsCtrl 调用 service 并返回统计", async () => {
    mocks.getApiStats.mockResolvedValue({ totalRequests: 100 });
    const req = mockReq();
    const res = mockRes();
    await getApiStatsCtrl(req, res, vi.fn());
    expect(mocks.getApiStats).toHaveBeenCalledTimes(1);
    expect(mocks.ok).toHaveBeenCalledWith({ totalRequests: 100 });
  });

  it("getExpiringTenantsCtrl 默认 days 为 7", async () => {
    mocks.getExpiringTenants.mockResolvedValue([{ id: 1, name: "租户A" }]);
    const req = mockReq();
    const res = mockRes();
    await getExpiringTenantsCtrl(req, res, vi.fn());
    expect(mocks.getExpiringTenants).toHaveBeenCalledWith(7);
  });

  it("getExpiringTenantsCtrl 传入自定义 days", async () => {
    mocks.getExpiringTenants.mockResolvedValue([]);
    const req = mockReq({ query: { days: "30" } });
    const res = mockRes();
    await getExpiringTenantsCtrl(req, res, vi.fn());
    expect(mocks.getExpiringTenants).toHaveBeenCalledWith(30);
  });

  it("notifyExpiringTenantsCtrl 传入 tenantIds", async () => {
    mocks.notifyExpiringTenants.mockResolvedValue(3);
    const req = mockReq({ body: { tenantIds: [1, 2, 3] } });
    const res = mockRes();
    await notifyExpiringTenantsCtrl(req, res, vi.fn());
    expect(mocks.notifyExpiringTenants).toHaveBeenCalledWith([1, 2, 3]);
    expect(mocks.ok).toHaveBeenCalledWith({ notifiedCount: 3 });
  });

  it("notifyExpiringTenantsCtrl 未传 tenantIds 时默认空数组", async () => {
    mocks.notifyExpiringTenants.mockResolvedValue(0);
    const req = mockReq({ body: {} });
    const res = mockRes();
    await notifyExpiringTenantsCtrl(req, res, vi.fn());
    expect(mocks.notifyExpiringTenants).toHaveBeenCalledWith([]);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { notifiedCount: 0 } });
  });

  it("getExpiringTenantsCtrl 调用 res.json 返回 ok 包装结果", async () => {
    mocks.getExpiringTenants.mockResolvedValue([{ id: 1 }]);
    const req = mockReq({ query: { days: "14" } });
    const res = mockRes();
    await getExpiringTenantsCtrl(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
  });

  it("getApiStatsCtrl 调用 res.json 返回 ok 包装结果", async () => {
    mocks.getApiStats.mockResolvedValue({ avgResponseTime: 50 });
    const req = mockReq();
    const res = mockRes();
    await getApiStatsCtrl(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { avgResponseTime: 50 } });
  });
});
