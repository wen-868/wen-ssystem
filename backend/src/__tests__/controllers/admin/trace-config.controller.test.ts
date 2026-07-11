import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/trace-config.service.js", () => ({
  listConfigs: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  deleteConfig: vi.fn(),
  checkSkuTrace: vi.fn(),
}));

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as traceConfigService from "../../../services/admin/trace-config.service.js";
import { ok, fail } from "../../../shared/response.js";
import {
  listConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  checkSkuTrace,
} from "../../../controllers/admin/trace-config.controller.js";

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

describe("trace-config.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listConfigs - 应返回追溯配置列表", async () => {
    (traceConfigService.listConfigs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listConfigs(req as any, res as any);
    expect(traceConfigService.listConfigs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listConfigs - 应支持筛选参数", async () => {
    (traceConfigService.listConfigs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20, configLevel: "SKU", traceEnabled: "1" } });
    const res = mockRes();
    await listConfigs(req as any, res as any);
    expect(traceConfigService.listConfigs).toHaveBeenCalledWith(1, 20, "SKU", 1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("createConfig - 应创建追溯配置", async () => {
    (traceConfigService.createConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { configLevel: "SKU", targetId: 1 } });
    const res = mockRes();
    await createConfig(req as any, res as any);
    expect(traceConfigService.createConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateConfig - 应更新追溯配置", async () => {
    (traceConfigService.updateConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" }, body: { traceEnabled: 1 } });
    const res = mockRes();
    await updateConfig(req as any, res as any);
    expect(traceConfigService.updateConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("updateConfig - 配置不存在应返回404", async () => {
    (traceConfigService.updateConfig as any).mockResolvedValue(null);
    const req = mockReq({ params: { id: "999" }, body: { traceEnabled: 1 } });
    const res = mockRes();
    await updateConfig(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("配置不存在", "404");
  });

  it("deleteConfig - 应删除追溯配置", async () => {
    (traceConfigService.deleteConfig as any).mockResolvedValue(true);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await deleteConfig(req as any, res as any);
    expect(traceConfigService.deleteConfig).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalledWith({ deleted: true });
  });

  it("deleteConfig - 配置不存在应返回404", async () => {
    (traceConfigService.deleteConfig as any).mockResolvedValue(false);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await deleteConfig(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("配置不存在", "404");
  });

  it("checkSkuTrace - 应检查SKU追溯配置", async () => {
    (traceConfigService.checkSkuTrace as any).mockResolvedValue({ enabled: true });
    const req = mockReq({ body: { skuId: 1, categoryId: 10 } });
    const res = mockRes();
    await checkSkuTrace(req as any, res as any);
    expect(traceConfigService.checkSkuTrace).toHaveBeenCalledWith(1, 10, "t1");
    expect(ok).toHaveBeenCalled();
  });
});
