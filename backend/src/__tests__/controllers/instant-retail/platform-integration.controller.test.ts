import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/instant-retail/platform-integration.service", () => ({
  handleWebhook: vi.fn(),
  getPlatforms: vi.fn(),
  getConfigs: vi.fn(),
  getConfigByPlatform: vi.fn(),
  upsertConfig: vi.fn(),
  testConnection: vi.fn(),
  syncOrders: vi.fn(),
  syncProducts: vi.fn(),
  deleteConfig: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as platformIntegrationService from "../../../services/instant-retail/platform-integration.service";
import { ok, fail } from "../../../shared/response";
import {
  handleJdWebhook, handleMeituanWebhook, handleElemeWebhook,
  getPlatforms, getConfigs, getConfigByPlatform, upsertConfig,
  testConnection, syncOrders, syncProducts, deleteConfig
} from "../../../controllers/instant-retail/platform-integration.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1 },
  headers: {},
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

describe("instant-retail/platform-integration.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("handleJdWebhook - 应处理京东 webhook", async () => {
    (platformIntegrationService.handleWebhook as any).mockResolvedValue({ status: 200, response: { code: 0 } });
    const req = mockReq({ body: { event: "order" }, headers: { "x-signature": "sig1", "x-timestamp": "123" } });
    const res = mockRes();
    await handleJdWebhook(req as any, res as any, vi.fn());
    expect(platformIntegrationService.handleWebhook).toHaveBeenCalledWith("JD", { event: "order" }, "sig1", "123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ code: 0 });
  });

  it("handleMeituanWebhook - 应处理美团 webhook", async () => {
    (platformIntegrationService.handleWebhook as any).mockResolvedValue({ status: 200, response: {} });
    const req = mockReq({ body: {}, query: { sign: "sig2", timestamp: "456" } });
    const res = mockRes();
    await handleMeituanWebhook(req as any, res as any, vi.fn());
    expect(platformIntegrationService.handleWebhook).toHaveBeenCalledWith("MEITUAN", {}, "sig2", "456");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("handleElemeWebhook - 应处理饿了么 webhook", async () => {
    (platformIntegrationService.handleWebhook as any).mockResolvedValue({ status: 200, response: {} });
    const req = mockReq({ body: {}, headers: { signature: "sig3" }, query: { timestamp: "789" } });
    const res = mockRes();
    await handleElemeWebhook(req as any, res as any, vi.fn());
    expect(platformIntegrationService.handleWebhook).toHaveBeenCalledWith("ELEME", {}, "sig3", "789");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getPlatforms - 应返回平台列表", async () => {
    (platformIntegrationService.getPlatforms as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getPlatforms(req as any, res as any, vi.fn());
    expect(platformIntegrationService.getPlatforms).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getConfigs - 应返回配置列表", async () => {
    (platformIntegrationService.getConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await getConfigs(req as any, res as any, vi.fn());
    expect(platformIntegrationService.getConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getConfigByPlatform - 配置不存在应返回404", async () => {
    (platformIntegrationService.getConfigByPlatform as any).mockResolvedValue(null);
    const req = mockReq({ params: { platform: "JD" } });
    const res = mockRes();
    await getConfigByPlatform(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("平台配置不存在", "404");
  });

  it("getConfigByPlatform - 应返回配置详情", async () => {
    (platformIntegrationService.getConfigByPlatform as any).mockResolvedValue({ platform: "JD" });
    const req = mockReq({ params: { platform: "JD" } });
    const res = mockRes();
    await getConfigByPlatform(req as any, res as any, vi.fn());
    expect(platformIntegrationService.getConfigByPlatform).toHaveBeenCalledWith("JD", "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("upsertConfig - 应创建或更新配置", async () => {
    (platformIntegrationService.upsertConfig as any).mockResolvedValue({ platform: "JD" });
    const req = mockReq({ body: { platform: "JD", appKey: "key", appSecret: "secret" } });
    const res = mockRes();
    await upsertConfig(req as any, res as any, vi.fn());
    expect(platformIntegrationService.upsertConfig).toHaveBeenCalledWith(expect.objectContaining({
      platform: "JD",
      appKey: "key",
      appSecret: "secret",
    }), "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("testConnection - 配置不存在应返回404", async () => {
    (platformIntegrationService.testConnection as any).mockResolvedValue({ found: false });
    const req = mockReq({ params: { platform: "JD" } });
    const res = mockRes();
    await testConnection(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("平台配置不存在", "404");
  });

  it("testConnection - 连接失败应返回502", async () => {
    (platformIntegrationService.testConnection as any).mockResolvedValue({ found: true, connected: false, error: "超时" });
    const req = mockReq({ params: { platform: "JD" } });
    const res = mockRes();
    await testConnection(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(502);
    expect(fail).toHaveBeenCalledWith("连接失败: 超时", "502");
  });

  it("testConnection - 连接成功应返回 ok", async () => {
    (platformIntegrationService.testConnection as any).mockResolvedValue({ found: true, connected: true, platform: "JD", tokenUpdated: true });
    const req = mockReq({ params: { platform: "JD" } });
    const res = mockRes();
    await testConnection(req as any, res as any, vi.fn());
    expect(platformIntegrationService.testConnection).toHaveBeenCalledWith("JD", "t1");
    expect(ok).toHaveBeenCalledWith({ platform: "JD", connected: true, tokenUpdated: true });
  });

  it("syncOrders - 配置不存在应返回404", async () => {
    (platformIntegrationService.syncOrders as any).mockResolvedValue({ found: false });
    const req = mockReq({ params: { platform: "JD" }, body: {} });
    const res = mockRes();
    await syncOrders(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("平台配置不存在", "404");
  });

  it("syncOrders - 应同步订单", async () => {
    (platformIntegrationService.syncOrders as any).mockResolvedValue({ found: true, platform: "JD", synced: 10, hasMore: false });
    const req = mockReq({ params: { platform: "JD" }, body: { startTime: "2026-01-01" } });
    const res = mockRes();
    await syncOrders(req as any, res as any, vi.fn());
    expect(platformIntegrationService.syncOrders).toHaveBeenCalledWith("JD", { startTime: "2026-01-01" }, "t1");
    expect(ok).toHaveBeenCalledWith({ platform: "JD", synced: 10, hasMore: false });
  });

  it("syncProducts - 配置不存在应返回404", async () => {
    (platformIntegrationService.syncProducts as any).mockResolvedValue({ found: false });
    const req = mockReq({ params: { platform: "JD" }, body: {} });
    const res = mockRes();
    await syncProducts(req as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fail).toHaveBeenCalledWith("平台配置不存在", "404");
  });

  it("syncProducts - 应同步商品", async () => {
    (platformIntegrationService.syncProducts as any).mockResolvedValue({ found: true, platform: "JD", synced: 5, hasMore: true });
    const req = mockReq({ params: { platform: "JD" }, body: {} });
    const res = mockRes();
    await syncProducts(req as any, res as any, vi.fn());
    expect(ok).toHaveBeenCalledWith({ platform: "JD", synced: 5, hasMore: true });
  });

  it("deleteConfig - 应删除配置", async () => {
    (platformIntegrationService.deleteConfig as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { platform: "JD" } });
    const res = mockRes();
    await deleteConfig(req as any, res as any, vi.fn());
    expect(platformIntegrationService.deleteConfig).toHaveBeenCalledWith("JD", "t1");
    expect(ok).toHaveBeenCalled();
  });
});
