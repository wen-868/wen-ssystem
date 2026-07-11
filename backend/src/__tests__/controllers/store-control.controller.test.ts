import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../services/admin/store-control.service.js", () => ({
  getConfigs: vi.fn(),
  getConfig: vi.fn(),
  upsertConfig: vi.fn(),
  openStore: vi.fn(),
  closeStore: vi.fn(),
  suspendStore: vi.fn(),
  resumeStore: vi.fn(),
  getLogs: vi.fn(),
  getStoreStatus: vi.fn(),
  getMyLogs: vi.fn(),
}));

vi.mock("../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as storeControlService from "../../services/admin/store-control.service.js";
import { ok, fail } from "../../shared/response.js";
import {
  listConfigs,
  getConfig,
  updateConfig,
  openStore,
  closeStore,
  suspendStore,
  resumeStore,
  listStatusLogs,
  getStoreStatus,
  listMyLogs,
} from "../../controllers/store-control.controller.js";

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

describe("store-control.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listConfigs - 应返回门店控制配置列表", async () => {
    (storeControlService.getConfigs as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listConfigs(req as any, res as any);
    expect(storeControlService.getConfigs).toHaveBeenCalledWith("t1");
    expect(ok).toHaveBeenCalled();
  });

  it("getConfig - 应返回门店控制配置", async () => {
    (storeControlService.getConfig as any).mockResolvedValue({ storeId: 1 });
    const req = mockReq({ params: { storeId: "1" } });
    const res = mockRes();
    await getConfig(req as any, res as any);
    expect(storeControlService.getConfig).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("updateConfig - 应更新门店控制配置", async () => {
    (storeControlService.upsertConfig as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { storeId: "1" }, body: { autoOpenTime: "09:00" } });
    const res = mockRes();
    await updateConfig(req as any, res as any);
    expect(storeControlService.upsertConfig).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("openStore - 应开启门店", async () => {
    (storeControlService.openStore as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { storeId: "1" } });
    const res = mockRes();
    await openStore(req as any, res as any);
    expect(storeControlService.openStore).toHaveBeenCalledWith({
      storeId: 1, tenantId: "t1", userId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("closeStore - 应关闭门店", async () => {
    (storeControlService.closeStore as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { storeId: "1" } });
    const res = mockRes();
    await closeStore(req as any, res as any);
    expect(storeControlService.closeStore).toHaveBeenCalledWith({
      storeId: 1, tenantId: "t1", userId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("suspendStore - 应暂停门店", async () => {
    (storeControlService.suspendStore as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { storeId: "1" }, body: { reason: "装修" } });
    const res = mockRes();
    await suspendStore(req as any, res as any);
    expect(storeControlService.suspendStore).toHaveBeenCalledWith({
      storeId: 1, tenantId: "t1", userId: 1, reason: "装修",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("resumeStore - 应恢复门店", async () => {
    (storeControlService.resumeStore as any).mockResolvedValue({ success: true });
    const req = mockReq({ params: { storeId: "1" } });
    const res = mockRes();
    await resumeStore(req as any, res as any);
    expect(storeControlService.resumeStore).toHaveBeenCalledWith({
      storeId: 1, tenantId: "t1", userId: 1,
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listStatusLogs - 应返回状态变更日志", async () => {
    (storeControlService.getLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listStatusLogs(req as any, res as any);
    expect(storeControlService.getLogs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("getStoreStatus - 应返回门店状态", async () => {
    (storeControlService.getStoreStatus as any).mockResolvedValue({ status: "OPEN" });
    const req = mockReq({ user: { id: 1, username: "admin", storeId: 1 } });
    const res = mockRes();
    await getStoreStatus(req as any, res as any);
    expect(storeControlService.getStoreStatus).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listMyLogs - 应返回我的门店日志", async () => {
    (storeControlService.getMyLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ user: { id: 1, username: "admin", storeId: 1 }, query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listMyLogs(req as any, res as any);
    expect(storeControlService.getMyLogs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
