import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/miniapp-config.service", () => ({
  MiniappConfigService: {
    listConfigs: vi.fn(),
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    generatePackage: vi.fn(),
    getPackageFile: vi.fn(),
    listPublishLogs: vi.fn(),
  },
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

import { MiniappConfigService } from "../../../services/admin/miniapp-config.service";
import { ok } from "../../../shared/response";
import {
  listConfigs,
  getConfig,
  saveConfig,
  listTemplates,
  getTemplate,
  generatePackage,
  downloadPackage,
  listPublishLogs,
} from "../../../controllers/admin/miniapp-config.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", name: "管理员" },
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

describe("miniapp-config.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listConfigs - 应返回小程序配置列表", async () => {
    (MiniappConfigService.listConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listConfigs(req as any, res as any, vi.fn());
    expect(MiniappConfigService.listConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getConfig - 应返回指定平台配置", async () => {
    (MiniappConfigService.getConfig as any).mockResolvedValue({});
    const req = mockReq({ params: { platform: "wechat" } });
    const res = mockRes();
    await getConfig(req as any, res as any, vi.fn());
    expect(MiniappConfigService.getConfig).toHaveBeenCalledWith("t1", "wechat");
    expect(ok).toHaveBeenCalled();
  });

  it("saveConfig - 应保存小程序配置", async () => {
    (MiniappConfigService.saveConfig as any).mockResolvedValue({});
    const req = mockReq({ params: { platform: "wechat" }, body: { appId: "app123", appSecret: "secret" } });
    const res = mockRes();
    await saveConfig(req as any, res as any, vi.fn());
    expect(MiniappConfigService.saveConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listTemplates - 应返回模板列表", async () => {
    (MiniappConfigService.listTemplates as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listTemplates(req as any, res as any, vi.fn());
    expect(MiniappConfigService.listTemplates).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getTemplate - 应返回模板详情", async () => {
    (MiniappConfigService.getTemplate as any).mockResolvedValue({ id: 1 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await getTemplate(req as any, res as any, vi.fn());
    expect(MiniappConfigService.getTemplate).toHaveBeenCalledWith("t1", 1);
    expect(ok).toHaveBeenCalled();
  });

  it("generatePackage - 应生成代码包", async () => {
    (MiniappConfigService.generatePackage as any).mockResolvedValue({ id: 1, fileName: "a.zip", downloadUrl: "/api/miniapp-config/packages/1/download" });
    const req = mockReq({ body: { platform: "wechat", templateId: 1, appId: "wx123", appName: "测试商城", version: "1.0.0" } });
    const res = mockRes();
    await generatePackage(req as any, res as any, vi.fn());
    expect(MiniappConfigService.generatePackage).toHaveBeenCalledWith("t1", expect.objectContaining({ platform: "wechat", templateId: 1 }));
    expect(ok).toHaveBeenCalled();
  });

  it("downloadPackage - 应返回代码包文件", async () => {
    (MiniappConfigService.getPackageFile as any).mockResolvedValue({ filePath: "D:/tmp/a.zip", fileName: "a.zip" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    res.download = vi.fn();
    await downloadPackage(req as any, res as any, vi.fn());
    expect(MiniappConfigService.getPackageFile).toHaveBeenCalledWith("t1", 1);
    expect(res.download).toHaveBeenCalledWith("D:/tmp/a.zip", "a.zip");
  });

  it("downloadPackage - ID 无效时应返回错误", async () => {
    const req = mockReq({ params: { id: "abc" } });
    const res = mockRes();
    await downloadPackage(req as any, res as any, vi.fn());
    expect(MiniappConfigService.getPackageFile).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it("listPublishLogs - 应返回发布日志列表", async () => {
    (MiniappConfigService.listPublishLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listPublishLogs(req as any, res as any, vi.fn());
    expect(MiniappConfigService.listPublishLogs).toHaveBeenCalledWith("t1", 1, 20);
    expect(ok).toHaveBeenCalled();
  });
});
