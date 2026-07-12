import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/admin/store-control.service.js", () => ({
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

vi.mock("../../../shared/response.js", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler.js", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as storeControlService from "../../../services/admin/store-control.service.js";
import { ok } from "../../../shared/response.js";
import {
  adminStoreControl,
  storeStoreControl,
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
} from "../../../controllers/store-control.controller.js";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "admin", storeId: 1 },
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

describe("store-control.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("adminStoreControl", () => {
    it("getConfigs - 应获取所有门店配置", async () => {
      (storeControlService.getConfigs as any).mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();
      await adminStoreControl.getConfigs(req as any, res as any);
      expect(storeControlService.getConfigs).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getConfig - 应获取门店配置", async () => {
      (storeControlService.getConfig as any).mockResolvedValue({ storeId: 1 });
      const req = mockReq({ params: { storeId: 1 } });
      const res = mockRes();
      await adminStoreControl.getConfig(req as any, res as any);
      expect(storeControlService.getConfig).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("upsertConfig - 应更新门店配置", async () => {
      (storeControlService.upsertConfig as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { storeId: 1 }, body: { maxDailyOrders: 100 } });
      const res = mockRes();
      await adminStoreControl.upsertConfig(req as any, res as any);
      expect(storeControlService.upsertConfig).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("open - 应开门营业", async () => {
      (storeControlService.openStore as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { storeId: 1 } });
      const res = mockRes();
      await adminStoreControl.open(req as any, res as any);
      expect(storeControlService.openStore).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("close - 应打烊关门", async () => {
      (storeControlService.closeStore as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { storeId: 1 } });
      const res = mockRes();
      await adminStoreControl.close(req as any, res as any);
      expect(storeControlService.closeStore).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("suspend - 应暂停营业", async () => {
      (storeControlService.suspendStore as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { storeId: 1 }, body: { reason: "维修" } });
      const res = mockRes();
      await adminStoreControl.suspend(req as any, res as any);
      expect(storeControlService.suspendStore).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("resume - 应恢复营业", async () => {
      (storeControlService.resumeStore as any).mockResolvedValue({ success: true });
      const req = mockReq({ params: { storeId: 1 } });
      const res = mockRes();
      await adminStoreControl.resume(req as any, res as any);
      expect(storeControlService.resumeStore).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("getLogs - 应获取状态变更日志", async () => {
      (storeControlService.getLogs as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await adminStoreControl.getLogs(req as any, res as any);
      expect(storeControlService.getLogs).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("storeStoreControl", () => {
    it("status - 应获取门店状态", async () => {
      (storeControlService.getStoreStatus as any).mockResolvedValue({ status: "OPEN" });
      const req = mockReq();
      const res = mockRes();
      await storeStoreControl.status(req as any, res as any);
      expect(storeControlService.getStoreStatus).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });

    it("myLogs - 应获取我的状态变更日志", async () => {
      (storeControlService.getMyLogs as any).mockResolvedValue({ total: 0, records: [] });
      const req = mockReq({ query: { page: 1, pageSize: 20 } });
      const res = mockRes();
      await storeStoreControl.myLogs(req as any, res as any);
      expect(storeControlService.getMyLogs).toHaveBeenCalled();
      expect(ok).toHaveBeenCalled();
    });
  });

  describe("aliases", () => {
    it("listConfigs should equal adminStoreControl.getConfigs", () => expect(listConfigs).toBe(adminStoreControl.getConfigs));
    it("getConfig should equal adminStoreControl.getConfig", () => expect(getConfig).toBe(adminStoreControl.getConfig));
    it("updateConfig should equal adminStoreControl.upsertConfig", () => expect(updateConfig).toBe(adminStoreControl.upsertConfig));
    it("openStore should equal adminStoreControl.open", () => expect(openStore).toBe(adminStoreControl.open));
    it("closeStore should equal adminStoreControl.close", () => expect(closeStore).toBe(adminStoreControl.close));
    it("suspendStore should equal adminStoreControl.suspend", () => expect(suspendStore).toBe(adminStoreControl.suspend));
    it("resumeStore should equal adminStoreControl.resume", () => expect(resumeStore).toBe(adminStoreControl.resume));
    it("listStatusLogs should equal adminStoreControl.getLogs", () => expect(listStatusLogs).toBe(adminStoreControl.getLogs));
    it("getStoreStatus should equal storeStoreControl.status", () => expect(getStoreStatus).toBe(storeStoreControl.status));
    it("listMyLogs should equal storeStoreControl.myLogs", () => expect(listMyLogs).toBe(storeStoreControl.myLogs));
  });
});