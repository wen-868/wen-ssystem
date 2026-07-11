import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/sys-config.service.js", () => ({
  getAllConfigs: vi.fn(),
  getConfigByGroup: vi.fn(),
  batchUpdateConfigs: vi.fn(),
  createConfig: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as sysConfigService from "../../services/admin/sys-config.service.js";
import { ok, fail } from "../../shared/response.js";
import {
  getAllConfigs,
  getConfigByGroup,
  batchUpdateConfigs,
  createConfig,
} from "../../controllers/sys-config.controller.js";

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

describe("sys-config.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllConfigs - 应返回所有系统配置", async () => {
    (sysConfigService.getAllConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getAllConfigs(req as any, res as any);
    expect(sysConfigService.getAllConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getConfigByGroup - 应返回分组配置", async () => {
    (sysConfigService.getConfigByGroup as any).mockResolvedValue([]);
    const req = mockReq({ params: { group: "system" } });
    const res = mockRes();
    await getConfigByGroup(req as any, res as any);
    expect(sysConfigService.getConfigByGroup).toHaveBeenCalledWith("system", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("batchUpdateConfigs - 应批量更新配置", async () => {
    (sysConfigService.batchUpdateConfigs as any).mockResolvedValue({ success: true });
    const req = mockReq({
      body: [
        { config_key: "site_name", config_value: "测试系统" },
        { config_key: "site_logo", config_value: "logo.png" },
      ],
    });
    const res = mockRes();
    await batchUpdateConfigs(req as any, res as any);
    expect(sysConfigService.batchUpdateConfigs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("createConfig - 应创建配置", async () => {
    (sysConfigService.createConfig as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: {
        config_key: "new_config",
        config_value: "value",
        config_group: "system",
        description: "新配置",
      },
    });
    const res = mockRes();
    await createConfig(req as any, res as any);
    expect(sysConfigService.createConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
