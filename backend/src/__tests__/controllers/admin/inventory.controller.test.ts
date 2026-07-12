import { vi, describe, it, beforeEach, expect } from "vitest";

vi.mock("../../../services/store/inventory.service", () => ({
  listInventory: vi.fn(),
  adjustInventory: vi.fn(),
  listInventoryLogs: vi.fn(),
  listInventoryAlerts: vi.fn(),
}));

vi.mock("../../../shared/response", () => ({
  ok: vi.fn((data) => ({ success: true, data })),
  fail: vi.fn((msg, code) => ({ success: false, message: msg, code })),
}));

vi.mock("../../../middleware/async-handler", () => ({
  asyncHandler: (fn: any) => fn,
}));

import * as inventoryService from "../../../services/store/inventory.service";
import { ok } from "../../../shared/response";
import {
  listInventory,
  adjustInventory,
  listInventoryLogs,
  listInventoryAlerts,
} from "../../../controllers/store/inventory.controller";

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

describe("inventory.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listInventory - 应返回库存列表", async () => {
    (inventoryService.listInventory as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listInventory(req as any, res as any);
    expect(inventoryService.listInventory).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listInventory - 应支持筛选参数", async () => {
    (inventoryService.listInventory as any).mockResolvedValue({ total: 1, records: [] });
    const req = mockReq({
      query: { keyword: "test", storeId: 2 },
      user: { id: 1, username: "admin", storeId: 1 },
    });
    const res = mockRes();
    await listInventory(req as any, res as any);
    expect(inventoryService.listInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: "test",
        storeId: 2,
        tenantId: "t1",
      })
    );
    expect(ok).toHaveBeenCalled();
  });

  it("adjustInventory - 应调整库存", async () => {
    (inventoryService.adjustInventory as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: { skuId: 1, change: 10 },
    });
    const res = mockRes();
    await adjustInventory(req as any, res as any);
    expect(inventoryService.adjustInventory).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("adjustInventory - Zod验证失败应抛出错误", async () => {
    const req = mockReq({ body: { skuId: "invalid", change: "invalid" } });
    const res = mockRes();
    await expect(adjustInventory(req as any, res as any)).rejects.toThrow();
    expect(inventoryService.adjustInventory).not.toHaveBeenCalled();
  });

  it("adjustInventory - 应使用默认stockType", async () => {
    (inventoryService.adjustInventory as any).mockResolvedValue({ id: 1 });
    const req = mockReq({
      body: { skuId: 1, change: 10 },
    });
    const res = mockRes();
    await adjustInventory(req as any, res as any);
    expect(inventoryService.adjustInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        stockType: "OFFLINE",
      })
    );
  });

  it("listInventoryLogs - 应返回库存日志列表", async () => {
    (inventoryService.listInventoryLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 1, pageSize: 20 } });
    const res = mockRes();
    await listInventoryLogs(req as any, res as any);
    expect(inventoryService.listInventoryLogs).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listInventoryAlerts - 应返回库存预警列表", async () => {
    (inventoryService.listInventoryAlerts as any).mockResolvedValue([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await listInventoryAlerts(req as any, res as any);
    expect(inventoryService.listInventoryAlerts).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("listInventoryAlerts - 应支持storeId参数", async () => {
    (inventoryService.listInventoryAlerts as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: 2 } });
    const res = mockRes();
    await listInventoryAlerts(req as any, res as any);
    expect(inventoryService.listInventoryAlerts).toHaveBeenCalledWith(2, "t1");
  });
});