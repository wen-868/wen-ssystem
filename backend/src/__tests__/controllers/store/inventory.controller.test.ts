import { vi, describe, it, beforeEach, expect } from "vitest";
import { ZodError } from "zod";

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
import { listInventory, adjustInventory, listInventoryLogs, listInventoryAlerts } from "../../../controllers/store/inventory.controller";

const mockReq = (overrides: any = {}) => ({
  tenantId: "t1",
  user: { id: 1, username: "storeuser", storeId: 1 },
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

describe("store/inventory.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listInventory - 应返回库存列表", async () => {
    (inventoryService.listInventory as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { keyword: "测试" } });
    const res = mockRes();
    await listInventory(req as any, res as any, vi.fn());
    expect(inventoryService.listInventory).toHaveBeenCalledWith({
      keyword: "测试",
      storeId: 1,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listInventory - 应使用 query 中的 storeId", async () => {
    (inventoryService.listInventory as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { storeId: "2" } });
    const res = mockRes();
    await listInventory(req as any, res as any, vi.fn());
    expect(inventoryService.listInventory).toHaveBeenCalledWith(expect.objectContaining({
      storeId: 2,
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("adjustInventory - 应调整库存", async () => {
    (inventoryService.adjustInventory as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: { skuId: 1, change: 10 } });
    const res = mockRes();
    await adjustInventory(req as any, res as any, vi.fn());
    expect(inventoryService.adjustInventory).toHaveBeenCalledWith(expect.objectContaining({
      skuId: 1,
      change: 10,
      storeId: 1,
      userId: 1,
      tenantId: "t1",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("adjustInventory - 应使用 body 中的 storeId", async () => {
    (inventoryService.adjustInventory as any).mockResolvedValue({ success: true });
    const req = mockReq({ body: { skuId: 1, change: 5, storeId: 3, stockType: "ONLINE" } });
    const res = mockRes();
    await adjustInventory(req as any, res as any, vi.fn());
    expect(inventoryService.adjustInventory).toHaveBeenCalledWith(expect.objectContaining({
      storeId: 3,
      stockType: "ONLINE",
    }));
    expect(ok).toHaveBeenCalled();
  });

  it("listInventoryLogs - 应返回库存日志列表", async () => {
    (inventoryService.listInventoryLogs as any).mockResolvedValue({ total: 0, records: [] });
    const req = mockReq({ query: { page: 2, pageSize: 10 } });
    const res = mockRes();
    await listInventoryLogs(req as any, res as any, vi.fn());
    expect(inventoryService.listInventoryLogs).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      storeId: 1,
      tenantId: "t1",
    });
    expect(ok).toHaveBeenCalled();
  });

  it("listInventoryAlerts - 应返回库存预警列表", async () => {
    (inventoryService.listInventoryAlerts as any).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();
    await listInventoryAlerts(req as any, res as any, vi.fn());
    expect(inventoryService.listInventoryAlerts).toHaveBeenCalledWith(1, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("listInventoryAlerts - 应使用 query 中的 storeId", async () => {
    (inventoryService.listInventoryAlerts as any).mockResolvedValue([]);
    const req = mockReq({ query: { storeId: "5" } });
    const res = mockRes();
    await listInventoryAlerts(req as any, res as any, vi.fn());
    expect(inventoryService.listInventoryAlerts).toHaveBeenCalledWith(5, "t1");
    expect(ok).toHaveBeenCalled();
  });

  it("adjustInventory - skuId 缺失应抛出 ZodError", async () => {
    const req = mockReq({ body: { change: 10 } });
    const res = mockRes();
    await expect(adjustInventory(req as any, res as any, vi.fn())).rejects.toThrow(ZodError);
    expect(inventoryService.adjustInventory).not.toHaveBeenCalled();
  });

  it("adjustInventory - change 缺失应抛出 ZodError", async () => {
    const req = mockReq({ body: { skuId: 1 } });
    const res = mockRes();
    await expect(adjustInventory(req as any, res as any, vi.fn())).rejects.toThrow(ZodError);
    expect(inventoryService.adjustInventory).not.toHaveBeenCalled();
  });

  it("adjustInventory - skuId 非数字应抛出 ZodError", async () => {
    const req = mockReq({ body: { skuId: "abc", change: 10 } });
    const res = mockRes();
    await expect(adjustInventory(req as any, res as any, vi.fn())).rejects.toThrow(ZodError);
    expect(inventoryService.adjustInventory).not.toHaveBeenCalled();
  });

  it("adjustInventory - stockType 无效值应抛出 ZodError", async () => {
    const req = mockReq({ body: { skuId: 1, change: 10, stockType: "INVALID" } });
    const res = mockRes();
    await expect(adjustInventory(req as any, res as any, vi.fn())).rejects.toThrow(ZodError);
    expect(inventoryService.adjustInventory).not.toHaveBeenCalled();
  });
});
