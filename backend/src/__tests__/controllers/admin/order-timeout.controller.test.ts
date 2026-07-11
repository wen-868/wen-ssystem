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

import * as service from "../../../services/admin/order-timeout.service.js";
import { ok, fail } from "../../../shared/response.js";
import {
  getConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  getLogs,
  getStatistics,
} from "../../../controllers/admin/order-timeout.controller.js";

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

describe("order-timeout.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getConfigs - 应返回超时配置列表", async () => {
    (service.getConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getConfigs(req as any, res as any);
    expect(service.getConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createConfig - 应创建超时配置", async () => {
    (service.createConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { orderType: "SALE", timeoutType: "PAYMENT", timeoutMinutes: 30, action: "CANCEL" } });
    const res = mockRes();
    await createConfig(req as any, res as any);
    expect(service.createConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateConfig - 应更新超时配置", async () => {
    (service.updateConfig as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: "1" }, body: { timeoutMinutes: 60 } });
    const res = mockRes();
    await updateConfig(req as any, res as any);
    expect(service.updateConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateConfig - 无更新字段应返回400", async () => {
    (service.updateConfig as any).mockResolvedValue(false);
    const req = mockReq({ params: { id: "1" }, body: { timeoutMinutes: 60 } });
    const res = mockRes();
    await updateConfig(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fail).toHaveBeenCalledWith("没有需要更新的字段", "400");
  });

  it("deleteConfig - 应删除超时配置", async () => {
    (service.deleteConfig as any).mockResolvedValue(undefined);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteConfig(req as any, res as any);
    expect(service.deleteConfig).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("getLogs - 应返回超时日志", async () => {
    (service.getLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await getLogs(req as any, res as any);
    expect(service.getLogs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getStatistics - 应返回统计数据", async () => {
    (service.getStatistics as any).mockResolvedValue({ total: 0 });
    const req = mockReq();
    const res = mockRes();
    await getStatistics(req as any, res as any);
    expect(service.getStatistics).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });
});
