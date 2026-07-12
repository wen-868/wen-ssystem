import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/order-timeout.service.js", () => ({
  getConfigs: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  deleteConfig: vi.fn(),
  getLogs: vi.fn(),
  getStatistics: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as orderTimeoutService from "../../../services/admin/order-timeout.service.js";
import { ok } from "../../../shared/response.js";
import {
  listConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  listLogs,
  getStatistics,
} from "../../../controllers/order-timeout.controller.js";

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

describe("order-timeout.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listConfigs - 应返回超时配置列表", async () => {
    (orderTimeoutService.getConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listConfigs(req as any, res as any);
    expect(orderTimeoutService.getConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createConfig - 应创建超时配置", async () => {
    (orderTimeoutService.createConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        orderType: "MINIAPP",
        timeoutType: "PAYMENT",
        timeoutMinutes: 30,
        action: "CANCEL",
        enabled: true,
      },
    });
    const res = mockRes();
    await createConfig(req as any, res as any);
    expect(orderTimeoutService.createConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateConfig - 应更新超时配置", async () => {
    (orderTimeoutService.updateConfig as any).mockResolvedValue({ success: true });
    const req = mockReq({
      params: { id: 1 },
      body: {
        timeoutMinutes: 60,
        enabled: false,
      },
    });
    const res = mockRes();
    await updateConfig(req as any, res as any);
    expect(orderTimeoutService.updateConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("deleteConfig - 应删除超时配置", async () => {
    (orderTimeoutService.deleteConfig as any).mockResolvedValue(undefined);
    const req = mockReq({ params: { id: 1 } });
    const res = mockRes();
    await deleteConfig(req as any, res as any);
    expect(orderTimeoutService.deleteConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listLogs - 应返回超时处理日志", async () => {
    (orderTimeoutService.getLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listLogs(req as any, res as any);
    expect(orderTimeoutService.getLogs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getStatistics - 应返回超时统计", async () => {
    (orderTimeoutService.getStatistics as any).mockResolvedValue({ total: 0 });
    const req = mockReq();
    const res = mockRes();
    await getStatistics(req as any, res as any);
    expect(orderTimeoutService.getStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });
});