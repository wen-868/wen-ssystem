import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("@services/admin/sys-config.service", () => ({
  getAllConfigs: vi.fn(),
  getConfigByGroup: vi.fn(),
  batchUpdateConfigs: vi.fn(),
  createConfig: vi.fn(),
}));

vi.mock("@shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("@middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as sysConfigService from "@services/admin/sys-config.service";
import { ok } from "@shared/response";
import { getAllConfigs, getConfigByGroup, batchUpdateConfigs, createConfig } from "@controllers/admin/sys-config.controller";

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

describe("sys-config.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllConfigs - 应获取所有配置", async () => {
    (sysConfigService.getAllConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getAllConfigs(req as any, res as any);
    expect(sysConfigService.getAllConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getConfigByGroup - 应获取分组配置", async () => {
    (sysConfigService.getConfigByGroup as any).mockResolvedValue([]);
    const req = mockReq({ params: { group: "payment" } });
    const res = mockRes();
    await getConfigByGroup(req as any, res as any);
    expect(sysConfigService.getConfigByGroup).toHaveBeenCalledWith("payment", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getConfigByGroup - zod验证失败", async () => {
    const req = mockReq({ params: { group: "" } });
    const res = mockRes();
    await expect(getConfigByGroup(req as any, res as any)).rejects.toThrow();
  });

  it("batchUpdateConfigs - 应批量更新配置", async () => {
    (sysConfigService.batchUpdateConfigs as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: [{ config_key: "key1", config_value: "value1" }] });
    const res = mockRes();
    await batchUpdateConfigs(req as any, res as any);
    expect(sysConfigService.batchUpdateConfigs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("batchUpdateConfigs - zod验证失败", async () => {
    const req = mockReq({ body: [] });
    const res = mockRes();
    await expect(batchUpdateConfigs(req as any, res as any)).rejects.toThrow();
  });

  it("createConfig - 应创建配置", async () => {
    (sysConfigService.createConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ body: { config_key: "key1", config_group: "group1" } });
    const res = mockRes();
    await createConfig(req as any, res as any);
    expect(sysConfigService.createConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createConfig - zod验证失败", async () => {
    const req = mockReq({ body: { config_key: "", config_group: "" } });
    const res = mockRes();
    await expect(createConfig(req as any, res as any)).rejects.toThrow();
  });
});